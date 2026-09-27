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
