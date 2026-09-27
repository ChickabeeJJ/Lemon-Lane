// Save validation: every loaded value is type-checked, finite, and clamped.
// Unknown IDs are dropped; missing fields fall back to fresh defaults.
import { COSMETICS, HELPERS, PERKS, QUESTS, RECIPES, REGIONS, UPGRADES, CUSTOMERS } from "../content/content";
import { createFreshState, emptyStats, GROVE_TREE_SLOTS, HOME_TREE_SLOTS, SAVE_SCHEMA, type Fruit, type GameState, type Stats } from "../core/state";

const MAX_NUM = 1e300;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function num(v: unknown, fallback: number, min = 0, max = MAX_NUM): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  return Math.floor(num(v, fallback, min, max));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function str(v: unknown, fallback: string, maxLen = 64): string {
  return typeof v === "string" && v.length <= maxLen ? v : fallback;
}

function idList<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) if (typeof x === "string" && (allowed as readonly string[]).includes(x) && !out.includes(x as T)) out.push(x as T);
  return out;
}

function levels<T extends string>(v: unknown, defs: readonly { id: T; maxLevel: number }[]): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  if (!isObj(v)) return out;
  for (const d of defs) {
    const lv = int(v[d.id], 0, 0, d.maxLevel);
    if (lv > 0) out[d.id] = lv;
  }
  return out;
}

function stats(v: unknown): Stats {
  const base = emptyStats();
  if (!isObj(v)) return base;
  for (const k of Object.keys(base) as (keyof Stats)[]) base[k] = num(v[k], 0);
  return base;
}

function trees(v: unknown): Fruit[][] {
  if (!Array.isArray(v)) return createFreshState(0).trees;
  return v.slice(0, HOME_TREE_SLOTS + GROVE_TREE_SLOTS).map((tree) =>
    Array.isArray(tree)
      ? tree.slice(0, 12).map((f) => ({
          g: num(isObj(f) ? f.g : 0, 0, 0, 1),
          golden: bool(isObj(f) ? f.golden : false, false),
          diamond: bool(isObj(f) ? f.diamond : false, false),
        }))
      : [],
  );
}

/**
 * Turn arbitrary parsed JSON into a valid GameState. Never throws.
 * `issues` collects human-readable notes for development logs.
 */
export function sanitizeState(raw: unknown, now: number, issues: string[] = []): GameState {
  const fresh = createFreshState(now);
  if (!isObj(raw)) {
    issues.push("state is not an object");
    return fresh;
  }
  const regionIds = REGIONS.map((r) => r.id);
  const recipeIds = RECIPES.map((r) => r.id);
  const regions = idList(raw.regions, regionIds);
  if (!regions.includes("tiny_yard")) regions.unshift("tiny_yard");
  // Regions open in order; drop any that skip ahead.
  const ordered = [...REGIONS].sort((a, b) => a.sort - b.sort).map((r) => r.id);
  const firstMissing = ordered.findIndex((id) => !regions.includes(id));
  const validRegions = firstMissing < 0 ? ordered : ordered.slice(0, firstMissing);
  if (validRegions.length !== regions.length) issues.push("dropped non-contiguous regions");

  const recipes = idList(raw.recipes, recipeIds);
  if (!recipes.includes("classic")) recipes.unshift("classic");
  let activeRecipe = str(raw.activeRecipe, "classic") as GameState["activeRecipe"];
  if (!recipes.includes(activeRecipe)) activeRecipe = "classic";

  const cosmetic = str(raw.cosmetic, "awning_lemon") as GameState["cosmetic"];
  const settings = isObj(raw.settings) ? raw.settings : {};
  const quest = isObj(raw.quest) ? raw.quest : {};

  const g: GameState = {
    schema: SAVE_SCHEMA,
    savedAt: num(raw.savedAt, 0),
    lastActiveAt: num(raw.lastActiveAt, now),
    createdAt: num(raw.createdAt, now),
    coins: num(raw.coins, 0),
    runCoins: num(raw.runCoins, 0),
    lemons: int(raw.lemons, 0, 0, 1e6),
    drinks: int(raw.drinks, 0, 0, 1e6),
    pressProgress: num(raw.pressProgress, 0, 0, 1),
    upgrades: levels(raw.upgrades, UPGRADES),
    helpers: levels(raw.helpers, HELPERS),
    regions: validRegions,
    activeRecipe,
    trees: trees(raw.trees),
    quest: {
      index: int(quest.index, 0, 0, 1e6),
      baseline: num(quest.baseline, 0),
      best: int(quest.best, 0, 0, 1e6),
      target: num(quest.target, 0),
      reward: num(quest.reward, 0),
    },
    sunnyTokens: int(raw.sunnyTokens, 0, 0, 1e12),
    sunrises: int(raw.sunrises, 0, 0, 1e6),
    perks: levels(raw.perks, PERKS),
    recipes,
    stickers: idList(raw.stickers, CUSTOMERS.map((c) => c.id)),
    cosmetic: COSMETICS.some((c) => c.id === cosmetic) ? cosmetic : "awning_lemon",
    lifetime: stats(raw.lifetime),
    run: stats(raw.run),
    lastDailyDay: str(raw.lastDailyDay, "", 16),
    boostUntil: num(raw.boostUntil, 0),
    lastSpinAt: num(raw.lastSpinAt, 0),
    settings: {
      music: bool(settings.music, true),
      sfx: bool(settings.sfx, true),
      reducedMotion: bool(settings.reducedMotion, false),
    },
    tutorialDone: bool(raw.tutorialDone, false),
  };
  // Clock sanity: timestamps from the future are clamped to now.
  if (g.lastActiveAt > now) g.lastActiveAt = now;
  if (g.boostUntil > now + 10 * 60_000) g.boostUntil = 0;
  if (g.lastSpinAt > now) g.lastSpinAt = now;
  // A generated goal must carry a positive target.
  if (g.quest.index >= QUESTS.length && g.quest.target <= 0) {
    g.quest.target = 50;
    g.quest.reward = 50;
  }
  return g;
}
