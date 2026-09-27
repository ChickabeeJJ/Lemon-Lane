// Layout guard: nothing in a zone may overlap — buildings, grove trees, construction outlines and
// their signs — in any combination that can be on screen at the same time.
import { describe, expect, it } from "vitest";
import { FACILITY_IDS, upgradeById } from "../src/content/content";
import { nameOf } from "../src/content/strings";
import type { UpgradeId } from "../src/content/types";
import {
  ATTACHED,
  FACILITY_SPOTS,
  GROVE_TREES,
  GROUND_Y,
  LAYOUT,
  WORLD_W,
  constructionSignRect,
  groveTreeRect,
  grovePlotSpot,
  rectsOverlap,
  spotRect,
  type FacilitySpotId,
  type Rect,
} from "../src/core/layout";

interface Item {
  name: string;
  rect: Rect;
  owner?: string;
}

/** Longest sign text a facility can show (locked label or a 7-character price). */
function worstSign(id: UpgradeId, spot = FACILITY_SPOTS[id as FacilitySpotId]): Rect {
  const def = upgradeById.get(id)!;
  const title = nameOf("upgrade", id);
  const locked = `Needs ${nameOf("region", def.region)}`;
  const build = "Build · 999.99K";
  const line2 = locked.length > build.length ? locked : build;
  return constructionSignRect(spot, title, line2);
}

function zoneOf(x: number): number {
  return Math.floor(x / WORLD_W);
}

const PAD = 4;

describe("zone layout", () => {
  const facilities = FACILITY_IDS.map((id) => ({ id, spot: FACILITY_SPOTS[id as FacilitySpotId] }));

  it("gives every facility a footprint", () => {
    for (const { id, spot } of facilities) expect(spot, id).toBeDefined();
  });

  it("keeps every facility inside its own zone", () => {
    for (const { id, spot } of facilities) {
      const r = spotRect(spot);
      expect(zoneOf(r.x), id).toBe(zoneOf(r.x + r.w - 1));
      const sign = worstSign(id);
      expect(zoneOf(sign.x), `${id} sign`).toBe(zoneOf(sign.x + sign.w - 1));
    }
  });

  it("never overlaps two buildings, trees or signs", () => {
    const solids: Item[] = [
      ...facilities.map(({ id, spot }) => ({ name: id, rect: spotRect(spot), owner: id })),
      ...GROVE_TREES.map((_, j) => ({ name: `grove tree ${j}`, rect: groveTreeRect(j), owner: `plot${j}` })),
    ];
    const signs: Item[] = [
      ...facilities.map(({ id }) => ({ name: `${id} sign`, rect: worstSign(id), owner: id })),
      ...GROVE_TREES.map((_, j) => ({ name: `plot ${j} sign`, rect: worstSign("grove_plot", grovePlotSpot(j)), owner: `plot${j}` })),
    ];
    const attached = new Set(ATTACHED.map(([a, b]) => [a, b].sort().join("|")));
    const problems: string[] = [];
    const all = [...solids, ...signs];
    for (let i = 0; i < all.length; i++) {
      for (let k = i + 1; k < all.length; k++) {
        const a = all[i];
        const b = all[k];
        if (a.owner && a.owner === b.owner) continue; // a sign over its own outline is the point
        if (a.owner && b.owner && attached.has([a.owner, b.owner].sort().join("|"))) continue;
        // Plot j's sign only exists while plot j is empty; later plots are empty mounds (no tree).
        const plotSign = (x: Item) => /^plot (\d) sign$/.exec(x.name)?.[1];
        const tree = (x: Item) => /^grove tree (\d)$/.exec(x.name)?.[1];
        const ps = plotSign(a) ?? plotSign(b);
        const tr = tree(a) ?? tree(b);
        if (ps !== undefined && tr !== undefined && Number(tr) >= Number(ps)) continue;
        // Only one grove plot sign is ever shown at a time.
        if (plotSign(a) !== undefined && plotSign(b) !== undefined) continue;
        if (rectsOverlap(a.rect, b.rect, PAD)) problems.push(`${a.name} ↔ ${b.name}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("keeps the stand zone's stations apart", () => {
    const stand = LAYOUT.stand;
    const counter: Rect = { x: stand.x - stand.w / 2 - 12, y: GROUND_Y - 112, w: stand.w + 24, h: 112 };
    const awning: Rect = { x: stand.x - stand.w / 2 - 25, y: GROUND_Y - 320, w: stand.w + 50, h: 130 };
    const press: Rect = { x: LAYOUT.press.x - 52, y: GROUND_Y - 150, w: 116, h: 150 };
    // Basket at its biggest (max level) including the lemon pile and handle.
    const basket: Rect = { x: LAYOUT.basket.x - 62, y: GROUND_Y - 106, w: 124, h: 106 };
    const pairs: [string, Rect, string, Rect][] = [
      ["counter", counter, "press", press],
      ["awning", awning, "press", press],
      ["basket", basket, "press", press],
      ["basket", basket, "counter", counter],
    ];
    for (const [an, a, bn, b] of pairs) expect(rectsOverlap(a, b, 2), `${an} ↔ ${bn}`).toBe(false);
    // The queue starts right of the stand.
    expect(LAYOUT.queueFrontX - 30).toBeGreaterThan(stand.x + stand.w / 2);
  });
});
