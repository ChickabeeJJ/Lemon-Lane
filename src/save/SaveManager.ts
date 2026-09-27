// SaveManager: serialization, versioned migration, validation, backup and conflict handling.
import { SAVE_SCHEMA, createFreshState, type GameState } from "../core/state";
import { sanitizeState } from "./validate";
import { QUESTS, QUEST_IDS_V1 } from "../content/content";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = "lemonlane_save";
export const BACKUP_KEY = "lemonlane_save_backup";
export const QUARANTINE_KEY = "lemonlane_save_quarantine";

interface Envelope {
  schema: number;
  savedAt: number;
  state: unknown;
}

/** Migration from schema N to N+1, keyed by N. Add one for every schema bump. */
export type MigrationTable = Record<number, (state: Record<string, unknown>) => Record<string, unknown>>;

export const MIGRATIONS: MigrationTable = {
  /**
   * 1 → 2: exploring zones. New goals were inserted into the authored chain, so the goal index is
   * remapped by goal ID; the Lucky Wheel timer starts fresh. Fruit gains an optional `diamond` flag
   * and grove tree slots are added lazily by the simulation, so neither needs rewriting here.
   */
  1: (state) => {
    const quest = (typeof state.quest === "object" && state.quest !== null ? state.quest : {}) as Record<string, unknown>;
    const oldIndex = typeof quest.index === "number" ? quest.index : 0;
    let index = oldIndex;
    if (oldIndex < QUEST_IDS_V1.length) {
      const id = QUEST_IDS_V1[Math.max(0, Math.floor(oldIndex))];
      const mapped = QUESTS.findIndex((q) => q.id === id);
      index = mapped >= 0 ? mapped : oldIndex;
    } else {
      index = QUESTS.length + (oldIndex - QUEST_IDS_V1.length);
    }
    return { ...state, quest: { ...quest, index }, lastSpinAt: 0 };
  },
};

export type LoadStatus = "fresh" | "loaded" | "recovered" | "quarantined";

export interface LoadResult {
  state: GameState;
  status: LoadStatus;
  issues: string[];
}

function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return null;
    const e = v as Record<string, unknown>;
    if (typeof e.schema !== "number" || !Number.isInteger(e.schema) || e.schema < 1) return null;
    if (typeof e.state !== "object" || e.state === null) return null;
    const savedAt = typeof e.savedAt === "number" && Number.isFinite(e.savedAt) ? e.savedAt : 0;
    return { schema: e.schema, savedAt, state: e.state };
  } catch {
    return null;
  }
}

export function migrate(env: Envelope, table: MigrationTable = MIGRATIONS, target = SAVE_SCHEMA): Envelope | null {
  let state = env.state as Record<string, unknown>;
  for (let v = env.schema; v < target; v++) {
    const fn = table[v];
    if (!fn) return null;
    try {
      state = fn(structuredClone(state));
    } catch {
      return null;
    }
  }
  return { schema: target, savedAt: env.savedAt, state };
}

export class SaveManager {
  private lastWrittenAt = 0;
  private lastBackupAt = 0;
  /** Set when another tab/session wrote newer data; further writes are refused. */
  conflicted = false;

  constructor(
    private store: KeyValueStore,
    private migrations: MigrationTable = MIGRATIONS,
  ) {}

  load(now: number): LoadResult {
    const issues: string[] = [];
    const primaryRaw = this.safeGet(SAVE_KEY);
    const backupRaw = this.safeGet(BACKUP_KEY);
    const primary = parseEnvelope(primaryRaw);
    const backup = parseEnvelope(backupRaw);

    // A save from a newer build is never overwritten: keep it aside, untouched.
    const newer = [primary, backup].find((e) => e && e.schema > SAVE_SCHEMA);
    if (newer) {
      if (this.safeGet(QUARANTINE_KEY) === null) this.safeSet(QUARANTINE_KEY, newer === primary ? primaryRaw! : backupRaw!);
      issues.push(`save schema ${newer.schema} is newer than ${SAVE_SCHEMA}`);
      return { state: createFreshState(now), status: "quarantined", issues };
    }

    const candidates: { env: Envelope; which: "primary" | "backup" }[] = [];
    if (primary) {
      const m = migrate(primary, this.migrations);
      if (m) candidates.push({ env: m, which: "primary" });
      else issues.push("primary save failed migration");
    } else if (primaryRaw) {
      issues.push("primary save unreadable");
    }
    if (backup) {
      const m = migrate(backup, this.migrations);
      if (m) candidates.push({ env: m, which: "backup" });
    }

    if (candidates.length === 0) {
      if (primaryRaw) {
        // Keep the unreadable data for support/debugging instead of discarding it.
        this.safeSet(QUARANTINE_KEY, primaryRaw);
        return { state: createFreshState(now), status: "quarantined", issues };
      }
      return { state: createFreshState(now), status: "fresh", issues };
    }

    // Deterministic pick: newest savedAt wins; ties prefer the primary.
    candidates.sort((a, b) => b.env.savedAt - a.env.savedAt || (a.which === "primary" ? -1 : 1));
    const chosen = candidates[0];
    const state = sanitizeState(chosen.env.state, now, issues);
    this.lastWrittenAt = Math.max(primary?.savedAt ?? 0, backup?.savedAt ?? 0);
    const status: LoadStatus = chosen.which === "backup" ? "recovered" : "loaded";
    return { state, status, issues };
  }

  /**
   * Persist the state. Returns "ok", "conflict" (newer data exists from another session;
   * nothing written), or "error" (storage threw; caller should retry later).
   */
  save(g: GameState, now: number): "ok" | "conflict" | "error" {
    if (this.conflicted) return "conflict";
    const stored = parseEnvelope(this.safeGet(SAVE_KEY));
    if (stored && stored.savedAt > this.lastWrittenAt + 1) {
      this.conflicted = true;
      return "conflict";
    }
    const savedAt = Math.max(now, this.lastWrittenAt + 1);
    g.savedAt = savedAt;
    const payload = JSON.stringify({ schema: SAVE_SCHEMA, savedAt, state: g } satisfies Envelope);
    try {
      if (stored && now - this.lastBackupAt > 60_000) {
        this.store.setItem(BACKUP_KEY, JSON.stringify(stored));
        this.lastBackupAt = now;
      }
      this.store.setItem(SAVE_KEY, payload);
      this.lastWrittenAt = savedAt;
      return "ok";
    } catch {
      return "error";
    }
  }

  /** Erase all progress (explicit player request only). */
  wipe(): void {
    for (const k of [SAVE_KEY, BACKUP_KEY]) {
      try {
        this.store.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    this.lastWrittenAt = 0;
    this.conflicted = false;
  }

  private safeGet(key: string): string | null {
    try {
      return this.store.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string): void {
    try {
      this.store.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
}
