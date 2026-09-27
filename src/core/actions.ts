// Atomic purchase/progression actions (ProgressionService).
// Each action validates, deducts, applies — or changes nothing and returns a reason.
import { COSMETICS, TUNING, helperById, perkById, recipeById, regionById, upgradeById } from "../content/content";
import type { CosmeticId, HelperId, PerkId, RecipeId, RegionId, UpgradeId } from "../content/types";
import {
  collectionStars,
  computeStats,
  helperCost,
  helpersHired,
  perkCost,
  recipeCost,
  slotsOf,
  sunriseTokens,
  upgradeCost,
  type StatBlock,
} from "./economy";
import { emptyContracts, emptyStats, type GameState } from "./state";

export type FailReason = "cost" | "max" | "locked" | "slots" | "owned" | "unknown" | "notReady";
export type ActionResult = { ok: true; spent: number } | { ok: false; reason: FailReason };

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });

function spend(g: GameState, cost: number): boolean {
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(g.coins)) return false;
  if (!(g.coins + 1e-9 >= cost)) return false;
  g.coins = Math.max(0, g.coins - cost);
  return true;
}

export function upgradeLocked(g: GameState, id: UpgradeId): boolean {
  const def = upgradeById.get(id);
  return !def || !g.regions.includes(def.region);
}

export function buyUpgrade(g: GameState, id: UpgradeId, s: StatBlock): ActionResult {
  const def = upgradeById.get(id);
  if (!def) return fail("unknown");
  if (upgradeLocked(g, id)) return fail("locked");
  const level = g.upgrades[id] ?? 0;
  if (level >= def.maxLevel) return fail("max");
  const cost = upgradeCost(g, id, s);
  if (!spend(g, cost)) return fail("cost");
  g.upgrades[id] = level + 1;
  g.run.upgradesBought++;
  g.lifetime.upgradesBought++;
  return { ok: true, spent: cost };
}

export function helperLocked(g: GameState, id: HelperId): boolean {
  const def = helperById.get(id);
  return !def || !g.regions.includes(def.region);
}

export function buyHelper(g: GameState, id: HelperId, s: StatBlock): ActionResult {
  const def = helperById.get(id);
  if (!def) return fail("unknown");
  if (helperLocked(g, id)) return fail("locked");
  const level = g.helpers[id] ?? 0;
  if (level >= def.maxLevel) return fail("max");
  if (level === 0 && helpersHired(g) >= slotsOf(s.helperSlots)) return fail("slots");
  const cost = helperCost(g, id, s);
  if (!spend(g, cost)) return fail("cost");
  g.helpers[id] = level + 1;
  return { ok: true, spent: cost };
}

export function regionLocked(g: GameState, id: RegionId): boolean {
  const def = regionById.get(id);
  return !def || g.sunrises < def.sunrises;
}

/** Regions open in order: the next one is available only after the previous one. */
export function nextRegion(g: GameState): RegionId | undefined {
  return [...regionById.values()].sort((a, b) => a.sort - b.sort).find((r) => !g.regions.includes(r.id))?.id;
}

export function unlockRegion(g: GameState, id: RegionId): ActionResult {
  const def = regionById.get(id);
  if (!def) return fail("unknown");
  if (g.regions.includes(id)) return fail("owned");
  if (nextRegion(g) !== id || regionLocked(g, id)) return fail("locked");
  if (!spend(g, def.cost)) return fail("cost");
  g.regions.push(id);
  return { ok: true, spent: def.cost };
}

export function recipeLocked(g: GameState, id: RecipeId): boolean {
  const def = recipeById.get(id);
  return !def || !g.regions.includes(def.region) || g.sunrises < def.sunrises;
}

export function discoverRecipe(g: GameState, id: RecipeId, s: StatBlock): ActionResult {
  const def = recipeById.get(id);
  if (!def) return fail("unknown");
  if (g.recipes.includes(id)) return fail("owned");
  if (recipeLocked(g, id)) return fail("locked");
  const cost = recipeCost(id, s);
  if (!spend(g, cost)) return fail("cost");
  g.recipes.push(id);
  g.activeRecipe = id;
  g.pressProgress = 0;
  return { ok: true, spent: cost };
}

export function setActiveRecipe(g: GameState, id: RecipeId): ActionResult {
  if (!g.recipes.includes(id)) return fail("locked");
  if (recipeLocked(g, id)) return fail("locked");
  if (g.activeRecipe !== id) {
    g.activeRecipe = id;
    g.pressProgress = 0;
  }
  return { ok: true, spent: 0 };
}

export function buyPerk(g: GameState, id: PerkId): ActionResult {
  const def = perkById.get(id);
  if (!def) return fail("unknown");
  const level = g.perks[id] ?? 0;
  if (level >= def.maxLevel) return fail("max");
  const cost = perkCost(g, id);
  if (g.sunnyTokens < cost) return fail("cost");
  g.sunnyTokens -= cost;
  g.perks[id] = level + 1;
  return { ok: true, spent: cost };
}

export function cosmeticUnlocked(g: GameState, id: CosmeticId): boolean {
  const def = COSMETICS.find((c) => c.id === id);
  return !!def && collectionStars(g) >= def.stars;
}

export function equipCosmetic(g: GameState, id: CosmeticId): ActionResult {
  if (!cosmeticUnlocked(g, id)) return fail("locked");
  g.cosmetic = id;
  return { ok: true, spent: 0 };
}

/**
 * Sunrise prestige. Temporary progress resets; permanent collections, perks,
 * discovered recipes, cosmetics, settings and lifetime stats remain.
 */
export function performSunrise(g: GameState, now: number): { ok: true; tokens: number } | { ok: false; reason: FailReason } {
  const s = computeStats(g);
  const tokens = sunriseTokens(g, s);
  if (tokens <= 0) return { ok: false, reason: "notReady" };
  g.sunnyTokens += tokens;
  g.sunrises += 1;
  g.coins = 0;
  g.runCoins = 0;
  g.lemons = 0;
  g.drinks = 0;
  g.perfectDrinks = 0;
  g.pendingPerfect = false;
  g.pressProgress = 0;
  // Offers use this chapter's recipes; the streak survives.
  g.contract = { ...emptyContracts(), streak: g.contract.streak };
  g.upgrades = {};
  g.helpers = {};
  g.regions = ["tiny_yard"];
  g.activeRecipe = "classic";
  g.trees = [[{ g: 0.9, golden: false }, { g: 0.6, golden: false }, { g: 0.3, golden: false }]];
  g.run = emptyStats();
  g.boostUntil = 0;
  g.lastActiveAt = now;
  return { ok: true, tokens };
}

/** Calendar day key in the player's local time. */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dailyAvailable(g: GameState, now: number): boolean {
  return g.lastDailyDay !== dayKey(now);
}

export function dailyReward(incomePerSec: number, s: StatBlock): number {
  return Math.floor((TUNING.dailyBaseReward + incomePerSec * TUNING.dailyIncomeSeconds) * s.rewardMult);
}
