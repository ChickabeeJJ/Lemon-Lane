// Order Board: timed bulk orders. Accept an offer, deliver drinks of the requested recipe from the
// counter before time runs out, and earn a big payout (bigger with a streak of successes).
import { CONTRACT_TIERS, TUNING, recipeById } from "../content/content";
import { recipeLocked } from "./actions";
import { incomeMultiplier, type StatBlock } from "./economy";
import type { Rng } from "./rng";
import { addCoins, clampPerfect } from "./sim";
import type { ContractOffer, GameState } from "./state";

export function boardOwned(g: GameState): boolean {
  return (g.upgrades.order_board ?? 0) > 0;
}

export function streakMultiplier(g: GameState): number {
  return 1 + TUNING.contractStreakStep * Math.min(TUNING.contractStreakMax, g.contract.streak);
}

/** Create fresh offers when the board is built, idle, and due. Returns true if offers changed. */
export function refreshOffers(g: GameState, s: StatBlock, rng: Rng, now: number): boolean {
  const c = g.contract;
  if (!boardOwned(g) || c.active) return false;
  if (now < c.refreshAt) return false;
  const usable = g.recipes.filter((id) => !recipeLocked(g, id));
  if (usable.length === 0) return false;
  const mult = incomeMultiplier(g, s, 0) * (1 + s.contractBonus);
  c.offers = CONTRACT_TIERS.map((tier, i) => {
    const recipe = usable[Math.floor(rng() * usable.length)];
    const def = recipeById.get(recipe)!;
    const count = tier.count[0] + Math.floor(rng() * (tier.count[1] - tier.count[0] + 1));
    const reward = Math.ceil(count * def.value * mult * tier.mult);
    return { recipe, count, seconds: tier.seconds, reward, tier: i } satisfies ContractOffer;
  });
  c.refreshAt = now + TUNING.contractRotateMinutes * 60_000;
  return true;
}

export function acceptContract(g: GameState, index: number, now: number): boolean {
  const c = g.contract;
  const offer = c.offers[index];
  if (!boardOwned(g) || c.active || !offer) return false;
  c.active = offer;
  c.delivered = 0;
  c.expiresAt = now + offer.seconds * 1000;
  c.offers = [];
  return true;
}

export type DeliverResult =
  | { ok: false; reason: "none" | "expired" | "wrongRecipe" | "noDrinks" }
  | { ok: true; delivered: number; completed: boolean; reward: number };

/** Move drinks of the requested recipe from the counter into the active order. */
export function deliverContract(g: GameState, now: number): DeliverResult {
  const c = g.contract;
  const a = c.active;
  if (!a) return { ok: false, reason: "none" };
  if (now >= c.expiresAt) return { ok: false, reason: "expired" };
  if (g.activeRecipe !== a.recipe) return { ok: false, reason: "wrongRecipe" };
  if (g.drinks <= 0) return { ok: false, reason: "noDrinks" };
  const n = Math.min(g.drinks, a.count - c.delivered);
  // Normal drinks go first; Perfect drinks are saved for customers who love them.
  const normal = g.drinks - g.perfectDrinks;
  g.drinks -= n;
  if (n > normal) g.perfectDrinks -= n - normal;
  clampPerfect(g);
  c.delivered += n;
  if (c.delivered < a.count) return { ok: true, delivered: n, completed: false, reward: 0 };
  const reward = addCoins(g, a.reward * streakMultiplier(g));
  c.streak = Math.min(c.streak + 1, 100);
  c.active = null;
  c.delivered = 0;
  c.expiresAt = 0;
  c.refreshAt = now + TUNING.contractCooldownSeconds * 1000;
  g.run.contractsDone++;
  g.lifetime.contractsDone++;
  return { ok: true, delivered: n, completed: true, reward };
}

/** Expire an overdue order (or give one up). The streak resets; nothing else is lost. */
export function expireContract(g: GameState, now: number, force = false): boolean {
  const c = g.contract;
  if (!c.active || (!force && now < c.expiresAt)) return false;
  c.active = null;
  c.delivered = 0;
  c.expiresAt = 0;
  c.streak = 0;
  c.refreshAt = now + TUNING.contractCooldownSeconds * 1000;
  return true;
}

export function contractSecondsLeft(g: GameState, now: number): number {
  return g.contract.active ? Math.max(0, (g.contract.expiresAt - now) / 1000) : 0;
}
