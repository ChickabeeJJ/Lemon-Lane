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
  basket: { x: 330, y: GROUND_Y + 40 },
  press: { x: 450, y: GROUND_Y },
  stand: { x: 640, y: GROUND_Y, w: 250 },
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

/** Orchard Grove plot positions (zone index -1 spans x -1200..0). */
export const GROVE_TREES = [
  { x: -1040, y: GROUND_Y + 8, scale: 0.82 },
  { x: -870, y: GROUND_Y - 34, scale: 0.7 },
  { x: -700, y: GROUND_Y + 8, scale: 0.82 },
  { x: -530, y: GROUND_Y - 34, scale: 0.7 },
  { x: -360, y: GROUND_Y + 8, scale: 0.82 },
  { x: -190, y: GROUND_Y - 34, scale: 0.7 },
] as const;

/** Tree slot → position. Slots 0–4 are beside the stand, 5–10 are grove plots. */
export function treeSpot(i: number): { x: number; y: number; scale: number } {
  return i < LAYOUT.trees.length ? LAYOUT.trees[i] : GROVE_TREES[i - LAYOUT.trees.length] ?? GROVE_TREES[0];
}

/** Facility footprints: anchor at bottom-center, w/h used for hit testing and construction outlines. */
export const FACILITY_SPOTS = {
  beehive: { x: -1150, y: GROUND_Y + 10, w: 80, h: 190 },
  sprinkler: { x: -275, y: GROUND_Y + 80, w: 80, h: 90 },
  sell_crate: { x: 1400, y: GROUND_Y + 40, w: 190, h: 170 },
  lemon_chute: { x: 1560, y: GROUND_Y + 30, w: 90, h: 250 },
  juice_factory: { x: 1920, y: GROUND_Y + 10, w: 320, h: 320 },
  fountain: { x: 2620, y: GROUND_Y + 40, w: 260, h: 220 },
  lucky_wheel: { x: 2990, y: GROUND_Y + 40, w: 250, h: 330 },
  golden_statue: { x: 3330, y: GROUND_Y + 30, w: 170, h: 300 },
} as const;

export type FacilitySpotId = keyof typeof FACILITY_SPOTS;

/** Left edge (world x) of a zone slot. */
export function zoneLeft(index: number): number {
  return index * WORLD_W;
}
