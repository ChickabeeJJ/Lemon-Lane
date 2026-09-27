import { describe, expect, it } from "vitest";
import { QUESTS, QUEST_IDS_V1, TUNING, WHEEL } from "../src/content/content";
import { buyUpgrade } from "../src/core/actions";
import { automatedRates, computeStats, rawLemonValue, upgradeCost } from "../src/core/economy";
import { createRng } from "../src/core/rng";
import { harvestFruit, sellLemons, step, syncTrees, treeSlotActive, type SimContext, type SimEvent } from "../src/core/sim";
import { HOME_TREE_SLOTS, SAVE_SCHEMA, createFreshState, createSession, type GameState } from "../src/core/state";
import { spinCooldownLeft, spinWheel } from "../src/core/wheel";
import { MIGRATIONS, SaveManager, SAVE_KEY, migrate, type KeyValueStore } from "../src/save/SaveManager";

function ctxFor(g: GameState, events: SimEvent[] = [], seed = 5): SimContext {
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

describe("Sell Crate", () => {
  it("does nothing until built", () => {
    const g = createFreshState(0);
    g.lemons = 5;
    expect(sellLemons(g, ctxFor(g), "player")).toBe(0);
    expect(g.lemons).toBe(5);
  });

  it("sells every lemon once and counts them", () => {
    const g = createFreshState(0);
    g.upgrades.sell_crate = 1;
    g.lemons = 6;
    const each = rawLemonValue(g, computeStats(g), 0);
    const earned = sellLemons(g, ctxFor(g), "player");
    expect(earned).toBeCloseTo(6 * each, 1);
    expect(g.lemons).toBe(0);
    expect(g.lifetime.lemonsSold).toBe(6);
    expect(sellLemons(g, ctxFor(g), "player")).toBe(0);
  });

  it("pays less per lemon than a drink, so drinks stay the better use when customers wait", () => {
    const g = createFreshState(0);
    g.upgrades.sell_crate = 1;
    const s = computeStats(g);
    expect(rawLemonValue(g, s, 0)).toBeLessThan(5);
  });
});

describe("Lemon Chute", () => {
  it("sells picked lemons when the basket is full instead of blocking", () => {
    const g = createFreshState(0);
    g.upgrades.sell_crate = 1;
    g.regions = ["tiny_yard", "sunny_lane"];
    const ctx = ctxFor(g);
    g.lemons = computeStats(g).basketCap;
    g.trees[0][0] = { g: 1, golden: false };
    expect(harvestFruit(g, ctx, 0, 0, "player")).toBe(false);
    g.upgrades.lemon_chute = 1;
    const coins = g.coins;
    expect(harvestFruit(g, ctx, 0, 0, "player")).toBe(true);
    expect(g.coins).toBeGreaterThan(coins);
    expect(g.lemons).toBe(computeStats(g).basketCap);
    expect(g.lifetime.lemonsSold).toBe(1);
  });
});

describe("diamond lemons", () => {
  it("pay far more than golden lemons, exactly once", () => {
    const g = createFreshState(0);
    const ctx = ctxFor(g);
    g.trees[0][0] = { g: 1, golden: true };
    harvestFruit(g, ctx, 0, 0, "player");
    const golden = g.coins;
    g.coins = 0;
    g.trees[0][1] = { g: 1, golden: false, diamond: true };
    harvestFruit(g, ctx, 0, 1, "player");
    expect(g.coins / golden).toBeCloseTo(TUNING.diamondValueDrinks / TUNING.goldenValueDrinks, 5);
    expect(g.lifetime.diamondHarvested).toBe(1);
  });
});

describe("Orchard Grove", () => {
  it("plants a grove tree per Tree Plot level", () => {
    const g = createFreshState(0);
    const ctx = ctxFor(g);
    syncTrees(g, ctx);
    expect(g.trees.filter((t) => t.length > 0).length).toBe(1);
    g.coins = 1e9;
    buyUpgrade(g, "grove_plot", computeStats(g));
    buyUpgrade(g, "grove_plot", computeStats(g));
    syncTrees(g, ctx);
    expect(treeSlotActive(HOME_TREE_SLOTS, computeStats(g))).toBe(true);
    expect(treeSlotActive(HOME_TREE_SLOTS + 1, computeStats(g))).toBe(true);
    expect(treeSlotActive(HOME_TREE_SLOTS + 2, computeStats(g))).toBe(false);
    expect(g.trees[HOME_TREE_SLOTS].length).toBeGreaterThan(0);
    expect(g.trees[HOME_TREE_SLOTS + 2].length).toBe(0);
  });

  it("more trees means more automated lemons", () => {
    const g = createFreshState(0);
    g.helpers = { pip: 15 };
    const before = automatedRates(g, computeStats(g), 0).lemonsPerSec;
    g.upgrades.grove_plot = 3;
    expect(automatedRates(g, computeStats(g), 0).lemonsPerSec).toBeGreaterThan(before);
  });
});

describe("Lucky Wheel", () => {
  it("needs the wheel, then respects its cooldown", () => {
    const g = createFreshState(0);
    const s = computeStats(g);
    const rng = createRng(3);
    expect(spinWheel(g, s, rng, 1000, 10)).toBeNull();
    g.upgrades.lucky_wheel = 1;
    const s2 = computeStats(g);
    const r = spinWheel(g, s2, rng, 1000, 10);
    expect(r).not.toBeNull();
    expect(r!.segment).toBeGreaterThanOrEqual(0);
    expect(r!.segment).toBeLessThan(WHEEL.length);
    expect(spinWheel(g, s2, rng, 2000, 10)).toBeNull();
    expect(spinCooldownLeft(g, s2, 2000)).toBeGreaterThan(0);
    expect(spinWheel(g, s2, rng, 1000 + s2.wheelCooldown * 1000, 10)).not.toBeNull();
    expect(g.lifetime.wheelSpins).toBe(2);
  });

  it("every segment gives a real, finite reward", () => {
    for (let seed = 1; seed < 60; seed++) {
      const g = createFreshState(0);
      g.upgrades.lucky_wheel = 1;
      const s = computeStats(g);
      const r = spinWheel(g, s, createRng(seed), 1, Number.NaN)!;
      expect(Number.isFinite(r.amount)).toBe(true);
      expect(Number.isFinite(g.coins)).toBe(true);
    }
  });

  it("gets faster with levels", () => {
    const g = createFreshState(0);
    g.upgrades.lucky_wheel = 1;
    const slow = computeStats(g).wheelCooldown;
    g.upgrades.lucky_wheel = 5;
    expect(computeStats(g).wheelCooldown).toBeLessThan(slow);
  });
});

describe("Lemonade Fountain", () => {
  it("earns coins with no player input", () => {
    const g = createFreshState(0);
    g.upgrades.fountain = 3;
    const s = createSession();
    const events: SimEvent[] = [];
    const ctx = ctxFor(g, events);
    s.arrivalTimer = 1e9; // no customers, isolate the fountain
    for (let i = 0; i < 40; i++) step(g, s, 0.25, ctx);
    expect(events.some((e) => e.type === "fountain")).toBe(true);
    expect(g.coins).toBeGreaterThan(0);
  });
});

describe("facility purchases", () => {
  it("are locked by region like any upgrade", () => {
    const g = createFreshState(0);
    g.coins = 1e9;
    expect(buyUpgrade(g, "juice_factory", computeStats(g))).toEqual({ ok: false, reason: "locked" });
    expect(buyUpgrade(g, "sell_crate", computeStats(g)).ok).toBe(true);
    expect(upgradeCost(g, "sell_crate", computeStats(g))).toBeGreaterThan(40);
  });
});

describe("save migration 1 → 2", () => {
  it("remaps goal progress by ID and adds the wheel timer", () => {
    const oldIdx = QUEST_IDS_V1.indexOf("q_sunny_lane");
    const out = migrate({ schema: 1, savedAt: 1, state: { quest: { index: oldIdx, baseline: 3 }, coins: 5 } }, MIGRATIONS, 2)!;
    const st = out.state as { quest: { index: number; baseline: number }; lastSpinAt: number; coins: number };
    expect(QUESTS[st.quest.index].id).toBe("q_sunny_lane");
    expect(st.quest.baseline).toBe(3);
    expect(st.lastSpinAt).toBe(0);
    expect(st.coins).toBe(5);
  });

  it("maps finished chains onto generated goals", () => {
    const out = migrate({ schema: 1, savedAt: 1, state: { quest: { index: QUEST_IDS_V1.length + 4 } } }, MIGRATIONS, 2)!;
    expect((out.state as { quest: { index: number } }).quest.index).toBe(QUESTS.length + 4);
  });

  it("loads a real v1 save end to end", () => {
    const map = new Map<string, string>();
    const store: KeyValueStore = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
    const v1 = { schema: 1, savedAt: 10, state: { coins: 42, trees: [[{ g: 1, golden: false }]], quest: { index: 3 }, regions: ["tiny_yard"] } };
    map.set(SAVE_KEY, JSON.stringify(v1));
    const r = new SaveManager(store).load(100);
    expect(r.status).toBe("loaded");
    expect(r.state.schema).toBe(SAVE_SCHEMA);
    expect(r.state.coins).toBe(42);
    expect(QUESTS[r.state.quest.index].id).toBe("q_hire_pip");
    expect(r.state.trees[0][0].diamond).toBe(false);
  });
});
