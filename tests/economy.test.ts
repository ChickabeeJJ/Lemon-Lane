import { describe, expect, it } from "vitest";
import { buyHelper, buyPerk, buyUpgrade, discoverRecipe, performSunrise, setActiveRecipe, unlockRegion } from "../src/core/actions";
import { computeStats, offlineEarnings, sunriseTokens, upgradeCost } from "../src/core/economy";
import { createFreshState } from "../src/core/state";
import { TUNING } from "../src/content/content";

describe("purchases (LL-TEST-001/002)", () => {
  it("buys with exact currency and ends at zero", () => {
    const g = createFreshState(0);
    const s = computeStats(g);
    const cost = upgradeCost(g, "lemon_tree", s);
    g.coins = cost;
    const r = buyUpgrade(g, "lemon_tree", s);
    expect(r.ok).toBe(true);
    expect(g.coins).toBe(0);
    expect(g.upgrades.lemon_tree).toBe(1);
  });

  it("rejects a purchase one coin short without changing anything", () => {
    const g = createFreshState(0);
    const s = computeStats(g);
    g.coins = upgradeCost(g, "lemon_tree", s) - 1;
    const before = JSON.stringify(g);
    const r = buyUpgrade(g, "lemon_tree", s);
    expect(r).toEqual({ ok: false, reason: "cost" });
    expect(JSON.stringify(g)).toBe(before);
  });

  it("rejects NaN/negative coin states instead of going negative", () => {
    const g = createFreshState(0);
    g.coins = Number.NaN;
    expect(buyUpgrade(g, "signboard", computeStats(g)).ok).toBe(false);
    g.coins = -5;
    expect(buyUpgrade(g, "signboard", computeStats(g)).ok).toBe(false);
  });

  it("refuses locked, maxed and unknown upgrades", () => {
    const g = createFreshState(0);
    g.coins = 1e12;
    expect(buyUpgrade(g, "ice_box", computeStats(g))).toEqual({ ok: false, reason: "locked" });
    g.upgrades.basket = 30;
    expect(buyUpgrade(g, "basket", computeStats(g))).toEqual({ ok: false, reason: "max" });
    expect(buyUpgrade(g, "nope" as never, computeStats(g))).toEqual({ ok: false, reason: "unknown" });
  });

  it("repeated clicks never double-apply", () => {
    const g = createFreshState(0);
    const s = computeStats(g);
    g.coins = upgradeCost(g, "signboard", s);
    buyUpgrade(g, "signboard", s);
    buyUpgrade(g, "signboard", s);
    expect(g.upgrades.signboard).toBe(1);
  });

  it("enforces helper seats", () => {
    const g = createFreshState(0);
    g.coins = 1e12;
    g.regions = ["tiny_yard", "sunny_lane", "picnic_corner"];
    const s = computeStats(g);
    expect(buyHelper(g, "pip", s).ok).toBe(true);
    expect(buyHelper(g, "roo", s).ok).toBe(true);
    expect(buyHelper(g, "basil", s)).toEqual({ ok: false, reason: "slots" });
    // Levelling an already-hired helper still works.
    expect(buyHelper(g, "pip", s).ok).toBe(true);
  });

  it("opens regions strictly in order", () => {
    const g = createFreshState(0);
    g.coins = 1e12;
    expect(unlockRegion(g, "picnic_corner")).toEqual({ ok: false, reason: "locked" });
    expect(unlockRegion(g, "sunny_lane").ok).toBe(true);
    expect(unlockRegion(g, "sunny_lane")).toEqual({ ok: false, reason: "owned" });
  });

  it("requires the region before discovering a recipe, and only switches to owned recipes", () => {
    const g = createFreshState(0);
    g.coins = 1e12;
    expect(discoverRecipe(g, "honey_lemon", computeStats(g)).ok).toBe(false);
    unlockRegion(g, "sunny_lane");
    expect(discoverRecipe(g, "honey_lemon", computeStats(g)).ok).toBe(true);
    expect(g.activeRecipe).toBe("honey_lemon");
    expect(setActiveRecipe(g, "mint_sparkle").ok).toBe(false);
    expect(setActiveRecipe(g, "classic").ok).toBe(true);
  });
});

describe("stats", () => {
  it("clamps multiplicative stats to their soft limits", () => {
    const g = createFreshState(0);
    g.upgrades.stand_counter = 30;
    g.regions = ["tiny_yard", "sunny_lane"];
    const s = computeStats(g);
    expect(s.queueSize).toBeLessThanOrEqual(6);
  });

  it("Bright Ideas lowers upgrade prices", () => {
    const g = createFreshState(0);
    const base = upgradeCost(g, "lemon_tree", computeStats(g));
    g.perks.bright_ideas = 5;
    expect(upgradeCost(g, "lemon_tree", computeStats(g))).toBeLessThan(base);
  });
});

describe("offline progress", () => {
  it("earns nothing without automation", () => {
    const g = createFreshState(0);
    expect(offlineEarnings(g, computeStats(g), 3600).coins).toBe(0);
  });

  it("earns with Pip and Roo, capped by the away limit", () => {
    const g = createFreshState(0);
    g.regions = ["tiny_yard", "sunny_lane"];
    g.helpers = { pip: 1, roo: 1 };
    const s = computeStats(g);
    const oneHour = offlineEarnings(g, s, 3600);
    const tenHours = offlineEarnings(g, s, 36000);
    expect(oneHour.coins).toBeGreaterThan(0);
    expect(tenHours.cappedSeconds).toBe(s.offlineCapHours * 3600);
    expect(tenHours.coins).toBe(offlineEarnings(g, s, s.offlineCapHours * 3600).coins);
  });

  it("handles NaN, negative and infinite durations", () => {
    const g = createFreshState(0);
    g.helpers = { pip: 1 };
    const s = computeStats(g);
    expect(offlineEarnings(g, s, Number.NaN).coins).toBe(0);
    expect(offlineEarnings(g, s, -100).coins).toBe(0);
    expect(Number.isFinite(offlineEarnings(g, s, Infinity).coins)).toBe(true);
  });
});

describe("Sunrise", () => {
  it("is unavailable before the coin threshold", () => {
    const g = createFreshState(0);
    g.runCoins = TUNING.sunriseMinCoins - 1;
    expect(sunriseTokens(g, computeStats(g))).toBe(0);
    expect(performSunrise(g, 0).ok).toBe(false);
  });

  it("resets temporary progress and preserves permanent progress", () => {
    const g = createFreshState(0);
    g.runCoins = TUNING.sunriseMinCoins * 4;
    g.coins = 123456;
    g.upgrades = { lemon_tree: 10, signboard: 4 };
    g.helpers = { pip: 3 };
    g.regions = ["tiny_yard", "sunny_lane", "picnic_corner"];
    g.recipes = ["classic", "honey_lemon", "mint_sparkle"];
    g.activeRecipe = "mint_sparkle";
    g.stickers = ["mochi_cat", "bun_rabbit"];
    g.cosmetic = "awning_mint";
    g.perks = { warm_soil: 2 };
    g.sunnyTokens = 3;
    g.lifetime.customersServed = 500;
    const r = performSunrise(g, 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tokens).toBe(6);
    expect(g.sunnyTokens).toBe(9);
    expect(g.sunrises).toBe(1);
    expect(g.coins).toBe(0);
    expect(g.upgrades).toEqual({});
    expect(g.helpers).toEqual({});
    expect(g.regions).toEqual(["tiny_yard"]);
    expect(g.activeRecipe).toBe("classic");
    expect(g.recipes).toEqual(["classic", "honey_lemon", "mint_sparkle"]);
    expect(g.stickers).toEqual(["mochi_cat", "bun_rabbit"]);
    expect(g.cosmetic).toBe("awning_mint");
    expect(g.perks).toEqual({ warm_soil: 2 });
    expect(g.lifetime.customersServed).toBe(500);
  });

  it("spends tokens on perks atomically", () => {
    const g = createFreshState(0);
    g.sunnyTokens = 1;
    expect(buyPerk(g, "warm_soil").ok).toBe(true);
    expect(g.sunnyTokens).toBe(0);
    expect(buyPerk(g, "warm_soil")).toEqual({ ok: false, reason: "cost" });
    expect(g.perks.warm_soil).toBe(1);
  });
});
