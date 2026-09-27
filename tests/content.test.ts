// Content validator: duplicate IDs, missing references, impossible costs, missing strings,
// invalid effect stats. Run with `npm run validate` (also part of `npm test`).
import { describe, expect, it } from "vitest";
import {
  COSMETICS,
  CUSTOMERS,
  HELPERS,
  PERKS,
  QUESTS,
  RECIPES,
  REGIONS,
  STAT_BASE,
  UPGRADES,
  helperById,
  recipeById,
  regionById,
  upgradeById,
} from "../src/content/content";
import { EN } from "../src/content/strings";
import type { Effect } from "../src/content/types";

const families = [
  ["upgrade", UPGRADES],
  ["recipe", RECIPES],
  ["customer", CUSTOMERS],
  ["helper", HELPERS],
  ["region", REGIONS],
  ["perk", PERKS],
  ["cosmetic", COSMETICS],
] as const;

const finitePositive = (n: number) => Number.isFinite(n) && n > 0;

describe("content", () => {
  it("has unique IDs within each family", () => {
    for (const [, list] of families) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const qids = QUESTS.map((q) => q.id);
    expect(new Set(qids).size).toBe(qids.length);
  });

  it("has name and description strings for every item", () => {
    const missing: string[] = [];
    for (const [fam, list] of families) {
      for (const item of list) {
        for (const k of ["name", "desc"]) if (!EN[`${fam}.${item.id}.${k}`]) missing.push(`${fam}.${item.id}.${k}`);
      }
    }
    for (const q of QUESTS) if (!EN[`quest.${q.kind}`]) missing.push(`quest.${q.kind}`);
    for (const s of Object.keys(STAT_BASE)) if (!EN[`stat.${s}`]) missing.push(`stat.${s}`);
    expect(missing).toEqual([]);
  });

  it("uses only known stats in effects", () => {
    const all: Effect[] = [...UPGRADES, ...HELPERS, ...PERKS, ...REGIONS].flatMap((x) => x.effects);
    for (const e of all) {
      expect(Object.keys(STAT_BASE)).toContain(e.stat);
      expect(e.add !== undefined || e.pct !== undefined).toBe(true);
      if (e.add !== undefined) expect(Number.isFinite(e.add)).toBe(true);
      if (e.pct !== undefined) expect(Number.isFinite(e.pct)).toBe(true);
    }
  });

  it("has sane costs and levels", () => {
    for (const u of UPGRADES) {
      expect(finitePositive(u.baseCost)).toBe(true);
      expect(u.growth).toBeGreaterThan(1);
      expect(Number.isInteger(u.maxLevel) && u.maxLevel > 0).toBe(true);
    }
    for (const h of HELPERS) {
      expect(finitePositive(h.hireCost)).toBe(true);
      expect(h.growth).toBeGreaterThan(1);
      if (h.action !== "none") expect(h.interval).toBeGreaterThan(0);
    }
    for (const p of PERKS) {
      expect(finitePositive(p.baseCost)).toBe(true);
      expect(p.growth).toBeGreaterThanOrEqual(1);
    }
    for (const r of RECIPES) {
      expect(r.lemons).toBeGreaterThan(0);
      expect(r.pressTime).toBeGreaterThan(0);
      expect(finitePositive(r.value)).toBe(true);
      if (r.id !== "classic") expect(finitePositive(r.unlockCost)).toBe(true);
    }
    for (const c of CUSTOMERS) {
      expect(c.patience).toBeGreaterThan(0);
      expect(c.order).toBeGreaterThan(0);
      expect(c.weight).toBeGreaterThan(0);
    }
  });

  it("references only existing content", () => {
    for (const u of UPGRADES) expect(regionById.has(u.region)).toBe(true);
    for (const r of RECIPES) expect(regionById.has(r.region)).toBe(true);
    for (const h of HELPERS) expect(regionById.has(h.region)).toBe(true);
    for (const c of CUSTOMERS) {
      expect(regionById.has(c.region)).toBe(true);
      expect(recipeById.has(c.favorite)).toBe(true);
    }
    for (const q of QUESTS) {
      expect(q.target).toBeGreaterThan(0);
      if (q.ref) {
        const known = upgradeById.has(q.ref as never) || helperById.has(q.ref as never) || regionById.has(q.ref as never) || recipeById.has(q.ref as never);
        expect(known, q.id).toBe(true);
      }
    }
  });

  it("orders regions with increasing costs, starting free", () => {
    const sorted = [...REGIONS].sort((a, b) => a.sort - b.sort);
    expect(sorted[0].id).toBe("tiny_yard");
    expect(sorted[0].cost).toBe(0);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].cost).toBeGreaterThan(sorted[i - 1].cost);
  });

  it("keeps every cosmetic reachable", () => {
    const maxStars = CUSTOMERS.length + RECIPES.length + REGIONS.length;
    for (const c of COSMETICS) expect(c.stars).toBeLessThanOrEqual(maxStars);
    expect(COSMETICS.some((c) => c.stars === 0)).toBe(true);
  });
});
