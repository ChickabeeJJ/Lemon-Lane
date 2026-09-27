// EconomyService: pure functions for derived stats, costs, values and offline income.
import {
  CUSTOMERS,
  HELPERS,
  PERKS,
  RECIPE_TRAIT_BONUS,
  REGIONS,
  STAT_BASE,
  STAT_LIMITS,
  TUNING,
  UPGRADES,
  helperById,
  perkById,
  recipeById,
  regionById,
  upgradeById,
} from "../content/content";
import type { Effect, HelperId, PerkId, RecipeDef, RegionId, StatId, UpgradeId } from "../content/types";
import type { GameState } from "./state";

export type StatBlock = Record<StatId, number>;

export function computeStats(g: GameState): StatBlock {
  const add: Partial<Record<StatId, number>> = {};
  const pct: Partial<Record<StatId, number>> = {};
  const apply = (effects: Effect[], level: number) => {
    if (level <= 0) return;
    for (const e of effects) {
      if (e.add) add[e.stat] = (add[e.stat] ?? 0) + e.add * level;
      if (e.pct) pct[e.stat] = (pct[e.stat] ?? 0) + e.pct * level;
    }
  };
  for (const u of UPGRADES) apply(u.effects, g.upgrades[u.id] ?? 0);
  for (const h of HELPERS) apply(h.effects, g.helpers[h.id] ?? 0);
  for (const p of PERKS) apply(p.effects, g.perks[p.id] ?? 0);
  for (const r of REGIONS) if (g.regions.includes(r.id)) apply(r.effects, 1);

  const recipe = recipeById.get(g.activeRecipe);
  if (recipe) {
    if (recipe.trait === "premium") add.premiumChance = (add.premiumChance ?? 0) + RECIPE_TRAIT_BONUS.premium;
    if (recipe.trait === "offline") add.offlineEfficiency = (add.offlineEfficiency ?? 0) + RECIPE_TRAIT_BONUS.offline;
    if (recipe.trait === "rare") add.goldenChance = (add.goldenChance ?? 0) + RECIPE_TRAIT_BONUS.rare;
  }

  const out = {} as StatBlock;
  for (const key of Object.keys(STAT_BASE) as StatId[]) {
    let v = (STAT_BASE[key] + (add[key] ?? 0)) * (1 + (pct[key] ?? 0));
    const lim = STAT_LIMITS[key];
    if (lim) v = Math.min(lim[1], Math.max(lim[0], v));
    out[key] = v;
  }
  return out;
}

/** Integer view of fractional capacity stats. */
export function slotsOf(value: number): number {
  return Math.max(0, Math.floor(value + 1e-9));
}

export function collectionStars(g: GameState): number {
  return g.stickers.length + g.recipes.length + g.regions.length;
}

export function maxCombo(g: GameState): number {
  const r = recipeById.get(g.activeRecipe);
  return TUNING.comboMaxSteps + (r?.trait === "combo" ? RECIPE_TRAIT_BONUS.combo : 0);
}

/** Global multiplier applied to every coin the stand earns from sales. */
export function incomeMultiplier(g: GameState, s: StatBlock, now: number): number {
  const stars = collectionStars(g);
  const boost = now < g.boostUntil ? TUNING.burstMult : 1;
  return s.incomeMult * s.drinkValue * (1 + s.starBonus * stars) * boost;
}

export function activeRecipe(g: GameState): RecipeDef {
  return recipeById.get(g.activeRecipe) ?? recipeById.get("classic")!;
}

/** Coins for one raw lemon sold at the Sell Crate (or down the Lemon Chute). */
export function rawLemonValue(g: GameState, s: StatBlock, now: number): number {
  const r = activeRecipe(g);
  return (r.value / r.lemons) * TUNING.rawLemonShare * s.lemonPrice * incomeMultiplier(g, s, now);
}

/** Coins per second from the Lemonade Fountain. */
export function fountainPerSec(g: GameState, s: StatBlock, now: number): number {
  return (s.passiveIncome / 60) * baseDrinkValue(g, s, now);
}

/** Lemon trees currently planted (stand trees + grove plots). */
export function totalTrees(s: StatBlock): number {
  return slotsOf(s.treeCount) + slotsOf(s.grovePlots);
}

/** Coins for one standard drink of the active recipe (no customer/premium/combo modifiers). */
export function baseDrinkValue(g: GameState, s: StatBlock, now: number): number {
  return activeRecipe(g).value * incomeMultiplier(g, s, now);
}

// ---------------------------------------------------------------------------
// Costs

export function upgradeCost(g: GameState, id: UpgradeId, s: StatBlock): number {
  const def = upgradeById.get(id)!;
  const level = g.upgrades[id] ?? 0;
  return Math.ceil(def.baseCost * Math.pow(def.growth, level) * s.upgradeCostScale);
}

export function helperCost(g: GameState, id: HelperId, s: StatBlock): number {
  const def = helperById.get(id)!;
  const level = g.helpers[id] ?? 0;
  return Math.ceil(def.hireCost * Math.pow(def.growth, level) * s.upgradeCostScale);
}

export function perkCost(g: GameState, id: PerkId): number {
  const def = perkById.get(id)!;
  const level = g.perks[id] ?? 0;
  return Math.ceil(def.baseCost * Math.pow(def.growth, level));
}

export function recipeCost(id: RecipeDef["id"], s: StatBlock): number {
  const def = recipeById.get(id)!;
  return Math.ceil(def.unlockCost * (1 - s.recipeDiscount));
}

export function regionCost(id: RegionId): number {
  return regionById.get(id)!.cost;
}

export function helpersHired(g: GameState): number {
  return HELPERS.filter((h) => (g.helpers[h.id] ?? 0) > 0).length;
}

// ---------------------------------------------------------------------------
// Helpers

/** Seconds between a helper's actions. */
export function helperInterval(g: GameState, id: HelperId, s: StatBlock): number {
  const def = helperById.get(id)!;
  const level = g.helpers[id] ?? 0;
  if (level <= 0 || def.interval <= 0) return Infinity;
  return def.interval / (s.helperSpeed * (1 + 0.2 * (level - 1)));
}

// ---------------------------------------------------------------------------
// Rates, used for UI estimates and offline progress

export interface RateBreakdown {
  lemonsPerSec: number;
  drinksPerSec: number;
  customersPerSec: number;
  servedPerSec: number;
  deliveredPerSec: number;
  coinsPerSec: number;
}

/** Average payment per drink including customer mix, premium orders and tips. */
export function averageSaleValue(g: GameState, s: StatBlock, now: number): number {
  const pool = CUSTOMERS.filter((c) => g.regions.includes(c.region) && g.sunrises >= c.sunrises);
  const totalW = pool.reduce((a, c) => a + c.weight, 0) || 1;
  let avg = 0;
  for (const c of pool) {
    const fav = c.favorite === g.activeRecipe ? 1 + s.favoriteBonus : 1;
    const tip = Math.min(1, s.tipChance + c.tipBonus) * TUNING.tipSize;
    avg += (c.weight / totalW) * c.valueMult * fav * (1 + tip);
  }
  const premium = 1 + s.premiumChance * s.premiumBonus;
  return baseDrinkValue(g, s, now) * avg * premium;
}

/**
 * Steady-state automated throughput. Manual play is ignored, so this is what the
 * stand earns on its own (used for offline progress).
 */
export function automatedRates(g: GameState, s: StatBlock, now: number): RateBreakdown {
  const recipe = activeRecipe(g);
  const trees = totalTrees(s);
  const growPerSec = (trees * slotsOf(s.fruitSlots) * s.growthSpeed) / TUNING.fruitGrowTime;
  const pickPerSec = 1 / helperInterval(g, "pip", s);
  const lemonsPerSec = Math.min(growPerSec, pickPerSec);
  const pressPerSec = s.pressSpeed / recipe.pressTime;
  const drinksPerSec = Math.min(lemonsPerSec / recipe.lemons, pressPerSec);
  const customersPerSec = s.arrivalRate / TUNING.arrivalInterval;
  const serveRate = 1 / helperInterval(g, "roo", s);
  const servedPerSec = Math.min(drinksPerSec, customersPerSec, serveRate);
  const deliveredPerSec = Math.min(Math.max(0, drinksPerSec - servedPerSec), s.deliveryRate / 60);
  const sale = averageSaleValue(g, s, now);
  // With the Lemon Chute, lemons the press can't keep up with are sold raw.
  const spareLemons = s.autoSell >= 1 && (g.upgrades.sell_crate ?? 0) > 0 ? Math.max(0, lemonsPerSec - drinksPerSec * recipe.lemons) : 0;
  const coinsPerSec =
    servedPerSec * sale +
    deliveredPerSec * baseDrinkValue(g, s, now) * TUNING.deliveryValue +
    spareLemons * rawLemonValue(g, s, now) +
    fountainPerSec(g, s, now);
  return { lemonsPerSec, drinksPerSec, customersPerSec, servedPerSec, deliveredPerSec, coinsPerSec };
}

export interface OfflineResult {
  seconds: number;
  cappedSeconds: number;
  coins: number;
}

export function offlineEarnings(g: GameState, s: StatBlock, awaySeconds: number): OfflineResult {
  const seconds = Number.isFinite(awaySeconds) ? Math.max(0, awaySeconds) : 0;
  const cappedSeconds = Math.min(seconds, s.offlineCapHours * 3600);
  // Boosts never apply to offline time.
  const rate = automatedRates(g, s, 0).coinsPerSec;
  const coins = Math.floor(rate * cappedSeconds * s.offlineEfficiency);
  return { seconds, cappedSeconds, coins: Number.isFinite(coins) ? coins : 0 };
}

// ---------------------------------------------------------------------------
// Sunrise

export function sunriseTokens(g: GameState, s: StatBlock): number {
  if (g.runCoins < TUNING.sunriseMinCoins) return 0;
  return Math.floor(TUNING.sunriseTokenScale * Math.sqrt(g.runCoins / TUNING.sunriseMinCoins) * s.tokenGain);
}
