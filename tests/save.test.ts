import { describe, expect, it } from "vitest";
import { BACKUP_KEY, QUARANTINE_KEY, SAVE_KEY, SaveManager, migrate, type KeyValueStore } from "../src/save/SaveManager";
import { sanitizeState } from "../src/save/validate";
import { SAVE_SCHEMA, createFreshState } from "../src/core/state";

class MemStore implements KeyValueStore {
  map = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error("quota");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe("SaveManager", () => {
  it("starts fresh with no data", () => {
    const r = new SaveManager(new MemStore()).load(1000);
    expect(r.status).toBe("fresh");
    expect(r.state.coins).toBe(0);
  });

  it("round-trips a save", () => {
    const store = new MemStore();
    const a = new SaveManager(store);
    const g = createFreshState(0);
    g.coins = 1234.5;
    g.upgrades = { lemon_tree: 3 };
    g.stickers = ["mochi_cat"];
    expect(a.save(g, 5000)).toBe("ok");
    const r = new SaveManager(store).load(6000);
    expect(r.status).toBe("loaded");
    expect(r.state.coins).toBe(1234.5);
    expect(r.state.upgrades.lemon_tree).toBe(3);
    expect(r.state.stickers).toEqual(["mochi_cat"]);
  });

  it("quarantines unreadable data instead of silently discarding it", () => {
    const store = new MemStore();
    store.map.set(SAVE_KEY, "{not json");
    const r = new SaveManager(store).load(0);
    expect(r.status).toBe("quarantined");
    expect(store.getItem(QUARANTINE_KEY)).toBe("{not json");
  });

  it("recovers from the backup when the primary is corrupt", () => {
    const store = new MemStore();
    const g = createFreshState(0);
    g.coins = 77;
    store.map.set(BACKUP_KEY, JSON.stringify({ schema: SAVE_SCHEMA, savedAt: 10, state: g }));
    store.map.set(SAVE_KEY, "garbage");
    const r = new SaveManager(store).load(100);
    expect(r.status).toBe("recovered");
    expect(r.state.coins).toBe(77);
  });

  it("never overwrites a save from a newer schema", () => {
    const store = new MemStore();
    const future = JSON.stringify({ schema: SAVE_SCHEMA + 1, savedAt: 50, state: { coins: 9 } });
    store.map.set(SAVE_KEY, future);
    const r = new SaveManager(store).load(100);
    expect(r.status).toBe("quarantined");
    expect(store.getItem(QUARANTINE_KEY)).toBe(future);
  });

  it("detects a newer save written by another session and refuses to overwrite it", () => {
    const store = new MemStore();
    const tabA = new SaveManager(store);
    const tabB = new SaveManager(store);
    tabA.load(0);
    tabB.load(0);
    const g = createFreshState(0);
    expect(tabA.save(g, 1000)).toBe("ok");
    const newer = store.getItem(SAVE_KEY);
    expect(tabB.save(createFreshState(0), 2000)).toBe("conflict");
    expect(store.getItem(SAVE_KEY)).toBe(newer);
  });

  it("reports storage failures without throwing", () => {
    const store = new MemStore();
    store.failWrites = true;
    expect(new SaveManager(store).save(createFreshState(0), 1)).toBe("error");
  });

  it("keeps a backup of the previous save", () => {
    const store = new MemStore();
    const m = new SaveManager(store);
    const g = createFreshState(0);
    g.coins = 1;
    m.save(g, 1000);
    g.coins = 2;
    m.save(g, 70_000);
    const backup = JSON.parse(store.getItem(BACKUP_KEY)!);
    expect(backup.state.coins).toBe(1);
  });
});

describe("migrations", () => {
  it("applies each step in order", () => {
    const table = {
      1: (s: Record<string, unknown>) => ({ ...s, renamed: s.old, old: undefined }),
      2: (s: Record<string, unknown>) => ({ ...s, added: true }),
    };
    const out = migrate({ schema: 1, savedAt: 5, state: { old: 3 } }, table, 3);
    expect(out).toEqual({ schema: 3, savedAt: 5, state: { renamed: 3, old: undefined, added: true } });
  });

  it("fails (returns null) when a step is missing or throws", () => {
    expect(migrate({ schema: 1, savedAt: 0, state: {} }, {}, 2)).toBeNull();
    expect(
      migrate({ schema: 1, savedAt: 0, state: {} }, { 1: () => { throw new Error("x"); } }, 2),
    ).toBeNull();
  });
});

describe("validation", () => {
  it("rejects NaN / Infinity / negatives and clamps levels", () => {
    const issues: string[] = [];
    const g = sanitizeState(
      {
        coins: Number.NaN,
        runCoins: Infinity,
        lemons: -4,
        upgrades: { lemon_tree: 9999, basket: "x", bogus: 3 },
        helpers: { pip: 2.7 },
        sunnyTokens: -1,
        pressProgress: 5,
      },
      1000,
      issues,
    );
    expect(g.coins).toBe(0);
    expect(g.runCoins).toBe(0);
    expect(g.lemons).toBe(0);
    expect(g.upgrades.lemon_tree).toBe(40);
    expect(g.upgrades.basket).toBeUndefined();
    expect((g.upgrades as Record<string, number>).bogus).toBeUndefined();
    expect(g.helpers.pip).toBe(2);
    expect(g.sunnyTokens).toBe(0);
    expect(g.pressProgress).toBe(1);
  });

  it("drops unknown IDs, fixes recipes and keeps regions contiguous", () => {
    const g = sanitizeState(
      { regions: ["tiny_yard", "market_row", "nowhere"], recipes: ["honey_lemon", "fake"], activeRecipe: "fake", cosmetic: "awning_fake", stickers: ["mochi_cat", "dragon"] },
      0,
    );
    expect(g.regions).toEqual(["tiny_yard"]);
    expect(g.recipes).toEqual(["classic", "honey_lemon"]);
    expect(g.activeRecipe).toBe("classic");
    expect(g.cosmetic).toBe("awning_lemon");
    expect(g.stickers).toEqual(["mochi_cat"]);
  });

  it("clamps timestamps from the future", () => {
    const g = sanitizeState({ lastActiveAt: 10_000_000 }, 5000);
    expect(g.lastActiveAt).toBe(5000);
  });

  it("survives completely invalid input", () => {
    for (const bad of [null, 42, "str", [], { trees: "no" }, { quest: 7 }]) {
      expect(() => sanitizeState(bad, 0)).not.toThrow();
    }
  });
});
