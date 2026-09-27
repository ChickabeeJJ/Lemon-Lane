// Procedural art: every character, station and prop is drawn from shared primitives
// (chunky shapes, cocoa outlines, soft offset shadows) so the whole lane shares one style.
// Entity functions draw with their anchor at the bottom-center contact point.
import type { CustomerDef, HelperDef, RecipeDef } from "../content/types";
import { C, FONT, LINE } from "./palette";

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// Primitives

export function rrPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillStroke(ctx: Ctx, fill: string, lw = LINE, stroke: string = C.cocoa): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function groundShadow(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.fillStyle = C.shadow;
  ellipse(ctx, x, y + 2, w / 2, w / 9);
  ctx.fill();
}

export function star(ctx: Ctx, x: number, y: number, r: number, points = 5, inner = 0.5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

export function label(ctx: Ctx, text: string, x: number, y: number, size: number, color: string = C.cocoa, align: CanvasTextAlign = "center", outline?: string): void {
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (outline) {
    ctx.lineWidth = Math.max(2, size / 5);
    ctx.strokeStyle = outline;
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const mix = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

// ---------------------------------------------------------------------------
// Lemons

export function drawLemon(ctx: Ctx, x: number, y: number, r: number, color: string = C.lemon, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.2, r, 0, 0, Math.PI * 2);
  ctx.moveTo(r * 1.1, -r * 0.25);
  ctx.quadraticCurveTo(r * 1.55, 0, r * 1.1, r * 0.25);
  fillStroke(ctx, color, Math.max(1.5, r * 0.28));
  ctx.fillStyle = "rgba(255,253,247,0.75)";
  ellipse(ctx, -r * 0.4, -r * 0.4, r * 0.35, r * 0.2, -0.5);
  ctx.fill();
  ctx.restore();
}

export function drawFruit(ctx: Ctx, x: number, y: number, g: number, golden: boolean, time: number, idx: number, motion: boolean): void {
  if (g < 0.25) {
    // Blossom
    const r = 3 + g * 10;
    ctx.fillStyle = C.white;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ellipse(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, r * 0.7);
      ctx.fill();
    }
    ctx.fillStyle = C.lemon;
    ellipse(ctx, x, y, r * 0.55, r * 0.55);
    ctx.fill();
    return;
  }
  if (g < 1) {
    const t = (g - 0.25) / 0.75;
    drawLemon(ctx, x, y + 3, 4 + t * 5, lerpColor("#7BBF5A", "#D8E26A", t), 0.3);
    return;
  }
  const wobble = motion ? Math.sin(time * 7 + idx * 1.7) * 0.18 : 0;
  drawLemon(ctx, x, y + 4, 10, golden ? C.gold : C.lemon, 0.25 + wobble);
  if (golden) {
    const tw = motion ? 0.5 + 0.5 * Math.sin(time * 6 + idx) : 1;
    ctx.fillStyle = `rgba(255,253,247,${0.5 + 0.5 * tw})`;
    star(ctx, x + 11, y - 8, 4 + 2 * tw, 4, 0.35);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Tree

/** Fruit anchor offsets (unscaled) inside the canopy. 12 slots max. */
export const FRUIT_SPOTS: [number, number][] = [
  [-40, -130], [30, -150], [-5, -185], [55, -125], [-60, -170], [45, -195],
  [-25, -150], [10, -120], [-45, -200], [70, -160], [20, -215], [-75, -140],
];

export function treeCanopyRadius(scale: number): number {
  return 105 * scale;
}

export function drawTree(ctx: Ctx, x: number, y: number, s: number, fruits: { g: number; golden: boolean }[], time: number, motion: boolean, shake = 0): void {
  groundShadow(ctx, x, y, 150 * s);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Trunk
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-10, -60, -16, -115);
  ctx.lineTo(16, -115);
  ctx.quadraticCurveTo(10, -60, 14, 0);
  ctx.closePath();
  fillStroke(ctx, C.woodDark, LINE / s);
  ctx.beginPath();
  ctx.moveTo(0, -80);
  ctx.quadraticCurveTo(25, -95, 35, -115);
  ctx.lineWidth = 7;
  ctx.strokeStyle = C.woodDark;
  ctx.stroke();

  const sway = motion ? Math.sin(time * 1.3) * 2 + shake * Math.sin(time * 40) * 4 : shake * 3;
  ctx.translate(sway, 0);
  const blobs: [number, number, number][] = [
    [0, -160, 72], [-62, -140, 52], [62, -140, 52], [-35, -200, 50], [38, -205, 50], [0, -225, 42],
  ];
  ctx.lineWidth = (LINE * 2) / s;
  ctx.strokeStyle = C.deepLeaf;
  for (const [bx, by, r] of blobs) {
    ellipse(ctx, bx, by, r, r * 0.92);
    ctx.stroke();
  }
  ctx.fillStyle = C.leaf;
  for (const [bx, by, r] of blobs) {
    ellipse(ctx, bx, by, r, r * 0.92);
    ctx.fill();
  }
  ctx.fillStyle = C.leafLight;
  for (const [bx, by, r] of blobs.slice(3)) {
    ellipse(ctx, bx - r * 0.25, by - r * 0.3, r * 0.45, r * 0.3);
    ctx.fill();
  }
  fruits.forEach((f, i) => {
    const [fx, fy] = FRUIT_SPOTS[i % FRUIT_SPOTS.length];
    drawFruit(ctx, fx, fy, f.g, f.golden, time, i, motion);
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Stations

export function drawBasket(ctx: Ctx, x: number, y: number, level: number, lemons: number, cap: number): void {
  const s = 1 + Math.min(0.45, level * 0.03);
  groundShadow(ctx, x, y, 90 * s);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Handle
  ctx.beginPath();
  ctx.arc(0, -40, 32, Math.PI, 0);
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.wood;
  ctx.stroke();
  // Lemons pile
  const shown = Math.min(lemons, 12);
  for (let i = 0; i < shown; i++) {
    const row = i < 5 ? 0 : i < 9 ? 1 : 2;
    const inRow = row === 0 ? i : row === 1 ? i - 5 : i - 9;
    const count = row === 0 ? 5 : row === 1 ? 4 : 3;
    const lx = (inRow - (count - 1) / 2) * 13;
    drawLemon(ctx, lx, -40 - row * 9, 6.5, C.lemon, (i % 3) * 0.4 - 0.4);
  }
  // Body
  ctx.beginPath();
  ctx.moveTo(-40, -40);
  ctx.lineTo(40, -40);
  ctx.lineTo(32, 0);
  ctx.lineTo(-32, 0);
  ctx.closePath();
  fillStroke(ctx, C.wood, LINE / s);
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 2;
  for (let i = -30; i <= 30; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, -38);
    ctx.lineTo(i * 0.82, -2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-37, -22);
  ctx.lineTo(37, -22);
  ctx.stroke();
  rrPath(ctx, -44, -46, 88, 10, 5);
  fillStroke(ctx, C.woodDark, LINE / s);
  ctx.restore();
  // Count tag (always readable text, not just a picture)
  const full = lemons >= cap;
  rrPath(ctx, x - 26, y + 6, 52, 20, 10);
  fillStroke(ctx, full ? C.coral : C.cream, 2);
  label(ctx, `${lemons}/${cap}`, x, y + 16.5, 13, C.cocoa);
}

export function drawPress(ctx: Ctx, x: number, y: number, level: number, progress: number, running: boolean, time: number, recipe: RecipeDef, squash: number, hasLemons: boolean, motion: boolean): void {
  groundShadow(ctx, x, y, 110);
  ctx.save();
  ctx.translate(x, y);
  const sq = 1 - squash * 0.12;
  ctx.scale(1 + squash * 0.08, sq);
  // Legs
  rrPath(ctx, -38, -20, 12, 20, 4);
  fillStroke(ctx, C.woodDark);
  rrPath(ctx, 26, -20, 12, 20, 4);
  fillStroke(ctx, C.woodDark);
  // Body
  rrPath(ctx, -45, -115, 90, 100, 16);
  fillStroke(ctx, C.sky);
  if (level >= 10) {
    rrPath(ctx, -45, -75, 90, 12, 0);
    fillStroke(ctx, C.coral, 2);
  }
  if (level >= 20) {
    rrPath(ctx, -45, -115, 90, 10, 6);
    fillStroke(ctx, C.gold, 2);
  }
  // Window showing juice level
  rrPath(ctx, -30, -100, 36, 44, 8);
  fillStroke(ctx, C.white, 2);
  const fillH = 40 * progress;
  if (fillH > 0) {
    rrPath(ctx, -28, -58 - fillH, 32, fillH, 6);
    ctx.fillStyle = recipe.art.liquid;
    ctx.fill();
  }
  // Hopper
  ctx.beginPath();
  ctx.moveTo(-40, -115);
  ctx.lineTo(40, -115);
  ctx.lineTo(52, -145);
  ctx.lineTo(-52, -145);
  ctx.closePath();
  fillStroke(ctx, C.cream);
  if (hasLemons) {
    drawLemon(ctx, -18, -140, 9, C.lemon, 0.2);
    drawLemon(ctx, 12, -142, 9, C.lemon, -0.4);
  }
  // Crank wheel
  const ang = running && motion ? time * 6 : 0;
  ctx.save();
  ctx.translate(26, -80);
  ellipse(ctx, 0, 0, 14, 14);
  fillStroke(ctx, C.lemon, 2.5);
  ctx.rotate(ang);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
  }
  ctx.strokeStyle = C.cocoa;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  // Spout + drip
  rrPath(ctx, 40, -40, 22, 10, 4);
  fillStroke(ctx, C.cream, 2.5);
  if (running) {
    const dy = motion ? (time * 60) % 16 : 6;
    ctx.fillStyle = recipe.art.liquid;
    ellipse(ctx, 57, -26 + dy, 3, 4);
    ctx.fill();
  }
  ctx.restore();
}

export function drawDrink(ctx: Ctx, x: number, y: number, recipe: RecipeDef, s = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const { liquid, garnish, glass } = recipe.art;
  const lw = 2.2;
  switch (glass) {
    case "mug":
      rrPath(ctx, -10, -24, 20, 24, 5);
      fillStroke(ctx, C.white, lw);
      rrPath(ctx, -8, -18, 16, 16, 3);
      ctx.fillStyle = liquid;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(12, -12, 6, -Math.PI / 2, Math.PI / 2);
      ctx.lineWidth = lw;
      ctx.strokeStyle = C.cocoa;
      ctx.stroke();
      break;
    case "tall":
      ctx.beginPath();
      ctx.moveTo(-8, -34);
      ctx.lineTo(8, -34);
      ctx.lineTo(6, 0);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      fillStroke(ctx, liquid, lw);
      ctx.fillStyle = "rgba(255,253,247,0.6)";
      ellipse(ctx, -2, -20, 1.8, 1.8);
      ctx.fill();
      ellipse(ctx, 2, -10, 1.4, 1.4);
      ctx.fill();
      break;
    case "float":
      ctx.beginPath();
      ctx.moveTo(-11, -22);
      ctx.lineTo(11, -22);
      ctx.lineTo(7, 0);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      fillStroke(ctx, liquid, lw);
      ellipse(ctx, 0, -25, 10, 7);
      fillStroke(ctx, C.white, lw);
      ellipse(ctx, 3, -33, 3, 3);
      fillStroke(ctx, C.coral, 1.5);
      break;
    case "bottle":
      rrPath(ctx, -8, -26, 16, 26, 5);
      fillStroke(ctx, liquid, lw);
      rrPath(ctx, -4, -36, 8, 12, 2);
      fillStroke(ctx, liquid, lw);
      rrPath(ctx, -5, -18, 10, 8, 2);
      fillStroke(ctx, C.white, 1.5);
      break;
    case "star":
      ctx.beginPath();
      ctx.moveTo(-10, -24);
      ctx.lineTo(10, -24);
      ctx.lineTo(4, -8);
      ctx.lineTo(4, 0);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-4, -8);
      ctx.closePath();
      fillStroke(ctx, liquid, lw);
      star(ctx, 9, -27, 6);
      fillStroke(ctx, C.lemon, 1.5);
      break;
    default:
      ctx.beginPath();
      ctx.moveTo(-9, -24);
      ctx.lineTo(9, -24);
      ctx.lineTo(7, 0);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      fillStroke(ctx, liquid, lw);
  }
  if (glass !== "float" && glass !== "star") {
    // Garnish slice + straw
    ctx.beginPath();
    ctx.arc(-7, glass === "tall" ? -34 : -24, 5, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, garnish, 1.5);
    ctx.beginPath();
    ctx.moveTo(3, glass === "tall" ? -32 : -22);
    ctx.lineTo(8, glass === "tall" ? -44 : -34);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.coral;
    ctx.stroke();
  }
  ctx.restore();
}

export interface StandLook {
  stripes: [string, string];
  signLevel: number;
  registerLevel: number;
  bookLevel: number;
  time: number;
  motion: boolean;
}

export function drawStand(ctx: Ctx, x: number, y: number, w: number, look: StandLook): void {
  const L = x - w / 2;
  groundShadow(ctx, x, y, w + 40);
  // Posts
  rrPath(ctx, L - 4, y - 240, 14, 150, 5);
  fillStroke(ctx, C.wood);
  rrPath(ctx, L + w - 10, y - 240, 14, 150, 5);
  fillStroke(ctx, C.wood);
  // Counter
  rrPath(ctx, L, y - 95, w, 95, 10);
  fillStroke(ctx, C.cream);
  ctx.strokeStyle = "rgba(167,116,79,0.35)";
  ctx.lineWidth = 2;
  for (let py = y - 70; py < y; py += 24) {
    ctx.beginPath();
    ctx.moveTo(L + 8, py);
    ctx.lineTo(L + w - 8, py);
    ctx.stroke();
  }
  // Emblem
  ellipse(ctx, x, y - 50, 28, 28);
  fillStroke(ctx, C.lemon);
  drawLemon(ctx, x, y - 50, 13, C.lemonDeep, -0.3);
  // Countertop
  rrPath(ctx, L - 12, y - 108, w + 24, 16, 7);
  fillStroke(ctx, C.wood);

  // Awning (scalloped stripes)
  const aw = w + 50;
  const ax = x - aw / 2;
  const ay = y - 258;
  const stripes = 9;
  const sw = aw / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.beginPath();
    ctx.moveTo(ax + i * sw, ay);
    ctx.lineTo(ax + (i + 1) * sw, ay);
    ctx.lineTo(ax + (i + 1) * sw, ay + 40);
    ctx.arc(ax + i * sw + sw / 2, ay + 40, sw / 2, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = look.stripes[i % 2];
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + aw, ay);
  ctx.lineTo(ax + aw, ay + 40);
  for (let i = stripes - 1; i >= 0; i--) ctx.arc(ax + i * sw + sw / 2, ay + 40, sw / 2, 0, Math.PI);
  ctx.closePath();
  ctx.lineWidth = LINE;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();

  // Signboard grows with its upgrade level
  const tier = look.signLevel >= 20 ? 3 : look.signLevel >= 8 ? 2 : look.signLevel >= 1 ? 1 : 0;
  const sw2 = 150 + tier * 30;
  const sh = 44 + tier * 6;
  const sy = ay - sh - 8;
  rrPath(ctx, x - 4, sy + sh - 2, 8, 12, 2);
  fillStroke(ctx, C.woodDark, 2);
  rrPath(ctx, x - sw2 / 2, sy, sw2, sh, 12);
  fillStroke(ctx, tier >= 2 ? C.lemon : C.cream);
  label(ctx, "LEMON LANE", x + (tier >= 1 ? 10 : 0), sy + sh / 2 + 1, 20 + tier * 2, C.cocoa);
  if (tier >= 1) drawLemon(ctx, x - sw2 / 2 + 22, sy + sh / 2, 9, tier >= 2 ? C.white : C.lemon, -0.3);
  if (tier >= 3) {
    for (let i = 0; i < 8; i++) {
      const bx = x - sw2 / 2 + 12 + (i * (sw2 - 24)) / 7;
      const on = !look.motion || Math.floor(look.time * 3 + i) % 2 === 0;
      ellipse(ctx, bx, sy - 4, 4, 4);
      fillStroke(ctx, on ? C.white : C.gold, 1.5);
    }
  }

  // Register and recipe book on the counter
  if (look.registerLevel > 0) {
    const rx = L + 6;
    rrPath(ctx, rx, y - 140, 44, 32, 6);
    fillStroke(ctx, look.registerLevel >= 10 ? C.gold : C.coral);
    rrPath(ctx, rx + 6, y - 150, 32, 12, 4);
    fillStroke(ctx, C.white, 2);
    label(ctx, "$", rx + 22, y - 124, 14, C.white);
  }
  if (look.bookLevel > 0) {
    const thick = 6 + Math.min(12, look.bookLevel);
    const bx = L + w - 46;
    rrPath(ctx, bx, y - 108 - thick, 38, thick, 3);
    fillStroke(ctx, C.leaf, 2);
    rrPath(ctx, bx + 4, y - 108 - thick + 2, 30, 3, 1);
    ctx.fillStyle = C.white;
    ctx.fill();
  }
}

export function drawIceBox(ctx: Ctx, x: number, y: number, level: number): void {
  groundShadow(ctx, x, y, 70);
  rrPath(ctx, x - 32, y - 56, 64, 56, 10);
  fillStroke(ctx, level >= 10 ? C.skyDeep : C.sky);
  rrPath(ctx, x - 36, y - 64, 72, 14, 6);
  fillStroke(ctx, C.white);
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 12, y - 28 + Math.sin(a) * 12);
    ctx.lineTo(x - Math.cos(a) * 12, y - 28 - Math.sin(a) * 12);
    ctx.stroke();
  }
}

export function drawUmbrella(ctx: Ctx, x: number, y: number, level: number): void {
  const s = 1 + Math.min(0.3, level * 0.02);
  const r = 80 * s;
  rrPath(ctx, x - 3, y - 200 * s, 6, 200 * s, 3);
  fillStroke(ctx, C.white, 2);
  const top = y - 200 * s;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + Math.cos(a0) * r, top + 30);
    ctx.quadraticCurveTo(x + Math.cos((a0 + a1) / 2) * r * 0.95, top + 42, x + Math.cos(a1) * r, top + 30);
    ctx.closePath();
    fillStroke(ctx, i % 2 ? C.coral : C.white, 2.5);
  }
  ellipse(ctx, x, top - 4, 5, 5);
  fillStroke(ctx, C.lemon, 2);
}

export function drawFlowerPot(ctx: Ctx, x: number, y: number, hue: number, time: number, motion: boolean): void {
  const colors = [C.coral, C.lemon, "#F4A3B8", C.white, "#B9C7F5", C.leafLight];
  const sway = motion ? Math.sin(time * 2 + x) * 2 : 0;
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.quadraticCurveTo(x + sway, y - 34, x + sway, y - 42);
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.deepLeaf;
  ctx.stroke();
  const fc = colors[hue % colors.length];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ellipse(ctx, x + sway + Math.cos(a) * 6, y - 44 + Math.sin(a) * 6, 5, 5);
    fillStroke(ctx, fc, 1.5);
  }
  ellipse(ctx, x + sway, y - 44, 3.5, 3.5);
  fillStroke(ctx, C.lemonDeep, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 24);
  ctx.lineTo(x + 14, y - 24);
  ctx.lineTo(x + 10, y);
  ctx.lineTo(x - 10, y);
  ctx.closePath();
  fillStroke(ctx, C.coral, 2.5);
}

export function drawBench(ctx: Ctx, x: number, y: number, seats: number): void {
  const w = 60 + seats * 16;
  groundShadow(ctx, x, y, w);
  rrPath(ctx, x - w / 2, y - 30, w, 10, 4);
  fillStroke(ctx, C.wood, 2.5);
  rrPath(ctx, x - w / 2, y - 52, w, 10, 4);
  fillStroke(ctx, C.wood, 2.5);
  rrPath(ctx, x - w / 2 + 6, y - 22, 8, 22, 3);
  fillStroke(ctx, C.woodDark, 2);
  rrPath(ctx, x + w / 2 - 14, y - 22, 8, 22, 3);
  fillStroke(ctx, C.woodDark, 2);
}

export function drawCart(ctx: Ctx, x: number, y: number, level: number, time: number, moving: boolean, motion: boolean): void {
  groundShadow(ctx, x, y, 100);
  const bob = moving && motion ? Math.abs(Math.sin(time * 10)) * 2 : 0;
  ctx.save();
  ctx.translate(x, y - bob);
  rrPath(ctx, -46, -58, 92, 40, 8);
  fillStroke(ctx, level >= 10 ? C.lemon : C.coral);
  rrPath(ctx, -38, -76, 60, 20, 4);
  fillStroke(ctx, C.wood, 2.5);
  for (let i = 0; i < 3; i++) drawLemon(ctx, -28 + i * 18, -80, 7, C.lemon, 0.3 * i);
  ctx.beginPath();
  ctx.moveTo(46, -44);
  ctx.lineTo(68, -58);
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  ctx.restore();
  const spin = moving && motion ? time * 8 : 0;
  for (const wx of [-28, 28]) {
    ctx.save();
    ctx.translate(x + wx, y - 12);
    ctx.rotate(spin);
    ellipse(ctx, 0, 0, 12, 12);
    fillStroke(ctx, C.cream, 2.5);
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Characters

export type Mood = "happy" | "delighted" | "sad" | "neutral";

function face(ctx: Ctx, x: number, y: number, r: number, mood: Mood, blink: boolean): void {
  ctx.fillStyle = C.cocoa;
  ctx.strokeStyle = C.cocoa;
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  const ex = r * 0.38;
  const ey = y - r * 0.05;
  if (mood === "delighted") {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sx * ex, ey + 2, r * 0.14, Math.PI, 0);
      ctx.stroke();
    }
  } else if (blink) {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * ex - 3, ey);
      ctx.lineTo(x + sx * ex + 3, ey);
      ctx.stroke();
    }
  } else {
    for (const sx of [-1, 1]) {
      ellipse(ctx, x + sx * ex, ey, r * 0.1, r * 0.13);
      ctx.fill();
    }
  }
  ctx.fillStyle = C.blush;
  for (const sx of [-1, 1]) {
    ellipse(ctx, x + sx * r * 0.6, y + r * 0.22, r * 0.16, r * 0.1);
    ctx.fill();
  }
  ctx.beginPath();
  if (mood === "sad") {
    ctx.moveTo(x - r * 0.15, y + r * 0.38);
    ctx.quadraticCurveTo(x, y + r * 0.3, x + r * 0.15, y + r * 0.38);
  } else {
    ctx.arc(x, y + r * 0.2, mood === "neutral" ? r * 0.12 : r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.stroke();
}

export function drawCustomer(ctx: Ctx, x: number, y: number, def: CustomerDef, mood: Mood, t: number, walking: boolean, motion: boolean, s = 1, variant = 0): void {
  if (def.id === "mochi_cat") {
    drawCat(ctx, x, y, mood, t, walking, motion, s * 0.95, variant);
    return;
  }
  const a = def.art;
  const hop = walking && motion ? Math.abs(Math.sin(t * 10)) * 4 : motion ? Math.sin(t * 2.5) * 1 : 0;
  groundShadow(ctx, x, y, 44 * s);
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(s, s);
  const headR = def.id === "turtle" ? 17 : 20;
  // Tails and shells behind the body
  if (a.ears === "squirrel") {
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.bezierCurveTo(45, -10, 45, -60, 20, -58);
    ctx.bezierCurveTo(34, -40, 26, -24, 10, -22);
    ctx.closePath();
    fillStroke(ctx, a.body);
  } else if (a.ears === "fox") {
    ctx.beginPath();
    ctx.moveTo(10, -12);
    ctx.quadraticCurveTo(42, -14, 38, -38);
    ctx.quadraticCurveTo(28, -22, 10, -24);
    ctx.closePath();
    fillStroke(ctx, a.body);
    ellipse(ctx, 37, -35, 4, 5);
    ctx.fillStyle = a.accent;
    ctx.fill();
  }
  if (a.shell) {
    ellipse(ctx, 6, -22, 24, 20);
    fillStroke(ctx, a.accent);
    ctx.strokeStyle = C.cocoa;
    ctx.lineWidth = 2;
    star(ctx, 6, -24, 10, 6, 0.8);
    ctx.stroke();
  }
  if (a.ears === "sun") {
    ctx.fillStyle = C.gold;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + (motion ? t : 0) * 0.8;
      ctx.save();
      ctx.translate(0, -48);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-5, -headR - 2);
      ctx.lineTo(0, -headR - 13);
      ctx.lineTo(5, -headR - 2);
      ctx.closePath();
      fillStroke(ctx, C.gold, 2);
      ctx.restore();
    }
  }
  // Body + feet
  ellipse(ctx, -7, -2, 6, 4);
  fillStroke(ctx, a.accent, 2);
  ellipse(ctx, 7, -2, 6, 4);
  fillStroke(ctx, a.accent, 2);
  ellipse(ctx, 0, -18, 16, 16);
  fillStroke(ctx, a.body);
  ellipse(ctx, 0, -14, 9, 9);
  ctx.fillStyle = a.accent === C.white ? C.cream : C.white;
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;
  // Ears
  const hy = -48;
  const earPairs = (fn: (sx: number) => void) => [-1, 1].forEach(fn);
  switch (a.ears) {
    case "cat":
      earPairs((sx) => {
        ctx.beginPath();
        ctx.moveTo(sx * 6, hy - 16);
        ctx.lineTo(sx * 17, hy - 28);
        ctx.lineTo(sx * 19, hy - 8);
        ctx.closePath();
        fillStroke(ctx, a.body);
      });
      break;
    case "rabbit":
      earPairs((sx) => {
        ellipse(ctx, sx * 9, hy - 32, 6, 18, sx * 0.15);
        fillStroke(ctx, a.body);
        ellipse(ctx, sx * 9, hy - 32, 2.8, 12, sx * 0.15);
        ctx.fillStyle = a.accent;
        ctx.fill();
      });
      break;
    case "squirrel":
    case "otter":
      earPairs((sx) => {
        ellipse(ctx, sx * 15, hy - 14, 6, 6);
        fillStroke(ctx, a.body);
      });
      break;
    case "fox":
      earPairs((sx) => {
        ctx.beginPath();
        ctx.moveTo(sx * 5, hy - 16);
        ctx.lineTo(sx * 16, hy - 34);
        ctx.lineTo(sx * 20, hy - 6);
        ctx.closePath();
        fillStroke(ctx, a.body);
      });
      break;
    default:
      break;
  }
  // Head
  ellipse(ctx, 0, hy, headR + 1, headR);
  fillStroke(ctx, a.body);
  if (a.ears === "fox" || a.ears === "otter") {
    ellipse(ctx, 0, hy + 8, 11, 8);
    ctx.fillStyle = a.accent;
    ctx.fill();
  }
  if (def.id === "duckling") {
    ctx.beginPath();
    ctx.moveTo(-3, hy - headR + 2);
    ctx.quadraticCurveTo(0, hy - headR - 10, 5, hy - headR - 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.cocoa;
    ctx.stroke();
  }
  const blink = motion && Math.sin(t * 1.3 + x) > 0.985;
  face(ctx, 0, hy, headR, mood, blink);
  if (def.id === "duckling") {
    ellipse(ctx, 0, hy + 5, 8, 4);
    fillStroke(ctx, a.accent, 2);
  }
  if (a.ears === "otter") {
    ctx.strokeStyle = C.cocoa;
    ctx.lineWidth = 1.2;
    earPairs((sx) => {
      ctx.beginPath();
      ctx.moveTo(sx * 8, hy + 6);
      ctx.lineTo(sx * 18, hy + 3);
      ctx.stroke();
    });
  }
  ctx.restore();
}

export function drawHelper(ctx: Ctx, x: number, y: number, def: HelperDef, t: number, working: boolean, motion: boolean, s = 1): void {
  const a = def.art;
  const bounce = motion ? (working ? Math.abs(Math.sin(t * 12)) * 5 : Math.sin(t * 2 + x) * 1.5) : 0;
  groundShadow(ctx, x, y, 38 * s);
  ctx.save();
  ctx.translate(x, y - bounce);
  ctx.scale(s, s);
  // Bean body
  rrPath(ctx, -17, -52, 34, 52, 17);
  fillStroke(ctx, a.body);
  // Apron
  ctx.beginPath();
  ctx.moveTo(-12, -26);
  ctx.lineTo(12, -26);
  ctx.lineTo(10, -4);
  ctx.quadraticCurveTo(0, 0, -10, -4);
  ctx.closePath();
  fillStroke(ctx, a.accent, 2);
  face(ctx, 0, -38, 14, working ? "delighted" : "happy", false);
  // Accessory per helper
  ctx.save();
  switch (def.id) {
    case "pip":
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(0, -62);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.deepLeaf;
      ctx.stroke();
      ellipse(ctx, -6, -64, 7, 4, -0.5);
      fillStroke(ctx, C.leaf, 2);
      ellipse(ctx, 6, -64, 7, 4, 0.5);
      fillStroke(ctx, C.leaf, 2);
      break;
    case "roo":
      ctx.beginPath();
      ctx.ellipse(0, -50, 16, 7, 0, Math.PI, 0);
      ctx.lineTo(22, -50);
      ctx.closePath();
      fillStroke(ctx, C.coral, 2);
      break;
    case "basil":
      rrPath(ctx, -15, -46, 30, 7, 3);
      fillStroke(ctx, C.cocoa, 1);
      ellipse(ctx, -6, -43, 4, 4);
      fillStroke(ctx, C.sky, 1.5);
      ellipse(ctx, 6, -43, 4, 4);
      fillStroke(ctx, C.sky, 1.5);
      break;
    case "peony":
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        ellipse(ctx, 10 + Math.cos(ang) * 5, -52 + Math.sin(ang) * 5, 4, 4);
        fillStroke(ctx, C.coral, 1.5);
      }
      ellipse(ctx, 10, -52, 3, 3);
      fillStroke(ctx, C.lemon, 1.5);
      break;
    case "mochi":
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(-9, -30);
      ctx.lineTo(-9, -18);
      ctx.closePath();
      ctx.moveTo(0, -24);
      ctx.lineTo(9, -30);
      ctx.lineTo(9, -18);
      ctx.closePath();
      fillStroke(ctx, C.coral, 2);
      break;
    case "coco":
      star(ctx, 9, -16, 6);
      fillStroke(ctx, C.lemon, 1.5);
      break;
    case "nori":
      ctx.beginPath();
      ctx.ellipse(0, -48, 16, 12, 0, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, C.sky, 2);
      ellipse(ctx, 0, -61, 4, 4);
      fillStroke(ctx, C.white, 1.5);
      break;
    case "sunny":
      rrPath(ctx, -17, -54, 34, 6, 3);
      fillStroke(ctx, C.lemon, 2);
      ctx.beginPath();
      ctx.moveTo(4, -50);
      ctx.quadraticCurveTo(20, -50, 26, -44);
      ctx.lineTo(4, -46);
      ctx.closePath();
      fillStroke(ctx, C.lemon, 2);
      break;
  }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Scenery

export function drawCloud(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = C.white;
  ctx.globalAlpha = 0.9;
  for (const [cx, cy, r] of [[0, 0, 24], [26, -10, 30], [56, 0, 22], [28, 8, 22]] as const) {
    ellipse(ctx, x + cx * s, y + cy * s, r * s, r * s * 0.85);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawHouse(ctx: Ctx, x: number, y: number, w: number, h: number, wall: string, roof: string): void {
  rrPath(ctx, x - w / 2, y - h, w, h, 6);
  fillStroke(ctx, wall, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 10, y - h + 4);
  ctx.lineTo(x, y - h - w * 0.45);
  ctx.lineTo(x + w / 2 + 10, y - h + 4);
  ctx.closePath();
  fillStroke(ctx, roof, 2.5);
  rrPath(ctx, x - w * 0.12, y - h * 0.45, w * 0.24, h * 0.45, 4);
  fillStroke(ctx, C.woodDark, 2);
  rrPath(ctx, x - w * 0.38, y - h * 0.75, w * 0.18, h * 0.22, 3);
  fillStroke(ctx, C.sky, 2);
  rrPath(ctx, x + w * 0.2, y - h * 0.75, w * 0.18, h * 0.22, 3);
  fillStroke(ctx, C.sky, 2);
}

export function drawFence(ctx: Ctx, x0: number, x1: number, y: number): void {
  rrPath(ctx, x0, y - 30, x1 - x0, 7, 3);
  fillStroke(ctx, C.white, 2);
  for (let x = x0 + 6; x < x1; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 40);
    ctx.lineTo(x + 6, y - 46);
    ctx.lineTo(x + 12, y - 40);
    ctx.lineTo(x + 12, y);
    ctx.closePath();
    fillStroke(ctx, C.white, 2);
  }
}

export function drawPicnicTable(ctx: Ctx, x: number, y: number): void {
  groundShadow(ctx, x, y, 110);
  rrPath(ctx, x - 40, y - 34, 10, 34, 3);
  fillStroke(ctx, C.woodDark, 2);
  rrPath(ctx, x + 30, y - 34, 10, 34, 3);
  fillStroke(ctx, C.woodDark, 2);
  rrPath(ctx, x - 55, y - 42, 110, 14, 4);
  fillStroke(ctx, C.white, 2.5);
  ctx.fillStyle = C.coral;
  for (let i = 0; i < 8; i += 2) ctx.fillRect(x - 55 + i * 13.75, y - 42, 13.75, 14);
  rrPath(ctx, x - 55, y - 42, 110, 14, 4);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  rrPath(ctx, x - 62, y - 16, 124, 7, 3);
  fillStroke(ctx, C.wood, 2);
}

export function drawStall(ctx: Ctx, x: number, y: number, stripe: string): void {
  rrPath(ctx, x - 45, y - 50, 90, 50, 5);
  fillStroke(ctx, C.cream, 2.5);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 55 + i * 22, y - 80);
    ctx.lineTo(x - 33 + i * 22, y - 80);
    ctx.lineTo(x - 33 + i * 22, y - 62);
    ctx.arc(x - 44 + i * 22, y - 62, 11, 0, Math.PI);
    ctx.closePath();
    fillStroke(ctx, i % 2 ? C.white : stripe, 2);
  }
  for (let i = 0; i < 3; i++) {
    ellipse(ctx, x - 22 + i * 22, y - 56, 7, 7);
    fillStroke(ctx, [C.lemon, C.coral, C.leaf][i], 2);
  }
}

export function drawSignpost(ctx: Ctx, x: number, y: number, text: string, cost: string): void {
  rrPath(ctx, x - 4, y - 70, 8, 70, 3);
  fillStroke(ctx, C.woodDark, 2.5);
  ctx.font = `700 13px ${FONT}`;
  const w = Math.max(ctx.measureText(text).width, 60) + 22;
  rrPath(ctx, x - w / 2, y - 96, w, 42, 8);
  fillStroke(ctx, C.wood, 2.5);
  label(ctx, text, x, y - 84, 13, C.cocoa);
  label(ctx, cost, x, y - 66, 12, C.cocoa);
}

export function drawLantern(ctx: Ctx, x: number, y: number, color: string, glow: number): void {
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,217,90,${0.25 * glow})`;
    ellipse(ctx, x, y, 18, 18);
    ctx.fill();
  }
  rrPath(ctx, x - 8, y - 10, 16, 20, 7);
  fillStroke(ctx, color, 2);
}

export function drawHedge(ctx: Ctx, x0: number, x1: number, y: number): void {
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.deepLeaf;
  for (let x = x0; x < x1; x += 34) {
    ellipse(ctx, x, y - 16, 22, 18);
    ctx.stroke();
  }
  ctx.fillStyle = "#5FAF5A";
  for (let x = x0; x < x1; x += 34) {
    ellipse(ctx, x, y - 16, 22, 18);
    ctx.fill();
  }
}

export function drawBoat(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 36, y - 10);
  ctx.lineTo(x + 36, y - 10);
  ctx.lineTo(x + 26, y + 6);
  ctx.lineTo(x - 26, y + 6);
  ctx.closePath();
  fillStroke(ctx, C.coral, 2.5);
  rrPath(ctx, x - 2, y - 48, 4, 40, 2);
  fillStroke(ctx, C.woodDark, 2);
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 46);
  ctx.lineTo(x + 26, y - 16);
  ctx.lineTo(x + 2, y - 16);
  ctx.closePath();
  fillStroke(ctx, C.white, 2);
}

// ---------------------------------------------------------------------------
// Cat (Mochi Cat customer): the lane's mascot, drawn with extra care.

interface CatCoat {
  base: string;
  mark: string;
  belly: string;
  inner: string;
  eye: string;
  collar: string;
  pattern: "tabby" | "calico" | "cream";
  patch2?: string;
}

export const CAT_COATS: CatCoat[] = [
  { base: "#F7B46A", mark: "#D9803C", belly: "#FFF4E6", inner: "#F7A8A0", eye: "#6CBF5A", collar: C.coral, pattern: "tabby" },
  { base: "#FFF6EA", mark: "#F2A04E", belly: "#FFFDF7", inner: "#F7A8A0", eye: "#E8A33D", collar: C.sky, pattern: "calico", patch2: "#6B5345" },
  { base: "#B9BFCB", mark: "#8E95A3", belly: "#F2F2F6", inner: "#F4B8C0", eye: "#6FB6E0", collar: C.lemon, pattern: "tabby" },
  { base: "#F6E2C8", mark: "#E9C39E", belly: "#FFFDF7", inner: "#F7A8A0", eye: "#9C7358", collar: C.leaf, pattern: "cream" },
];

/**
 * A chibi cat with big glossy eyes, rounded ears, cheek fluff, an ω mouth, whiskers, a collar bell
 * and a swishing tail. `variant` picks the coat; `t` drives idle animation.
 */
export function drawCat(ctx: Ctx, x: number, y: number, mood: Mood, t: number, walking: boolean, motion: boolean, s = 1, variant = 0): void {
  const coat = CAT_COATS[((variant % CAT_COATS.length) + CAT_COATS.length) % CAT_COATS.length];
  const sad = mood === "sad";
  const hop = walking && motion ? Math.abs(Math.sin(t * 10)) * 5 : 0;
  const breathe = motion && !walking ? Math.sin(t * 2.4) * 0.025 : 0;
  const squash = walking && motion ? Math.sin(t * 20) * 0.04 : 0;

  groundShadow(ctx, x, y, 50 * s);
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(s * (1 + squash), s * (1 - squash + breathe));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Tail: thick S-curve with a striped tip, swishing (faster when delighted).
  const swish = motion ? Math.sin(t * (mood === "delighted" ? 7 : 2.2)) * (sad ? 0.1 : 0.3) : 0;
  const tailPath = () => {
    ctx.beginPath();
    ctx.moveTo(10, -12);
    ctx.bezierCurveTo(34, -10, 40 + swish * 20, -30, 30 + swish * 26, sad ? -30 : -50);
    ctx.quadraticCurveTo(26 + swish * 30, sad ? -24 : -60, 20 + swish * 26, sad ? -20 : -58);
  };
  tailPath();
  ctx.lineWidth = 12;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();
  tailPath();
  ctx.lineWidth = 7;
  ctx.strokeStyle = coat.base;
  ctx.stroke();
  // Tip
  ctx.save();
  ctx.translate(26 + swish * 28, sad ? -26 : -55);
  ellipse(ctx, 0, 0, 4.5, 4.5);
  ctx.fillStyle = coat.pattern === "calico" ? coat.patch2! : coat.mark;
  ctx.fill();
  ctx.restore();

  // Back feet
  for (const sx of [-1, 1]) {
    const step = walking && motion ? Math.sin(t * 20 + (sx > 0 ? Math.PI : 0)) * 2 : 0;
    ellipse(ctx, sx * 10, -3 - Math.max(0, step), 7.5, 4.8);
    fillStroke(ctx, coat.base, 2.5);
  }

  // Body (pear) + belly
  ctx.beginPath();
  ctx.moveTo(-15, -4);
  ctx.bezierCurveTo(-20, -18, -15, -36, 0, -37);
  ctx.bezierCurveTo(15, -36, 20, -18, 15, -4);
  ctx.quadraticCurveTo(0, 2, -15, -4);
  ctx.closePath();
  fillStroke(ctx, coat.base, 3);
  ellipse(ctx, 0, -16, 9.5, 11.5);
  ctx.fillStyle = coat.belly;
  ctx.fill();
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.mark;
    ctx.lineWidth = 2.4;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 17, -24);
      ctx.quadraticCurveTo(sx * 13, -22, sx * 12, -18);
      ctx.moveTo(sx * 17, -16);
      ctx.quadraticCurveTo(sx * 14, -14, sx * 13, -10);
      ctx.stroke();
    }
  }

  // Front paws (one waves when delighted)
  const wave = mood === "delighted" && motion ? Math.sin(t * 14) * 0.5 : 0;
  ellipse(ctx, 6, -6, 5.5, 4.3);
  fillStroke(ctx, coat.pattern === "calico" ? C.white : coat.base, 2.2);
  if (mood === "delighted") {
    ctx.save();
    ctx.translate(-13, -26);
    ctx.rotate(-0.6 + wave);
    rrPath(ctx, -4.5, -14, 9, 16, 4.5);
    fillStroke(ctx, coat.base, 2.2);
    ellipse(ctx, 0, -12, 5.5, 5);
    fillStroke(ctx, coat.pattern === "calico" ? C.white : coat.base, 2.2);
    ctx.fillStyle = coat.inner;
    ellipse(ctx, 0, -11.5, 2.2, 1.8);
    ctx.fill();
    ctx.restore();
  } else {
    ellipse(ctx, -6, -6, 5.5, 4.3);
    fillStroke(ctx, coat.pattern === "calico" ? C.white : coat.base, 2.2);
  }

  // Collar + bell
  rrPath(ctx, -12.5, -37, 25, 6, 3);
  fillStroke(ctx, coat.collar, 2);
  const bellSwing = motion ? Math.sin(t * 5) * 1.2 : 0;
  ellipse(ctx, bellSwing, -29.5, 4, 4);
  fillStroke(ctx, C.gold, 1.8);
  ctx.beginPath();
  ctx.moveTo(bellSwing - 2, -28.5);
  ctx.lineTo(bellSwing + 2, -28.5);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = C.cocoa;
  ctx.stroke();

  // Head group
  const hy = -58;
  const tilt = motion ? Math.sin(t * 1.6) * 0.05 + (mood === "delighted" ? Math.sin(t * 6) * 0.06 : 0) : 0;
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(tilt);

  // Ears (behind head). Droop when sad; one ear twitches now and then.
  const twitch = motion && Math.sin(t * 0.9 + variant) > 0.97 ? 0.25 : 0;
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(sx * 15, -12);
    ctx.rotate(sx * (sad ? 0.75 : 0.12) + (sx < 0 ? -twitch : 0));
    ctx.beginPath();
    ctx.moveTo(-9, 6);
    ctx.quadraticCurveTo(-7, -14, 0, -20);
    ctx.quadraticCurveTo(7, -14, 9, 6);
    ctx.closePath();
    fillStroke(ctx, coat.pattern === "calico" && sx < 0 ? coat.mark : coat.base, 3);
    ctx.beginPath();
    ctx.moveTo(-4.5, 3);
    ctx.quadraticCurveTo(-3.5, -9, 0, -13);
    ctx.quadraticCurveTo(3.5, -9, 4.5, 3);
    ctx.closePath();
    ctx.fillStyle = coat.inner;
    ctx.fill();
    ctx.restore();
  }

  // Head shape with cheek fluff: stroke all parts, then fill all (seamless outline).
  const headParts: [number, number, number, number][] = [
    [0, 0, 26, 21.5],
    [-21, 6, 8, 6.5],
    [21, 6, 8, 6.5],
  ];
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.cocoa;
  for (const [hx, hy2, rx, ry] of headParts) {
    ellipse(ctx, hx, hy2, rx, ry);
    ctx.stroke();
  }
  ctx.fillStyle = coat.base;
  for (const [hx, hy2, rx, ry] of headParts) {
    ellipse(ctx, hx, hy2, rx, ry);
    ctx.fill();
  }
  // Fluff tufts on the cheeks
  ctx.strokeStyle = C.cocoa;
  ctx.lineWidth = 2;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 27, 7);
    ctx.lineTo(sx * 31, 10);
    ctx.moveTo(sx * 26, 11);
    ctx.lineTo(sx * 29, 14);
    ctx.stroke();
  }

  // Markings, clipped to the head
  ctx.save();
  ellipse(ctx, 0, 0, 25, 20.5);
  ctx.clip();
  if (coat.pattern === "calico") {
    ctx.fillStyle = coat.mark;
    ellipse(ctx, -15, -9, 15, 12);
    ctx.fill();
    ctx.fillStyle = coat.patch2!;
    ellipse(ctx, 17, -14, 11, 8);
    ctx.fill();
  } else if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.mark;
    ctx.lineWidth = 2.8;
    for (const dx of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(dx, -21);
      ctx.lineTo(dx * 0.8, -13 + Math.abs(dx) * 0.3);
      ctx.stroke();
    }
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 26, -2);
      ctx.lineTo(sx * 19, 0);
      ctx.moveTo(sx * 26, 4);
      ctx.lineTo(sx * 20, 5);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = coat.mark;
    ellipse(ctx, 0, -20, 12, 7);
    ctx.fill();
  }
  ctx.restore();

  // Muzzle
  ctx.fillStyle = coat.belly;
  ellipse(ctx, -5, 8, 7.5, 6);
  ctx.fill();
  ellipse(ctx, 5, 8, 7.5, 6);
  ctx.fill();

  // Blush
  ctx.fillStyle = "rgba(242,140,122,0.45)";
  ellipse(ctx, -16, 7, 5, 3);
  ctx.fill();
  ellipse(ctx, 16, 7, 5, 3);
  ctx.fill();

  // Eyes
  const blink = motion && !sad && Math.sin(t * 1.3 + variant * 2) > 0.985;
  const look = sad ? 2 : 0;
  for (const sx of [-1, 1]) {
    const ex = sx * 10.5;
    const ey = -2;
    ctx.strokeStyle = C.cocoa;
    ctx.fillStyle = C.cocoa;
    if (mood === "delighted") {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, ey + 2, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (blink) {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ex, ey - 1, 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      ellipse(ctx, ex, ey, 6.2, 7.2);
      ctx.fill();
      ellipse(ctx, ex, ey + 0.8 + look * 0.3, 4.9, 5.9);
      ctx.fillStyle = coat.eye;
      ctx.fill();
      ellipse(ctx, ex, ey + 1 + look * 0.5, 2.6, 4.2);
      ctx.fillStyle = C.cocoa;
      ctx.fill();
      ctx.fillStyle = C.white;
      ellipse(ctx, ex - 1.8, ey - 2.4, 2.2, 2.2);
      ctx.fill();
      ellipse(ctx, ex + 2, ey + 2.5, 1, 1);
      ctx.fill();
      if (sad) {
        // Soft worried brow, never cruel.
        ctx.beginPath();
        ctx.moveTo(ex - sx * 5, ey - 11);
        ctx.lineTo(ex + sx * 3, ey - 9);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = C.cocoa;
        ctx.stroke();
      }
    }
  }

  // Nose (little rounded triangle)
  ctx.beginPath();
  ctx.moveTo(-2.8, 4.2);
  ctx.quadraticCurveTo(0, 3, 2.8, 4.2);
  ctx.quadraticCurveTo(0.8, 7.4, 0, 7.4);
  ctx.quadraticCurveTo(-0.8, 7.4, -2.8, 4.2);
  ctx.closePath();
  fillStroke(ctx, "#F28C9A", 1.2);

  // Mouth: ω, open when delighted, small wobble when sad
  ctx.strokeStyle = C.cocoa;
  ctx.lineWidth = 1.6;
  if (sad) {
    ctx.beginPath();
    ctx.moveTo(-3.5, 12);
    ctx.quadraticCurveTo(0, 10, 3.5, 12);
    ctx.stroke();
  } else {
    if (mood === "delighted") {
      ctx.beginPath();
      ctx.moveTo(-3, 9.5);
      ctx.quadraticCurveTo(0, 16, 3, 9.5);
      ctx.closePath();
      fillStroke(ctx, "#E8707A", 1.4);
    }
    ctx.beginPath();
    ctx.moveTo(0, 7.4);
    ctx.lineTo(0, 8.8);
    ctx.arc(-2.4, 8.8, 2.4, 0, Math.PI * 0.95);
    ctx.moveTo(0, 8.8);
    ctx.arc(2.4, 8.8, 2.4, Math.PI, Math.PI * 0.05, true);
    ctx.stroke();
  }

  // Whiskers
  ctx.strokeStyle = "rgba(90,70,56,0.8)";
  ctx.lineWidth = 1.1;
  for (const sx of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sx * 14, 8 + i * 2.5);
      ctx.quadraticCurveTo(sx * 26, 6 + i * 4, sx * 36, 5 + i * 6);
      ctx.stroke();
    }
  }

  // Happy sparkles
  if (mood === "delighted") {
    const tw = motion ? 0.6 + 0.4 * Math.sin(t * 9) : 1;
    ctx.fillStyle = C.gold;
    star(ctx, -31, -18, 4.5 * tw, 4, 0.35);
    ctx.fill();
    star(ctx, 32, -24, 3.5 * tw, 4, 0.35);
    ctx.fill();
  }
  ctx.restore(); // head
  ctx.restore();
}
