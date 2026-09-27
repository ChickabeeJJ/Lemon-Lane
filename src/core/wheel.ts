// Lucky Wheel: a free, timed spin. No ads and no purchases involved.
import { TUNING, WHEEL } from "../content/content";
import type { WheelRewardKind } from "../content/types";
import { slotsOf, type StatBlock } from "./economy";
import { type Rng } from "./rng";
import { addCoins } from "./sim";
import type { GameState } from "./state";

export interface SpinResult {
  segment: number;
  kind: WheelRewardKind;
  amount: number;
}

export function wheelOwned(g: GameState): boolean {
  return (g.upgrades.lucky_wheel ?? 0) > 0;
}

/** Seconds until the next free spin (0 = ready). */
export function spinCooldownLeft(g: GameState, s: StatBlock, now: number): number {
  if (!wheelOwned(g)) return Infinity;
  if (g.lastSpinAt <= 0) return 0;
  return Math.max(0, (g.lastSpinAt + s.wheelCooldown * 1000 - now) / 1000);
}

/**
 * Spin the wheel and apply the reward atomically.
 * `incomePerSec` scales coin prizes so they stay meaningful all game long.
 */
export function spinWheel(g: GameState, s: StatBlock, rng: Rng, now: number, incomePerSec: number): SpinResult | null {
  if (spinCooldownLeft(g, s, now) > 0) return null;
  const total = WHEEL.reduce((a, w) => a + w.weight, 0);
  let r = rng() * total;
  let segment = WHEEL.length - 1;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i].weight;
    if (r < 0) {
      segment = i;
      break;
    }
  }
  const kind = WHEEL[segment].kind;
  const income = Number.isFinite(incomePerSec) ? Math.max(0, incomePerSec) : 0;
  let amount = 0;
  switch (kind) {
    case "coins":
      amount = addCoins(g, Math.max(TUNING.wheelMinCoins, income * TUNING.wheelCoinSeconds));
      break;
    case "bigCoins":
      amount = addCoins(g, Math.max(TUNING.wheelMinCoins * 4, income * TUNING.wheelBigCoinSeconds));
      break;
    case "lemons": {
      const cap = slotsOf(s.basketCap);
      amount = Math.max(0, cap - g.lemons);
      g.lemons = Math.max(g.lemons, cap);
      break;
    }
    case "drinks": {
      const cap = slotsOf(s.counterCap);
      amount = Math.max(0, cap - g.drinks);
      g.drinks = Math.max(g.drinks, cap);
      break;
    }
    case "ripen":
      for (const tree of g.trees) for (const f of tree) if (f.g < 1) (f.g = 1), amount++;
      break;
    case "rush":
      g.boostUntil = Math.max(now, g.boostUntil) + TUNING.wheelRushSeconds * 1000;
      amount = TUNING.wheelRushSeconds;
      break;
  }
  g.lastSpinAt = now;
  g.run.wheelSpins++;
  g.lifetime.wheelSpins++;
  return { segment, kind, amount };
}
