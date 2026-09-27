import { describe, expect, it } from "vitest";
import { computeStats } from "../src/core/economy";
import { createRng } from "../src/core/rng";
import { harvestFruit, harvestTree, serveFront, squeeze, step, type SimContext, type SimEvent } from "../src/core/sim";
import { createFreshState, createSession, type GameState } from "../src/core/state";
import { claimQuest, evaluateQuest, startQuest } from "../src/core/quests";
import { QUESTS } from "../src/content/content";

function makeCtx(g: GameState, events: SimEvent[] = [], seed = 1): SimContext {
  const rng = createRng(seed);
  return {
    get stats() {
      return computeStats(g);
    },
    rng,
    now: 0,
    emit: (e) => events.push(e),
  };
}

describe("harvesting (LL-TEST-003)", () => {
  it("harvests exactly at the growth boundary but not before", () => {
    const g = createFreshState(0);
    const ctx = makeCtx(g);
    g.trees[0][0] = { g: 0.99999, golden: false };
    expect(harvestFruit(g, ctx, 0, 0, "player")).toBe(false);
    g.trees[0][0] = { g: 1, golden: false };
    expect(harvestFruit(g, ctx, 0, 0, "player")).toBe(true);
    expect(g.lemons).toBe(1);
    expect(g.trees[0][0].g).toBe(0);
  });

  it("stops at basket capacity", () => {
    const g = createFreshState(0);
    const events: SimEvent[] = [];
    const ctx = makeCtx(g, events);
    g.lemons = computeStats(g).basketCap;
    g.trees[0].forEach((f) => (f.g = 1));
    expect(harvestTree(g, ctx, 0)).toBe(0);
    expect(events.some((e) => e.type === "basketFull")).toBe(true);
  });

  it("pays a bonus for golden lemons exactly once", () => {
    const g = createFreshState(0);
    const ctx = makeCtx(g);
    g.trees[0][0] = { g: 1, golden: true };
    harvestFruit(g, ctx, 0, 0, "player");
    const coins = g.coins;
    expect(coins).toBeGreaterThan(0);
    expect(harvestFruit(g, ctx, 0, 0, "player")).toBe(false);
    expect(g.coins).toBe(coins);
  });
});

describe("press and serving", () => {
  it("squeezing turns lemons into drinks and respects counter space", () => {
    const g = createFreshState(0);
    const ctx = makeCtx(g);
    g.lemons = 10;
    const s = createSession();
    for (let i = 0; i < 20; i++) squeeze(g, s, ctx);
    expect(g.drinks).toBe(computeStats(g).counterCap);
    expect(g.lemons).toBe(10 - g.drinks);
  });

  it("cannot serve without drinks or customers", () => {
    const g = createFreshState(0);
    const s = createSession();
    const ctx = makeCtx(g);
    expect(serveFront(g, s, ctx, "player")).toBe(false);
    g.drinks = 1;
    expect(serveFront(g, s, ctx, "player")).toBe(false);
  });

  it("customers arrive, get served, pay once, and leave", () => {
    const g = createFreshState(0);
    const s = createSession();
    const events: SimEvent[] = [];
    const ctx = makeCtx(g, events);
    g.drinks = 3;
    for (let i = 0; i < 40 && !s.customers.some((c) => c.phase === "waiting"); i++) step(g, s, 0.25, ctx);
    expect(s.customers.some((c) => c.phase === "waiting")).toBe(true);
    const coins = g.coins;
    let owed = s.customers.find((c) => c.phase === "waiting")!.owed;
    while (owed-- > 0) expect(serveFront(g, s, ctx, "player")).toBe(true);
    expect(g.coins).toBeGreaterThan(coins);
    expect(g.lifetime.customersServed).toBe(1);
    expect(g.stickers.length).toBe(1);
  });

  it("impatient customers leave, reset the combo, and never pile up", () => {
    const g = createFreshState(0);
    const s = createSession();
    const events: SimEvent[] = [];
    const ctx = makeCtx(g, events);
    for (let i = 0; i < 4 * 600; i++) step(g, s, 0.25, ctx);
    expect(events.some((e) => e.type === "leave")).toBe(true);
    const queueCap = Math.floor(computeStats(g).queueSize);
    expect(s.customers.filter((c) => c.phase === "waiting" || c.phase === "arriving").length).toBeLessThanOrEqual(queueCap);
    expect(s.customers.length).toBeLessThan(queueCap + 6);
    expect(s.combo).toBe(0);
  });
});

describe("simulation", () => {
  it("is deterministic for the same seed", () => {
    const run = () => {
      const g = createFreshState(0);
      g.helpers = { pip: 3, roo: 3 };
      g.regions = ["tiny_yard", "sunny_lane"];
      const s = createSession();
      const ctx = makeCtx(g, [], 42);
      for (let i = 0; i < 2000; i++) step(g, s, 0.25, ctx);
      return [g.coins, g.lemons, g.drinks, g.lifetime.customersServed];
    };
    expect(run()).toEqual(run());
  });

  it("clamps huge and invalid time deltas", () => {
    const g = createFreshState(0);
    const s = createSession();
    const ctx = makeCtx(g);
    step(g, s, Number.NaN, ctx);
    step(g, s, -5, ctx);
    step(g, s, 1e9, ctx);
    expect(s.time).toBeLessThanOrEqual(10.0001);
    expect(Number.isFinite(g.coins)).toBe(true);
  });

  it("automation earns with no player input", () => {
    const g = createFreshState(0);
    g.helpers = { pip: 1, roo: 1 };
    g.regions = ["tiny_yard", "sunny_lane"];
    const s = createSession();
    const ctx = makeCtx(g);
    for (let i = 0; i < 4 * 120; i++) step(g, s, 0.25, ctx);
    expect(g.coins).toBeGreaterThan(0);
  });
});

describe("goals", () => {
  it("rewards a finished goal exactly once and advances", () => {
    const g = createFreshState(0);
    startQuest(g, 0);
    g.lifetime.lemonsHarvested = 3;
    expect(evaluateQuest(g).done).toBe(true);
    const stats = computeStats(g);
    const first = claimQuest(g, stats, 0);
    expect(first).toBe(QUESTS[0].reward);
    expect(g.quest.index).toBe(1);
    // Next goal (serve 2) is not done, so claiming again pays nothing.
    expect(claimQuest(g, stats, 0)).toBe(0);
  });

  it("uses a baseline so earlier progress does not count", () => {
    const g = createFreshState(0);
    g.lifetime.customersServed = 50;
    g.quest.index = 1; // serve 2
    startQuest(g, 0);
    expect(evaluateQuest(g).progress).toBe(0);
  });

  it("generates endless goals after the authored chain", () => {
    const g = createFreshState(0);
    g.quest.index = QUESTS.length;
    startQuest(g, 10);
    const q = evaluateQuest(g);
    expect(q.target).toBeGreaterThan(0);
    expect(q.reward).toBeGreaterThan(0);
  });
});
