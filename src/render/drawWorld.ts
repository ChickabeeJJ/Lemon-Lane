// Zone backdrops and facility buildings for the explorable lane (Grove, Market, Fair).
// Same rules as draw.ts: palette colors, cocoa outlines, soft shadows, anchor = bottom-center.
import type { RecipeDef, WheelSegment } from "../content/types";
import { GROUND_Y, estimateTextWidth, type Rect } from "../core/layout";
import { drawDrink, drawLemon, ellipse, fillStroke, groundShadow, label, rrPath, star, drawCloud } from "./draw";
import { C } from "./palette";

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// Construction outline for anything not built yet

export type BuildState = "affordable" | "saving" | "locked";

export function drawConstruction(ctx: Ctx, x: number, y: number, w: number, h: number, sign: Rect, title: string, line2: string, state: BuildState, time: number, motion: boolean): void {
  const pulse = state === "affordable" && motion ? 0.5 + 0.5 * Math.sin(time * 4) : 0;
  // Ghost footprint
  ctx.save();
  rrPath(ctx, x - w / 2, y - h, w, h, 18);
  ctx.fillStyle = state === "locked" ? "rgba(255,244,214,0.22)" : `rgba(255,244,214,${0.4 + pulse * 0.2})`;
  ctx.fill();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = state === "affordable" ? C.leaf : "rgba(90,70,56,0.45)";
  ctx.stroke();
  ctx.restore();
  // Caution tape along the bottom
  ctx.save();
  rrPath(ctx, x - w / 2 + 6, y - 20, w - 12, 12, 4);
  ctx.clip();
  for (let i = -2; i < w / 14 + 2; i++) {
    ctx.beginPath();
    const bx = x - w / 2 + i * 14;
    ctx.moveTo(bx, y - 8);
    ctx.lineTo(bx + 7, y - 20);
    ctx.lineTo(bx + 14, y - 20);
    ctx.lineTo(bx + 7, y - 8);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? C.cocoa : C.lemon;
    ctx.fill();
  }
  ctx.restore();
  // Sign on a post (rect comes from layout so it's the same one the overlap tests check)
  const lift = pulse * 3;
  const postTop = sign.y + sign.h - 4;
  if (y - 20 > postTop) {
    rrPath(ctx, x - 4, postTop, 8, y - 20 - postTop, 3);
    fillStroke(ctx, C.woodDark, 2.5);
  }
  rrPath(ctx, sign.x, sign.y - lift, sign.w, sign.h, 12);
  fillStroke(ctx, state === "locked" ? "#EFE3C6" : C.wood, 3);
  label(ctx, title, x, sign.y + 17 - lift, 16, C.cocoa);
  rrPath(ctx, sign.x + 10, sign.y + 30 - lift, sign.w - 20, 22, 11);
  fillStroke(ctx, state === "affordable" ? C.leaf : state === "locked" ? C.cream : C.white, 2);
  label(ctx, line2, x + (state === "locked" ? 8 : 0), sign.y + 41.5 - lift, 13, C.cocoa);
  if (state === "locked") {
    // Small padlock inside the pill, left of the text
    const lx = x - estimateTextWidth(line2, 13) / 2 - 6;
    const ly = sign.y + 41 - lift;
    rrPath(ctx, lx - 6, ly - 3, 12, 9, 2);
    fillStroke(ctx, C.gold, 1.5);
    ctx.beginPath();
    ctx.arc(lx, ly - 3, 3.6, Math.PI, 0);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = C.cocoa;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Orchard Grove

export function drawGroveBackdrop(ctx: Ctx): void {
  // Rolling orchard rows in the distance
  ctx.fillStyle = "#B5E09A";
  ellipse(ctx, -600, GROUND_Y - 30, 700, 120);
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const x = -1160 + i * 95;
    const y = GROUND_Y - 95 - (i % 2) * 14;
    ctx.fillStyle = "#8CCB78";
    ellipse(ctx, x, y, 34, 28);
    ctx.fill();
    ctx.fillStyle = "#A7744F";
    ctx.fillRect(x - 3, y + 20, 6, 18);
  }
  // Back fence
  ctx.fillStyle = C.white;
  for (let x = -1195; x < -40; x += 26) {
    rrPath(ctx, x, GROUND_Y - 78, 12, 44, 4);
    fillStroke(ctx, C.white, 2);
  }
  rrPath(ctx, -1200, GROUND_Y - 66, 1160, 8, 3);
  fillStroke(ctx, C.white, 2);
  // Arch
  for (const px of [-760, -440]) {
    rrPath(ctx, px - 9, GROUND_Y - 250, 18, 212, 6);
    fillStroke(ctx, C.wood, 3);
    ellipse(ctx, px, GROUND_Y - 254, 14, 14);
    fillStroke(ctx, C.leaf, 3);
  }
  ctx.beginPath();
  ctx.moveTo(-790, GROUND_Y - 222);
  ctx.quadraticCurveTo(-600, GROUND_Y - 300, -410, GROUND_Y - 222);
  ctx.lineTo(-410, GROUND_Y - 184);
  ctx.quadraticCurveTo(-600, GROUND_Y - 262, -790, GROUND_Y - 184);
  ctx.closePath();
  fillStroke(ctx, C.cream, 3);
  label(ctx, "ORCHARD GROVE", -600, GROUND_Y - 228, 22, C.deepLeaf);
  for (let i = 0; i < 7; i++) drawLemon(ctx, -760 + i * 53, GROUND_Y - 186 - Math.sin((i / 6) * Math.PI) * 34, 6, C.lemon, i * 0.5);
}

export function drawEmptyPlot(ctx: Ctx, x: number, y: number, s: number, isNext: boolean, time: number, motion: boolean): void {
  groundShadow(ctx, x, y, 110 * s);
  ellipse(ctx, x, y - 6 * s, 56 * s, 16 * s);
  fillStroke(ctx, "#B98356", 3);
  ctx.fillStyle = "rgba(90,70,56,0.25)";
  for (let i = -2; i <= 2; i++) {
    ellipse(ctx, x + i * 18 * s, y - 8 * s, 4 * s, 2 * s);
    ctx.fill();
  }
  if (isNext) {
    const sway = motion ? Math.sin(time * 3) * 0.2 : 0;
    ctx.save();
    ctx.translate(x, y - 12 * s);
    ctx.rotate(sway);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -18 * s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.deepLeaf;
    ctx.stroke();
    ellipse(ctx, -7 * s, -20 * s, 8 * s, 4.5 * s, -0.5);
    fillStroke(ctx, C.leaf, 2);
    ellipse(ctx, 7 * s, -22 * s, 8 * s, 4.5 * s, 0.5);
    fillStroke(ctx, C.leaf, 2);
    ctx.restore();
  }
}

export function drawBeehive(ctx: Ctx, x: number, y: number, level: number, time: number, motion: boolean): void {
  groundShadow(ctx, x, y, 60);
  rrPath(ctx, x - 6, y - 150, 12, 150, 4);
  fillStroke(ctx, C.woodDark, 3);
  rrPath(ctx, x - 40, y - 156, 80, 10, 4);
  fillStroke(ctx, C.wood, 2.5);
  const hy = y - 110;
  const tiers: [number, number][] = [[0, 22], [18, 30], [36, 34], [54, 28]];
  for (let i = tiers.length - 1; i >= 0; i--) {
    const [dy, r] = tiers[i];
    ellipse(ctx, x, hy + dy - 20, r, 12);
    fillStroke(ctx, i % 2 ? C.gold : C.lemonDeep, 2.5);
  }
  ellipse(ctx, x, hy + 22, 7, 6);
  ctx.fillStyle = C.cocoa;
  ctx.fill();
  const bees = Math.min(6, 2 + Math.floor(level / 3));
  for (let i = 0; i < bees; i++) {
    const a = (motion ? time * (1.8 + i * 0.3) : 0) + (i * Math.PI * 2) / bees;
    const bx = x + Math.cos(a) * (46 + i * 6);
    const by = hy + Math.sin(a * 1.4) * 24;
    ellipse(ctx, bx, by, 5, 4);
    fillStroke(ctx, C.lemon, 1.5);
    ctx.fillStyle = "rgba(255,253,247,0.9)";
    ellipse(ctx, bx - 1, by - 5, 3, 2.2);
    ctx.fill();
  }
}

export function drawSprinkler(ctx: Ctx, x: number, y: number, level: number, time: number, motion: boolean): void {
  groundShadow(ctx, x, y, 50);
  rrPath(ctx, x - 14, y - 12, 28, 12, 4);
  fillStroke(ctx, C.sky, 2.5);
  rrPath(ctx, x - 4, y - 42, 8, 32, 3);
  fillStroke(ctx, C.white, 2);
  const a = motion ? time * 3 : 0;
  ctx.save();
  ctx.translate(x, y - 44);
  ctx.rotate(Math.sin(a) * 0.6);
  rrPath(ctx, -16, -5, 32, 10, 5);
  fillStroke(ctx, C.coral, 2);
  ctx.restore();
  // Water arcs
  const reach = 150 + level * 10;
  ctx.fillStyle = "rgba(169,221,245,0.9)";
  for (let i = 0; i < 14; i++) {
    const k = ((i / 14 + (motion ? time * 0.6 : 0)) % 1);
    const dir = i % 2 ? 1 : -1;
    const px = x + dir * k * reach;
    const py = y - 44 - Math.sin(k * Math.PI) * 90;
    ellipse(ctx, px, py, 3, 4);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Market Square

export function drawMarketBackdrop(ctx: Ctx, time: number, motion: boolean): void {
  // Distant shop fronts: faded and text-free so the facilities in front always read clearly.
  const shops: [number, string, string][] = [
    [1245, C.cream, C.coral],
    [1690, C.white, C.leaf],
    [2110, "#FFF1B8", C.skyDeep],
    [2345, C.cream, C.coral],
  ];
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const [sx, wall, roof] of shops) {
    rrPath(ctx, sx - 70, GROUND_Y - 150, 140, 112, 8);
    fillStroke(ctx, wall, 3);
    ctx.beginPath();
    ctx.moveTo(sx - 80, GROUND_Y - 148);
    ctx.lineTo(sx - 60, GROUND_Y - 182);
    ctx.lineTo(sx + 60, GROUND_Y - 182);
    ctx.lineTo(sx + 80, GROUND_Y - 148);
    ctx.closePath();
    fillStroke(ctx, roof, 3);
    for (const wx of [-48, 18]) {
      rrPath(ctx, sx + wx, GROUND_Y - 124, 30, 30, 5);
      fillStroke(ctx, C.sky, 2.5);
    }
  }
  ctx.restore();
  // Cobblestone plaza
  ctx.fillStyle = "#EAD6A8";
  ctx.fillRect(1200, GROUND_Y - 38, 1200, 46);
  ctx.fillStyle = "rgba(167,116,79,0.22)";
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 40; i++) {
      rrPath(ctx, 1206 + i * 30 + (r % 2) * 15, GROUND_Y - 34 + r * 14, 24, 10, 4);
      ctx.fill();
    }
  }
  drawBunting(ctx, 1210, 2390, 70, time, motion);
}

export function drawBunting(ctx: Ctx, x0: number, x1: number, y: number, time: number, motion: boolean): void {
  const sag = 40;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  const n = Math.floor((x1 - x0) / 46);
  const colors = [C.coral, C.lemon, C.leaf, C.sky, C.white];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const fx = x0 + (x1 - x0) * t;
    const fy = y + 4 * sag * t * (1 - t);
    const flutter = motion ? Math.sin(time * 3 + i) * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(fx - 12, fy);
    ctx.lineTo(fx + 12, fy);
    ctx.lineTo(fx + flutter, fy + 24);
    ctx.closePath();
    fillStroke(ctx, colors[i % colors.length], 2);
  }
}

export function drawSellCrate(ctx: Ctx, x: number, y: number, level: number, lemons: number, priceText: string, time: number, motion: boolean): void {
  groundShadow(ctx, x, y, 200);
  // Sign post behind the crate, board above the lemon pile
  rrPath(ctx, x - 5, y - 214, 10, 110, 4);
  fillStroke(ctx, C.woodDark, 3);
  const bob = motion ? Math.sin(time * 2.5) * 2 : 0;
  rrPath(ctx, x - 62, y - 274 + bob, 124, 52, 12);
  fillStroke(ctx, level >= 10 ? C.gold : C.lemon, 3);
  label(ctx, "SELL", x, y - 256 + bob, 22, C.cocoa);
  label(ctx, priceText, x, y - 234 + bob, 12, C.cocoa);
  // Crate body
  rrPath(ctx, x - 90, y - 110, 180, 110, 10);
  fillStroke(ctx, C.wood, 3);
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 3;
  for (const py of [y - 76, y - 40]) {
    ctx.beginPath();
    ctx.moveTo(x - 84, py);
    ctx.lineTo(x + 84, py);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - 84, y - 104);
  ctx.lineTo(x + 84, y - 6);
  ctx.stroke();
  // Lemon pile grows with stock sold recently (and with level)
  const pile = Math.min(14, 5 + Math.floor(level / 2) + Math.min(5, lemons));
  for (let i = 0; i < pile; i++) {
    const row = i < 6 ? 0 : i < 11 ? 1 : 2;
    const inRow = row === 0 ? i : row === 1 ? i - 6 : i - 11;
    const count = row === 0 ? 6 : row === 1 ? 5 : 3;
    drawLemon(ctx, x + (inRow - (count - 1) / 2) * 26, y - 114 - row * 17, 12, C.lemon, (i % 3) * 0.5 - 0.5);
  }
  // Coin stamp
  ellipse(ctx, x, y - 56, 22, 22);
  fillStroke(ctx, C.gold, 3);
  label(ctx, "$", x, y - 55, 20, C.cocoa);
}

export function drawChute(ctx: Ctx, x: number, y: number, time: number, motion: boolean): void {
  // Tall tube from the grove direction that curls into the crate.
  ctx.lineCap = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x + 20, y - 240);
    ctx.lineTo(x + 20, y - 150);
    ctx.quadraticCurveTo(x + 20, y - 95, x - 75, y - 95);
  };
  path();
  ctx.lineWidth = 34;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  path();
  ctx.lineWidth = 27;
  ctx.strokeStyle = C.lemon;
  ctx.stroke();
  path();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255,253,247,0.6)";
  ctx.stroke();
  rrPath(ctx, x - 4, y - 262, 48, 26, 8);
  fillStroke(ctx, C.coral, 3);
  if (motion) {
    for (let i = 0; i < 3; i++) {
      const k = (time * 0.8 + i / 3) % 1;
      const ly = y - 240 + k * 120;
      if (ly < y - 130) drawLemon(ctx, x + 20, ly, 7, C.lemon, k * 6);
    }
  }
  rrPath(ctx, x + 12, y - 60, 16, 60, 4);
  fillStroke(ctx, C.woodDark, 2.5);
}

export function drawFactory(ctx: Ctx, x: number, y: number, level: number, running: boolean, recipe: RecipeDef, time: number, motion: boolean): void {
  const w = 300;
  const L = x - w / 2;
  groundShadow(ctx, x, y, w + 30);
  // Chimney + steam
  rrPath(ctx, x + 80, y - 330, 34, 110, 6);
  fillStroke(ctx, C.coral, 3);
  if (running) {
    for (let i = 0; i < 3; i++) {
      const k = motion ? (time * 0.5 + i / 3) % 1 : i / 3;
      drawCloud(ctx, x + 90 + k * 30, y - 345 - k * 80, 0.35 + k * 0.3);
    }
  }
  // Building with sawtooth roof
  rrPath(ctx, L, y - 220, w, 220, 10);
  fillStroke(ctx, C.cream, 3);
  ctx.beginPath();
  ctx.moveTo(L - 8, y - 216);
  for (let i = 0; i < 4; i++) {
    const sx = L - 8 + i * ((w + 16) / 4);
    ctx.lineTo(sx + (w + 16) / 8, y - 262);
    ctx.lineTo(sx + (w + 16) / 4, y - 216);
  }
  ctx.closePath();
  fillStroke(ctx, level >= 10 ? C.gold : C.leaf, 3);
  // Sign
  rrPath(ctx, x - 80, y - 206, 160, 34, 10);
  fillStroke(ctx, C.white, 2.5);
  label(ctx, "JUICE CO.", x, y - 188, 20, C.cocoa);
  // Juice tank with level
  rrPath(ctx, L + 20, y - 160, 70, 120, 20);
  fillStroke(ctx, C.white, 3);
  const lvl = running && motion ? 0.55 + 0.25 * Math.sin(time * 1.5) : 0.6;
  ctx.save();
  rrPath(ctx, L + 24, y - 156, 62, 112, 17);
  ctx.clip();
  ctx.fillStyle = recipe.art.liquid;
  ctx.fillRect(L + 24, y - 44 - 112 * lvl, 62, 112 * lvl);
  ctx.fillStyle = "rgba(255,253,247,0.7)";
  for (let i = 0; i < 4; i++) {
    const by = y - 50 - ((motion ? time * 30 : 0) + i * 28) % (112 * lvl);
    ellipse(ctx, L + 40 + (i % 2) * 24, by, 3, 3);
    ctx.fill();
  }
  ctx.restore();
  drawLemon(ctx, L + 55, y - 170, 14, C.lemon, -0.3);
  // Gears
  for (const [gx, gy, r, dir] of [[x + 10, y - 110, 26, 1], [x + 52, y - 80, 18, -1]] as const) {
    ctx.save();
    ctx.translate(gx, gy);
    if (running && motion) ctx.rotate(time * 2 * dir);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const rad = i % 2 ? r : r * 1.25;
      const a = (i / 16) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    fillStroke(ctx, C.sky, 2.5);
    ellipse(ctx, 0, 0, r * 0.35, r * 0.35);
    fillStroke(ctx, C.white, 2);
    ctx.restore();
  }
  // Windows
  rrPath(ctx, x + 88, y - 150, 44, 40, 6);
  fillStroke(ctx, C.sky, 2.5);
  // Conveyor with bottles
  rrPath(ctx, L - 20, y - 36, w + 40, 18, 9);
  fillStroke(ctx, "#8E95A3", 3);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const k = ((i / n + (running && motion ? time * 0.15 : 0)) % 1);
    drawDrink(ctx, L - 10 + k * (w + 20), y - 36, recipe, 0.9);
  }
  for (let i = 0; i < 8; i++) {
    ellipse(ctx, L - 10 + i * ((w + 20) / 7), y - 27, 5, 5);
    fillStroke(ctx, C.white, 1.5);
  }
}

// ---------------------------------------------------------------------------
// Lemon Fair

export function drawFairBackdrop(ctx: Ctx, time: number, motion: boolean): void {
  // Striped tents
  for (const [tx, c1] of [[2440, C.coral], [3525, C.skyDeep]] as const) {
    const tw = 150;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(tx, GROUND_Y - 230);
      ctx.lineTo(tx - tw / 2 + (i * tw) / 6, GROUND_Y - 130);
      ctx.lineTo(tx - tw / 2 + ((i + 1) * tw) / 6, GROUND_Y - 130);
      ctx.closePath();
      fillStroke(ctx, i % 2 ? C.white : c1, 2.5);
    }
    rrPath(ctx, tx - tw / 2 + 6, GROUND_Y - 132, tw - 12, 92, 4);
    fillStroke(ctx, C.cream, 2.5);
    ctx.beginPath();
    ctx.moveTo(tx - 22, GROUND_Y - 40);
    ctx.quadraticCurveTo(tx, GROUND_Y - 110, tx + 22, GROUND_Y - 40);
    ctx.closePath();
    fillStroke(ctx, c1, 2.5);
    star(ctx, tx, GROUND_Y - 240, 8);
    fillStroke(ctx, C.lemon, 2);
  }
  // Balloons
  for (let i = 0; i < 5; i++) {
    const bx = 2560 + i * 230;
    const by = 140 + Math.sin((motion ? time * 0.8 : 0) + i) * 12 + (i % 2) * 30;
    ctx.beginPath();
    ctx.moveTo(bx, by + 24);
    ctx.quadraticCurveTo(bx + 8, by + 60, bx - 4, by + 90);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.cocoa;
    ctx.stroke();
    ellipse(ctx, bx, by, 18, 23);
    fillStroke(ctx, [C.coral, C.lemon, C.sky, C.leaf, "#F4A3B8"][i], 2.5);
    ctx.fillStyle = "rgba(255,253,247,0.7)";
    ellipse(ctx, bx - 6, by - 8, 4, 6);
    ctx.fill();
  }
  drawBunting(ctx, 2410, 3590, 60, time, motion);
}

export function drawFountain(ctx: Ctx, x: number, y: number, level: number, time: number, motion: boolean): void {
  groundShadow(ctx, x, y, 270);
  // Basin
  ellipse(ctx, x, y - 30, 125, 30);
  fillStroke(ctx, C.cream, 3);
  rrPath(ctx, x - 125, y - 30, 250, 30, 12);
  fillStroke(ctx, C.cream, 3);
  ellipse(ctx, x, y - 34, 110, 22);
  fillStroke(ctx, "#FFE680", 2.5);
  // Coins glinting in the basin
  const coins = Math.min(10, 2 + level);
  for (let i = 0; i < coins; i++) {
    const cx = x - 85 + ((i * 53) % 170);
    const cy = y - 38 + ((i * 7) % 10);
    ellipse(ctx, cx, cy, 5, 3);
    fillStroke(ctx, C.gold, 1.2);
  }
  // Column + upper bowl
  rrPath(ctx, x - 12, y - 130, 24, 100, 6);
  fillStroke(ctx, C.white, 3);
  ellipse(ctx, x, y - 132, 55, 13);
  fillStroke(ctx, C.cream, 3);
  // Lemon on top
  drawLemon(ctx, x, y - 162, 18, level >= 10 ? C.gold : C.lemon, -0.3);
  // Lemonade jets
  ctx.fillStyle = "rgba(255,230,128,0.95)";
  for (let i = 0; i < 18; i++) {
    const k = ((i / 18 + (motion ? time * 0.7 : 0)) % 1);
    const dir = i % 2 ? 1 : -1;
    const px = x + dir * (20 + k * 80);
    const py = y - 150 - Math.sin(k * Math.PI) * 60 + k * 110;
    ellipse(ctx, px, py, 3.5, 4.5);
    ctx.fill();
  }
}

export function drawWheel(ctx: Ctx, x: number, y: number, segments: WheelSegment[], angle: number, ready: boolean, time: number, motion: boolean): void {
  const r = 120;
  const cy = y - 175;
  groundShadow(ctx, x, y, 180);
  // Stand legs
  ctx.beginPath();
  ctx.moveTo(x - 80, y);
  ctx.lineTo(x, cy);
  ctx.lineTo(x + 80, y);
  ctx.lineWidth = 16;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.strokeStyle = C.wood;
  ctx.stroke();
  // Glow when a spin is ready
  if (ready) {
    const p = motion ? 0.5 + 0.5 * Math.sin(time * 4) : 1;
    ctx.fillStyle = `rgba(255,217,90,${0.25 + 0.25 * p})`;
    ellipse(ctx, x, cy, r + 26, r + 26);
    ctx.fill();
  }
  // Segments
  const n = segments.length;
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(angle);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
    const a1 = a0 + (Math.PI * 2) / n;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    fillStroke(ctx, segments[i].color, 3);
    // Icon
    const am = (a0 + a1) / 2;
    const ix = Math.cos(am) * r * 0.66;
    const iy = Math.sin(am) * r * 0.66;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(am + Math.PI / 2);
    wheelIcon(ctx, segments[i].kind);
    ctx.restore();
  }
  ctx.restore();
  // Rim bulbs
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const on = !motion || Math.floor(time * 4 + i) % 2 === 0;
    ellipse(ctx, x + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10), 5, 5);
    fillStroke(ctx, on ? C.white : C.gold, 2);
  }
  ctx.beginPath();
  ctx.arc(x, cy, r + 10, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  // Hub + pointer
  ellipse(ctx, x, cy, 20, 20);
  fillStroke(ctx, C.coral, 3);
  star(ctx, x, cy, 11);
  fillStroke(ctx, C.lemon, 2);
  ctx.beginPath();
  ctx.moveTo(x - 16, cy - r - 30);
  ctx.lineTo(x + 16, cy - r - 30);
  ctx.lineTo(x, cy - r + 4);
  ctx.closePath();
  fillStroke(ctx, C.coral, 3);
  // Label
  rrPath(ctx, x - 60, y - 34, 120, 30, 12);
  fillStroke(ctx, ready ? C.leaf : C.cream, 2.5);
}

function wheelIcon(ctx: Ctx, kind: WheelSegment["kind"]): void {
  switch (kind) {
    case "coins":
      ellipse(ctx, 0, 0, 12, 12);
      fillStroke(ctx, C.gold, 2.5);
      label(ctx, "$", 0, 1, 13, C.cocoa);
      break;
    case "bigCoins":
      star(ctx, 0, 0, 16);
      fillStroke(ctx, C.gold, 2.5);
      label(ctx, "$", 0, 2, 12, C.cocoa);
      break;
    case "lemons":
      drawLemon(ctx, -6, 2, 8, C.lemon, 0.3);
      drawLemon(ctx, 7, -3, 8, C.lemon, -0.3);
      break;
    case "ripen":
      star(ctx, 0, 0, 13, 4, 0.4);
      fillStroke(ctx, C.white, 2);
      break;
    case "drinks":
      rrPath(ctx, -8, -12, 16, 22, 4);
      fillStroke(ctx, "#FFE680", 2);
      break;
    case "rush":
      ellipse(ctx, 0, 0, 10, 10);
      fillStroke(ctx, C.lemon, 2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = C.cocoa;
        ctx.stroke();
      }
      break;
  }
}

export function drawStatue(ctx: Ctx, x: number, y: number, level: number, time: number, motion: boolean): void {
  groundShadow(ctx, x, y, 170);
  rrPath(ctx, x - 75, y - 40, 150, 40, 8);
  fillStroke(ctx, C.cream, 3);
  rrPath(ctx, x - 55, y - 140, 110, 104, 8);
  fillStroke(ctx, C.white, 3);
  rrPath(ctx, x - 40, y - 110, 80, 30, 6);
  fillStroke(ctx, C.gold, 2.5);
  label(ctx, `LV ${level}`, x, y - 94, 14, C.cocoa);
  rrPath(ctx, x - 65, y - 152, 130, 16, 6);
  fillStroke(ctx, C.cream, 3);
  const bob = motion ? Math.sin(time * 1.5) * 3 : 0;
  drawLemon(ctx, x, y - 210 + bob, 48, C.gold, -0.35);
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 262 + bob);
  ctx.quadraticCurveTo(x + 10, y - 290 + bob, x + 34, y - 282 + bob);
  ctx.quadraticCurveTo(x + 14, y - 266 + bob, x - 8, y - 262 + bob);
  fillStroke(ctx, C.leaf, 2.5);
  for (let i = 0; i < 4; i++) {
    const a = (motion ? time * 1.2 : 0) + (i * Math.PI) / 2;
    const tw = motion ? 0.5 + 0.5 * Math.sin(time * 5 + i) : 1;
    ctx.fillStyle = `rgba(255,253,247,${0.4 + 0.6 * tw})`;
    star(ctx, x + Math.cos(a) * 75, y - 210 + Math.sin(a) * 50, 6 * tw + 2, 4, 0.35);
    ctx.fill();
  }
}


// ---------------------------------------------------------------------------
// Order Board (Market Square)

export interface BoardNote {
  recipe: RecipeDef;
  label: string;
  progress?: number;
}

export function drawOrderBoard(ctx: Ctx, x: number, y: number, level: number, notes: BoardNote[], active: boolean, time: number, motion: boolean): void {
  groundShadow(ctx, x, y, 180);
  // Posts
  for (const px of [-64, 56]) {
    rrPath(ctx, x + px, y - 190, 10, 190, 4);
    fillStroke(ctx, C.woodDark, 3);
  }
  // Little roof
  ctx.beginPath();
  ctx.moveTo(x - 86, y - 188);
  ctx.lineTo(x, y - 226);
  ctx.lineTo(x + 86, y - 188);
  ctx.closePath();
  fillStroke(ctx, level >= 5 ? C.gold : C.coral, 3);
  // Cork board
  rrPath(ctx, x - 76, y - 186, 152, 118, 8);
  fillStroke(ctx, "#D9A066", 3);
  rrPath(ctx, x - 68, y - 178, 136, 102, 6);
  ctx.fillStyle = "#E8C08A";
  ctx.fill();
  label(ctx, "ORDERS", x, y - 58, 15, C.cocoa);
  // Notes
  const n = Math.max(1, notes.length);
  notes.forEach((note, i) => {
    const w = active ? 120 : 40;
    const nx = active ? x : x - 46 + i * 46;
    const wobble = motion ? Math.sin(time * 2 + i) * 0.04 : 0;
    ctx.save();
    ctx.translate(nx, y - 128);
    ctx.rotate(wobble + (active ? 0 : (i - (n - 1) / 2) * 0.06));
    rrPath(ctx, -w / 2, -42, w, 84, 4);
    fillStroke(ctx, C.white, 2);
    ellipse(ctx, 0, -40, 4, 4);
    fillStroke(ctx, C.coral, 1.5);
    drawDrink(ctx, active ? -34 : 0, active ? 18 : 10, note.recipe, active ? 1 : 0.8);
    label(ctx, note.label, active ? 18 : 0, active ? -14 : 28, active ? 14 : 11, C.cocoa);
    if (note.progress !== undefined) {
      rrPath(ctx, -8, 8, 60, 10, 5);
      fillStroke(ctx, C.cream, 1.5);
      rrPath(ctx, -8, 8, Math.max(4, 60 * note.progress), 10, 5);
      ctx.fillStyle = C.leaf;
      ctx.fill();
    }
    ctx.restore();
  });
}

/** Perfect Squeeze gauge: a half dial with a golden sweet spot and a sweeping needle. */
export function drawSqueezeGauge(ctx: Ctx, x: number, y: number, meter: number, perfectWindow: number): void {
  const r = 30;
  ctx.beginPath();
  ctx.arc(x, y, r + 6, Math.PI, 0);
  ctx.closePath();
  fillStroke(ctx, C.white, 2.5);
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.arc(x, y, r - 2, Math.PI, Math.PI * (2 - perfectWindow));
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#E9D3BC";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 2, Math.PI * (2 - perfectWindow), Math.PI * 2);
  ctx.strokeStyle = C.gold;
  ctx.stroke();
  ctx.lineCap = "round";
  const a = Math.PI + meter * Math.PI;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  ellipse(ctx, x, y, 4, 4);
  fillStroke(ctx, C.coral, 1.5);
  if (meter >= 1 - perfectWindow) {
    star(ctx, x + r + 4, y - r, 6, 4, 0.4);
    ctx.fillStyle = C.gold;
    ctx.fill();
  }
}
