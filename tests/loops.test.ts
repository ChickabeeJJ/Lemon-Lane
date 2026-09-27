import { describe, expect, it } from "vitest";
import { QUESTS, QUEST_IDS_V2, TUNING } from "../src/content/content";
import { acceptContract, deliverContract, expireContract, refreshOffers, streakMultiplier } from "../src/core/contracts";
import { baseDrinkValue, computeStats, demandMultiplier, demandRecipe, incomeMultiplier } from "../src/core/economy";
import { createRng } from "../src/core/rng";
import { isPerfectMoment, serveFront, squeeze, squeezeMeter, step, type SimContext, type SimEvent } from "../src/core/sim";
import { performSunrise } from "../src/core/actions";
import { createFreshState, createSession, type GameState, type SessionState } from "../src/core/state";
import { MIGRATIONS, migrate } from "../src/save/SaveManager";

function ctxFor(g: GameState, events: SimEvent[] = []): SimContext {
  return {
    get stats() {
      return computeStats(g);
    },
    rng: createRng(9),
    now: 0,
    emit: (e) => events.push(e),
  };
}

/** Advance the session clock to the next moment the gauge is (or isn't) in the gold. */
function seekMeter(s: SessionState, perfect: boolean): void {
  for (let i = 0; i < 2000 && isPerfectMoment(s) !== perfect; i++) s.time += 0.005;
}

describe("Perfect Squeeze", () => {
  it("the gauge sweeps 0..1 deterministically", () => {
    const s = createSession();
    const seen: number[] = [];
    for (let i = 0; i < 400; i++) {
      s.time = i * 0.02;
      seen.push(squeezeMeter(s));
    }
    expect(Math.min(...seen)).toBeLessThan(0.01);
    expect(Math.max(...seen)).toBeGreaterThan(0.99);
  });

  it("a squeeze in the gold makes a Perfect drink; outside it does not", () => {
    const g = createFreshState(0);
    g.lemons = 10;
    const s = createSession();
    const ctx = ctxFor(g);
    seekMeter(s, false);
    squeeze(g, s, ctx);
    squeeze(g, s, ctx);
    squeeze(g, s, ctx);
    expect(g.drinks).toBe(1);
    expect(g.perfectDrinks).toBe(0);
    seekMeter(s, true);
    squeeze(g, s, ctx);
    squeeze(g, s, ctx);
    expect(g.drinks).toBe(2);
    expect(g.perfectDrinks).toBe(1);
    expect(g.lifetime.perfectSqueezes).toBeGreaterThanOrEqual(1);
  });

  it("Perfect drinks are served first and pay the bonus", () => {
    const g = createFreshState(0);
    const s = createSession();
    const events: SimEvent[] = [];
    const ctx = ctxFor(g, events);
    for (let i = 0; i < 40 && !s.customers.some((c) => c.phase === "waiting"); i++) step(g, s, 0.25, ctx);
    g.drinks = 2;
    g.perfectDrinks = 1;
    serveFront(g, s, ctx, "player");
    const sale = events.find((e) => e.type === "sale");
    expect(sale && sale.type === "sale" && sale.perfect).toBe(true);
    expect(g.perfectDrinks).toBe(0);
    expect(g.perfectDrinks).toBeLessThanOrEqual(g.drinks);
  });
});

describe("Market Demand", () => {
  it("needs at least two recipes to choose between", () => {
    const g = createFreshState(0);
    expect(demandRecipe(g, Date.UTC(2026, 0, 1))).toBeNull();
    g.regions = ["tiny_yard", "sunny_lane"];
    expect(demandRecipe(g, Date.UTC(2026, 0, 1))).not.toBeNull();
  });

  it("is stable within a slot, rotates across slots, and never applies offline (now = 0)", () => {
    const g = createFreshState(0);
    g.regions = ["tiny_yard", "sunny_lane", "picnic_corner"];
    const t0 = Date.UTC(2026, 3, 1, 12, 0, 0);
    const slot = TUNING.demandMinutes * 60_000;
    expect(demandRecipe(g, t0)?.id).toBe(demandRecipe(g, t0 + slot - 1 - (t0 % slot))?.id);
    const ids = new Set(Array.from({ length: 30 }, (_, i) => demandRecipe(g, t0 + i * slot)?.id));
    expect(ids.size).toBeGreaterThan(1);
    expect(demandRecipe(g, 0)).toBeNull();
  });

  it("boosts only the hot recipe", () => {
    const g = createFreshState(0);
    g.regions = ["tiny_yard", "sunny_lane"];
    g.recipes = ["classic", "honey_lemon"];
    const t0 = Date.UTC(2026, 3, 1);
    const hot = demandRecipe(g, t0)!;
    g.activeRecipe = hot.id;
    expect(demandMultiplier(g, t0)).toBe(1 + TUNING.demandBonus);
    const s = computeStats(g);
    const hotValue = baseDrinkValue(g, s, t0);
    expect(hotValue).toBeCloseTo(hot.value * incomeMultiplier(g, s, t0) * (1 + TUNING.demandBonus), 5);
    g.activeRecipe = hot.id === "classic" ? "honey_lemon" : "classic";
    expect(demandMultiplier(g, t0)).toBe(1);
  });
});

describe("Order Board", () => {
  function boardGame(): GameState {
    const g = createFreshState(0);
    g.upgrades.order_board = 1;
    return g;
  }

  it("offers nothing until the board is built", () => {
    const g = createFreshState(0);
    expect(refreshOffers(g, computeStats(g), createRng(1), 1000)).toBe(false);
    expect(g.contract.offers).toEqual([]);
  });

  it("creates three offers of rising size and reward", () => {
    const g = boardGame();
    expect(refreshOffers(g, computeStats(g), createRng(1), 1000)).toBe(true);
    const [a, b, c] = g.contract.offers;
    expect(g.contract.offers).toHaveLength(3);
    expect(a.count).toBeLessThan(c.count);
    expect(a.reward).toBeLessThan(b.reward);
    expect(b.reward).toBeLessThan(c.reward);
    // Not again until rotation.
    expect(refreshOffers(g, computeStats(g), createRng(2), 2000)).toBe(false);
  });

  it("delivers in parts, needs the right recipe, pays once with streak bonus", () => {
    const g = boardGame();
    refreshOffers(g, computeStats(g), createRng(1), 1000);
    expect(acceptContract(g, 0, 1000)).toBe(true);
    expect(acceptContract(g, 1, 1000)).toBe(false);
    const a = g.contract.active!;
    g.activeRecipe = a.recipe === "classic" ? "classic" : a.recipe;
    g.recipes = [a.recipe, "classic"];
    g.drinks = 0;
    expect(deliverContract(g, 2000)).toEqual({ ok: false, reason: "noDrinks" });
    g.drinks = a.count - 1;
    g.perfectDrinks = 1;
    const part = deliverContract(g, 2000);
    expect(part.ok && !part.completed).toBe(true);
    expect(g.perfectDrinks).toBe(0);
    g.drinks = 5;
    g.contract.streak = 2;
    const before = g.coins;
    const done = deliverContract(g, 3000);
    expect(done.ok && done.completed).toBe(true);
    expect(g.coins - before).toBeCloseTo(a.reward * (1 + 2 * TUNING.contractStreakStep), 0);
    expect(g.drinks).toBe(4);
    expect(g.contract.active).toBeNull();
    expect(g.contract.streak).toBe(3);
    expect(g.lifetime.contractsDone).toBe(1);
    expect(deliverContract(g, 3000)).toEqual({ ok: false, reason: "none" });
  });

  it("refuses the wrong recipe", () => {
    const g = boardGame();
    g.recipes = ["classic"];
    refreshOffers(g, computeStats(g), createRng(1), 1000);
    acceptContract(g, 0, 1000);
    g.activeRecipe = "honey_lemon";
    g.drinks = 3;
    expect(deliverContract(g, 1500)).toEqual({ ok: false, reason: "wrongRecipe" });
  });

  it("expires gently: streak resets, nothing else lost", () => {
    const g = boardGame();
    refreshOffers(g, computeStats(g), createRng(1), 1000);
    acceptContract(g, 2, 1000);
    g.contract.streak = 4;
    g.coins = 50;
    const end = g.contract.expiresAt;
    expect(expireContract(g, end - 1)).toBe(false);
    expect(expireContract(g, end)).toBe(true);
    expect(g.contract.streak).toBe(0);
    expect(g.coins).toBe(50);
    expect(streakMultiplier(g)).toBe(1);
  });

  it("Sunrise clears orders but keeps the streak", () => {
    const g = boardGame();
    refreshOffers(g, computeStats(g), createRng(1), 1000);
    acceptContract(g, 0, 1000);
    g.contract.streak = 3;
    g.runCoins = TUNING.sunriseMinCoins;
    g.perfectDrinks = 2;
    g.drinks = 2;
    performSunrise(g, 5000);
    expect(g.contract.active).toBeNull();
    expect(g.contract.offers).toEqual([]);
    expect(g.contract.streak).toBe(3);
    expect(g.perfectDrinks).toBe(0);
  });
});

describe("save migration 2 → 3", () => {
  it("remaps goals by ID and adds empty loop state", () => {
    const idx = QUEST_IDS_V2.indexOf("q_plot");
    const out = migrate({ schema: 2, savedAt: 1, state: { quest: { index: idx }, coins: 9 } }, MIGRATIONS, 3)!;
    const st = out.state as { quest: { index: number }; perfectDrinks: number; coins: number };
    expect(QUESTS[st.quest.index].id).toBe("q_plot");
    expect(st.perfectDrinks).toBe(0);
    expect(st.coins).toBe(9);
  });
});
