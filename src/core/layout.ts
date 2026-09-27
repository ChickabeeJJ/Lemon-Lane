// Shared world layout (logical units). The camera never moves; the canvas scales this box.
export const WORLD_W = 1200;
export const WORLD_H = 675;
export const GROUND_Y = 530;

export const LAYOUT = {
  /** Main tree plus extra trees unlocked by regions (index = tree number). */
  trees: [
    { x: 175, y: GROUND_Y, scale: 1 },
    { x: 60, y: GROUND_Y - 18, scale: 0.78 },
    { x: 300, y: GROUND_Y - 26, scale: 0.7 },
    { x: 410, y: GROUND_Y - 92, scale: 0.42 },
    { x: 500, y: GROUND_Y - 104, scale: 0.38 },
  ],
  basket: { x: 318, y: GROUND_Y + 40 },
  press: { x: 440, y: GROUND_Y },
  stand: { x: 650, y: GROUND_Y, w: 250 },
  queueFrontX: 830,
  queueSpacing: 72,
  spawnX: 1270,
  exitX: 1300,
  walkSpeed: 230,
  customerY: GROUND_Y + 22,
} as const;

export function queueSlotX(index: number): number {
  return LAYOUT.queueFrontX + index * LAYOUT.queueSpacing;
}

/** Orchard Grove plot positions (zone index -1 spans x -1200..0): one tidy row, no canopies touching. */
export const GROVE_TREES = [0, 1, 2, 3, 4, 5].map((j) => ({ x: -980 + j * 162, y: GROUND_Y - 10, scale: 0.66 }));

/** Tree slot → position. Slots 0–4 are beside the stand, 5–10 are grove plots. */
export function treeSpot(i: number): { x: number; y: number; scale: number } {
  return i < LAYOUT.trees.length ? LAYOUT.trees[i] : GROVE_TREES[i - LAYOUT.trees.length] ?? GROVE_TREES[0];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FacilitySpot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Raise (or lower, if negative) the construction sign relative to the default height. */
  signLift?: number;
}

/**
 * Facility footprints (bottom-center anchor). The footprint covers the whole built drawing, so
 * keeping footprints apart keeps buildings apart. tests/layout.test.ts enforces it.
 */
export const FACILITY_SPOTS = {
  beehive: { x: -1105, y: GROUND_Y + 10, w: 84, h: 190, signLift: -102 },
  sprinkler: { x: -580, y: GROUND_Y + 88, w: 80, h: 88 },
  sell_crate: { x: 1390, y: GROUND_Y + 40, w: 190, h: 280 },
  lemon_chute: { x: 1560, y: GROUND_Y + 30, w: 90, h: 270 },
  juice_factory: { x: 1920, y: GROUND_Y + 10, w: 320, h: 350 },
  order_board: { x: 2240, y: GROUND_Y + 36, w: 170, h: 230 },
  fountain: { x: 2660, y: GROUND_Y + 40, w: 260, h: 220 },
  lucky_wheel: { x: 3010, y: GROUND_Y + 40, w: 250, h: 330 },
  golden_statue: { x: 3330, y: GROUND_Y + 30, w: 170, h: 300 },
} satisfies Record<string, FacilitySpot>;

export type FacilitySpotId = keyof typeof FACILITY_SPOTS;

/** Facilities that are drawn attached to each other on purpose. */
export const ATTACHED: [FacilitySpotId, FacilitySpotId][] = [["lemon_chute", "sell_crate"]];

export function spotRect(f: FacilitySpot): Rect {
  return { x: f.x - f.w / 2, y: f.y - f.h, w: f.w, h: f.h };
}

/** Deterministic text width estimate (rounded bold font), so layout is testable without a canvas. */
export function estimateTextWidth(text: string, size: number): number {
  return text.length * size * 0.56;
}

export const SIGN_H = 58;

/** Where a construction sign sits for a footprint, sized to its two lines of text. */
export function constructionSignRect(f: FacilitySpot, title: string, line2: string): Rect {
  const w = Math.max(120, estimateTextWidth(title, 16) + 28, estimateTextWidth(line2, 13) + 44);
  const y = f.y - Math.min(f.h * 0.62, 190) - (f.signLift ?? 0);
  return { x: f.x - w / 2, y, w, h: SIGN_H };
}

/** Full-grown grove tree extents (canopy + trunk). */
export function groveTreeRect(j: number): Rect {
  const t = GROVE_TREES[j];
  const halfW = 116 * t.scale;
  const top = 270 * t.scale;
  return { x: t.x - halfW, y: t.y - top, w: halfW * 2, h: top };
}

/** The footprint used for the next grove plot's construction outline. */
export function grovePlotSpot(j: number): FacilitySpot {
  const t = GROVE_TREES[j];
  return { x: t.x, y: t.y + 10, w: 150, h: 200 };
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

/** Left edge (world x) of a zone slot. */
export function zoneLeft(index: number): number {
  return index * WORLD_W;
}
