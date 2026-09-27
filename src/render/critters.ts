// Customer critters, built with the same construction as the mascot cat: pear body with belly,
// big head with cheek fluff, glossy eyes, blush, species ears/muzzle/tail and one personality prop.
import type { CustomerId } from "../content/types";
import { C } from "./palette";
import { ellipse, fillStroke, groundShadow, rrPath, star, drawLemon, type Mood } from "./draw";

type Ctx = CanvasRenderingContext2D;

interface CritterSpec {
  base: string;
  belly: string;
  inner: string;
  eye: string;
  ears: "rabbit" | "squirrel" | "round" | "fox" | "none";
  tail: "pom" | "bushy" | "otter" | "fox" | "none";
  muzzle: "bunny" | "beak" | "squirrel" | "otter" | "fox" | "plain";
  prop?: "bow" | "acorn" | "scarf" | "hat" | "crown" | "shell" | "wings";
  shell?: [string, string];
  rays?: boolean;
  feet?: string;
  headR?: number;
}

export const CRITTERS: Record<Exclude<CustomerId, "mochi_cat">, CritterSpec> = {
  bun_rabbit: { base: "#FFFDF7", belly: "#FFF0F3", inner: "#F4A3B8", eye: "#C0607E", ears: "rabbit", tail: "pom", muzzle: "bunny", prop: "bow" },
  duckling: { base: "#FFE680", belly: "#FFF4C2", inner: "#F7A541", eye: "#5A4638", ears: "none", tail: "none", muzzle: "beak", prop: "wings", feet: "#F7A541" },
  squirrel: { base: "#D08A56", belly: "#FFF4D6", inner: "#F7A8A0", eye: "#5A4638", ears: "squirrel", tail: "bushy", muzzle: "squirrel", prop: "acorn" },
  otter: { base: "#A07A5C", belly: "#EFDCC6", inner: "#C9A585", eye: "#3E2F26", ears: "round", tail: "otter", muzzle: "otter", prop: "shell" },
  fox: { base: "#F28C4A", belly: "#FFFDF7", inner: "#FFF4D6", eye: "#E8A33D", ears: "fox", tail: "fox", muzzle: "fox", prop: "scarf" },
  turtle: { base: "#9BD58A", belly: "#E6F4C8", inner: "#79C96B", eye: "#3E2F26", ears: "none", tail: "none", muzzle: "plain", prop: "hat", shell: ["#5E9E57", "#8CCB78"], headR: 21 },
  golden_sun: { base: "#FFD95A", belly: "#FFF1B8", inner: "#F7A541", eye: "#8A5A2B", ears: "none", tail: "none", muzzle: "plain", prop: "crown", rays: true },
};

/** Highest point of each customer above its feet (unscaled), used to place order bubbles clear of ears. */
export const CUSTOMER_TOP: Record<CustomerId, number> = {
  mochi_cat: 84,
  bun_rabbit: 112,
  duckling: 86,
  squirrel: 84,
  otter: 80,
  fox: 92,
  turtle: 88,
  golden_sun: 108,
};

export function glossyEye(ctx: Ctx, ex: number, ey: number, iris: string, mood: Mood, blink: boolean, size = 1): void {
  ctx.strokeStyle = C.cocoa;
  ctx.fillStyle = C.cocoa;
  if (mood === "delighted") {
    ctx.lineWidth = 3 * size;
    ctx.beginPath();
    ctx.arc(ex, ey + 2 * size, 5 * size, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    return;
  }
  if (blink) {
    ctx.lineWidth = 2.5 * size;
    ctx.beginPath();
    ctx.arc(ex, ey - 1, 5 * size, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    return;
  }
  const look = mood === "sad" ? 1.5 : 0;
  ellipse(ctx, ex, ey, 6 * size, 7 * size);
  ctx.fill();
  ellipse(ctx, ex, ey + (0.8 + look * 0.3) * size, 4.7 * size, 5.7 * size);
  ctx.fillStyle = iris;
  ctx.fill();
  ellipse(ctx, ex, ey + (1 + look * 0.5) * size, 2.5 * size, 4 * size);
  ctx.fillStyle = C.cocoa;
  ctx.fill();
  ctx.fillStyle = C.white;
  ellipse(ctx, ex - 1.8 * size, ey - 2.4 * size, 2.2 * size, 2.2 * size);
  ctx.fill();
  ellipse(ctx, ex + 2 * size, ey + 2.5 * size, 1 * size, 1 * size);
  ctx.fill();
}

function outlineFill(ctx: Ctx, parts: [number, number, number, number][], fill: string, lw = 6): void {
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.cocoa;
  for (const [x, y, rx, ry] of parts) {
    ellipse(ctx, x, y, rx, ry);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const [x, y, rx, ry] of parts) {
    ellipse(ctx, x, y, rx, ry);
    ctx.fill();
  }
}

export function drawCritter(ctx: Ctx, id: Exclude<CustomerId, "mochi_cat">, x: number, y: number, mood: Mood, t: number, walking: boolean, motion: boolean, s = 1): void {
  const sp = CRITTERS[id];
  const sad = mood === "sad";
  const delighted = mood === "delighted";
  const hop = walking && motion ? Math.abs(Math.sin(t * 10)) * 5 : 0;
  const breathe = motion && !walking ? Math.sin(t * 2.4) * 0.025 : 0;
  const squash = walking && motion ? Math.sin(t * 20) * 0.04 : 0;
  const swish = motion ? Math.sin(t * (delighted ? 7 : 2.2)) * (sad ? 0.08 : 0.25) : 0;
  const headR = sp.headR ?? 24;

  groundShadow(ctx, x, y, (sp.shell ? 62 : 50) * s);
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(s * (1 + squash), s * (1 - squash + breathe));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Sun rays behind everything
  if (sp.rays) {
    // A halo of rounded rays hugging the head, gently turning.
    const rot = motion ? t * 0.6 : 0;
    for (let i = 0; i < 14; i++) {
      const a = rot + (i / 14) * Math.PI * 2;
      ctx.save();
      ctx.translate(0, -58);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-7, -22);
      ctx.quadraticCurveTo(0, -42 - (i % 2) * 6, 7, -22);
      ctx.closePath();
      fillStroke(ctx, i % 2 ? C.gold : "#FFB347", 2.4);
      ctx.restore();
    }
  }

  // Tails (behind the body)
  switch (sp.tail) {
    case "pom":
      outlineFill(ctx, [[15, -12, 7, 7], [19, -16, 5, 5]], C.white, 5);
      break;
    case "bushy": {
      ctx.save();
      ctx.translate(12, -8);
      ctx.rotate(swish * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(34, 4, 44, -40, 22, -66);
      ctx.bezierCurveTo(10, -80, -8, -68, 2, -54);
      ctx.bezierCurveTo(16, -56, 22, -38, 8, -18);
      ctx.closePath();
      fillStroke(ctx, sp.base, 3);
      ctx.beginPath();
      ctx.moveTo(10, -10);
      ctx.bezierCurveTo(28, -14, 30, -44, 16, -60);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#E8B083";
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "otter": {
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.quadraticCurveTo(34, -2, 40 + swish * 8, -14);
      ctx.lineWidth = 13;
      ctx.strokeStyle = C.cocoa;
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = sp.base;
      ctx.stroke();
      break;
    }
    case "fox": {
      ctx.save();
      ctx.translate(12, -10);
      ctx.rotate(swish * 0.5 - 0.1);
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.bezierCurveTo(26, 8, 44, -12, 40, -38);
      ctx.bezierCurveTo(30, -30, 16, -24, 2, -14);
      ctx.closePath();
      fillStroke(ctx, sp.base, 3);
      ctx.save();
      ctx.clip();
      ellipse(ctx, 40, -36, 11, 12);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.restore();
      ctx.restore();
      break;
    }
    default:
      break;
  }

  // Turtle shell sits on the back
  if (sp.shell) {
    ellipse(ctx, 4, -26, 27, 23);
    fillStroke(ctx, sp.shell[0], 3);
    ctx.fillStyle = sp.shell[1];
    for (const [px, py, r] of [[4, -30, 8], [-10, -22, 6], [18, -22, 6], [4, -14, 5], [-6, -40, 5], [14, -40, 5]] as const) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(4 + (px - 4) + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    ellipse(ctx, 4, -26, 27, 23);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.cocoa;
    ctx.stroke();
  }

  // Feet
  for (const sx of [-1, 1]) {
    const step = walking && motion ? Math.max(0, Math.sin(t * 20 + (sx > 0 ? Math.PI : 0)) * 2) : 0;
    if (sp.feet) {
      ctx.beginPath();
      ctx.moveTo(sx * 10 - 8, -1 - step);
      ctx.lineTo(sx * 10 + 8, -1 - step);
      ctx.lineTo(sx * 10 + 3, -8 - step);
      ctx.lineTo(sx * 10 - 3, -8 - step);
      ctx.closePath();
      fillStroke(ctx, sp.feet, 2.4);
    } else {
      ellipse(ctx, sx * 10, -3 - step, 7.5, 4.8);
      fillStroke(ctx, sp.shell ? sp.base : sp.base, 2.5);
    }
  }

  // Body
  ctx.beginPath();
  ctx.moveTo(-15, -4);
  ctx.bezierCurveTo(-20, -18, -15, -36, 0, -37);
  ctx.bezierCurveTo(15, -36, 20, -18, 15, -4);
  ctx.quadraticCurveTo(0, 2, -15, -4);
  ctx.closePath();
  fillStroke(ctx, sp.base, 3);
  ellipse(ctx, 0, -16, 9.5, 11.5);
  ctx.fillStyle = sp.belly;
  ctx.fill();

  // Arms / wings
  if (sp.prop === "wings") {
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * 15, -22);
      ctx.rotate(sx * (delighted && motion ? 0.6 + Math.sin(t * 16) * 0.4 : 0.35));
      ellipse(ctx, sx * 4, 4, 6, 11);
      fillStroke(ctx, sp.base, 2.4);
      ctx.restore();
    }
  } else {
    const wave = delighted && motion ? Math.sin(t * 14) * 0.5 : 0;
    ellipse(ctx, 6, -8, 5.5, 4.3);
    fillStroke(ctx, sp.base, 2.2);
    if (delighted) {
      ctx.save();
      ctx.translate(-13, -26);
      ctx.rotate(-0.6 + wave);
      rrPath(ctx, -4.5, -14, 9, 16, 4.5);
      fillStroke(ctx, sp.base, 2.2);
      ctx.restore();
    } else {
      ellipse(ctx, -6, -8, 5.5, 4.3);
      fillStroke(ctx, sp.base, 2.2);
    }
  }

  // Held props
  if (sp.prop === "acorn") {
    ellipse(ctx, 0, -11, 7, 8);
    fillStroke(ctx, "#B97A45", 2);
    ctx.beginPath();
    ctx.ellipse(0, -16, 8, 4.5, 0, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, "#7A5236", 2);
  } else if (sp.prop === "shell") {
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.quadraticCurveTo(0, -24, 8, -8);
    ctx.closePath();
    fillStroke(ctx, "#F9C79A", 2);
    ctx.beginPath();
    for (const dx of [-4, 0, 4]) {
      ctx.moveTo(0, -18);
      ctx.lineTo(dx * 1.4, -9);
    }
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  if (sp.prop === "scarf") {
    rrPath(ctx, -13, -38, 26, 7, 3.5);
    fillStroke(ctx, C.sky, 2);
    rrPath(ctx, 6, -34, 7, 14, 3);
    fillStroke(ctx, C.sky, 2);
  }

  // ---- Head
  const hy = sp.shell ? -52 : -58;
  const tilt = motion ? Math.sin(t * 1.6) * 0.05 + (delighted ? Math.sin(t * 6) * 0.06 : 0) : 0;
  ctx.save();
  ctx.translate(sp.shell ? -6 : 0, hy);
  ctx.rotate(tilt);

  // Ears behind the head
  switch (sp.ears) {
    case "rabbit":
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.translate(sx * 9, -16);
        const flop = sx > 0 ? 0.35 + (sad ? 0.6 : 0) : sad ? -0.6 : -0.08;
        ctx.rotate(flop + (motion ? Math.sin(t * 2 + sx) * 0.05 : 0));
        ellipse(ctx, 0, -20, 7.5, 21);
        fillStroke(ctx, sp.base, 3);
        ellipse(ctx, 0, -19, 3.6, 15);
        ctx.fillStyle = sp.inner;
        ctx.fill();
        ctx.restore();
      }
      break;
    case "squirrel":
    case "fox": {
      const tall = sp.ears === "fox" ? 24 : 16;
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.translate(sx * 15, -12);
        ctx.rotate(sx * (sad ? 0.7 : 0.18));
        ctx.beginPath();
        ctx.moveTo(-9, 6);
        ctx.quadraticCurveTo(-5, -tall * 0.6, 0, -tall);
        ctx.quadraticCurveTo(5, -tall * 0.6, 9, 6);
        ctx.closePath();
        fillStroke(ctx, sp.base, 3);
        ctx.beginPath();
        ctx.moveTo(-4.5, 3);
        ctx.quadraticCurveTo(-2.5, -tall * 0.4, 0, -tall * 0.7);
        ctx.quadraticCurveTo(2.5, -tall * 0.4, 4.5, 3);
        ctx.closePath();
        ctx.fillStyle = sp.inner;
        ctx.fill();
        if (sp.ears === "fox") {
          ctx.beginPath();
          ctx.moveTo(-3.5, -tall * 0.72);
          ctx.quadraticCurveTo(0, -tall - 1, 3.5, -tall * 0.72);
          ctx.lineWidth = 3;
          ctx.strokeStyle = C.cocoa;
          ctx.stroke();
        } else {
          // Tufts
          ctx.beginPath();
          ctx.moveTo(0, -tall);
          ctx.lineTo(-3, -tall - 6);
          ctx.moveTo(0, -tall);
          ctx.lineTo(3, -tall - 5);
          ctx.lineWidth = 2;
          ctx.strokeStyle = C.cocoa;
          ctx.stroke();
        }
        ctx.restore();
      }
      break;
    }
    case "round":
      for (const sx of [-1, 1]) {
        ellipse(ctx, sx * 19, -12, 6.5, 6);
        fillStroke(ctx, sp.base, 3);
        ellipse(ctx, sx * 19, -11.5, 3, 2.6);
        ctx.fillStyle = sp.inner;
        ctx.fill();
      }
      break;
    default:
      break;
  }

  // Head shape with cheek fluff (duck and turtle heads are smoother)
  const fluffy = sp.muzzle !== "beak" && sp.muzzle !== "plain";
  const parts: [number, number, number, number][] = [[0, 0, headR + 2, headR - 2.5]];
  if (fluffy) parts.push([-(headR - 3), 6, 8, 6.5], [headR - 3, 6, 8, 6.5]);
  outlineFill(ctx, parts, sp.base);
  if (fluffy) {
    ctx.strokeStyle = C.cocoa;
    ctx.lineWidth = 2;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * (headR + 3), 7);
      ctx.lineTo(sx * (headR + 7), 10);
      ctx.stroke();
    }
  }

  // Face markings
  ctx.save();
  ellipse(ctx, 0, 0, headR + 1, headR - 3.5);
  ctx.clip();
  if (sp.muzzle === "fox") {
    ctx.fillStyle = sp.belly;
    ctx.beginPath();
    ctx.moveTo(-headR - 4, 2);
    ctx.quadraticCurveTo(-8, 4, 0, 16);
    ctx.quadraticCurveTo(8, 4, headR + 4, 2);
    ctx.lineTo(headR + 4, 30);
    ctx.lineTo(-headR - 4, 30);
    ctx.closePath();
    ctx.fill();
  } else if (sp.muzzle === "otter") {
    ellipse(ctx, 0, 6, 16, 12);
    ctx.fillStyle = sp.belly;
    ctx.fill();
  } else if (sp.muzzle === "squirrel") {
    ellipse(ctx, 0, 9, 11, 8);
    ctx.fillStyle = sp.belly;
    ctx.fill();
  } else if (sp.muzzle === "bunny") {
    ellipse(ctx, 0, 9, 10, 7);
    ctx.fillStyle = sp.belly;
    ctx.fill();
  } else if (sp.rays) {
    ctx.fillStyle = "rgba(255,253,247,0.45)";
    ellipse(ctx, -8, -10, 9, 6, -0.4);
    ctx.fill();
  }
  ctx.restore();

  // Blush
  ctx.fillStyle = "rgba(242,140,122,0.45)";
  ellipse(ctx, -15, 7, 5, 3);
  ctx.fill();
  ellipse(ctx, 15, 7, 5, 3);
  ctx.fill();

  // Eyes
  const blink = motion && !sad && Math.sin(t * 1.3 + x * 0.01) > 0.985;
  for (const sx of [-1, 1]) glossyEye(ctx, sx * 10, -2, sp.eye, mood, blink);
  if (sad) {
    ctx.strokeStyle = C.cocoa;
    ctx.lineWidth = 1.8;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 15, -10);
      ctx.lineTo(sx * 6, -14);
      ctx.stroke();
    }
  }

  // Muzzles
  ctx.strokeStyle = C.cocoa;
  ctx.lineWidth = 1.6;
  switch (sp.muzzle) {
    case "beak": {
      ctx.beginPath();
      ctx.ellipse(0, 7, 9, 4.5, 0, 0, Math.PI * 2);
      fillStroke(ctx, sp.inner, 2);
      ctx.beginPath();
      ctx.moveTo(-8, 7);
      ctx.quadraticCurveTo(0, delighted ? 12 : 9, 8, 7);
      ctx.stroke();
      break;
    }
    case "bunny":
      ellipse(ctx, 0, 5, 2.6, 2);
      fillStroke(ctx, "#F28C9A", 1.2);
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.lineTo(0, 9);
      ctx.moveTo(0, 9);
      ctx.quadraticCurveTo(-3, sad ? 9 : 12, -5, sad ? 11 : 10);
      ctx.moveTo(0, 9);
      ctx.quadraticCurveTo(3, sad ? 9 : 12, 5, sad ? 11 : 10);
      ctx.stroke();
      if (delighted) {
        rrPath(ctx, -2.2, 10, 4.4, 3.6, 1);
        fillStroke(ctx, C.white, 1);
      }
      break;
    case "squirrel":
    case "otter":
    case "fox": {
      // Little dark nose + mouth
      ellipse(ctx, 0, sp.muzzle === "fox" ? 6 : 5, sp.muzzle === "otter" ? 4 : 3, sp.muzzle === "otter" ? 2.8 : 2.2);
      ctx.fillStyle = C.cocoa;
      ctx.fill();
      ctx.beginPath();
      if (sad) {
        ctx.moveTo(-3, 12);
        ctx.quadraticCurveTo(0, 10, 3, 12);
      } else {
        ctx.moveTo(0, 8);
        ctx.lineTo(0, 9.5);
        ctx.arc(-2.4, 9.5, 2.4, 0, Math.PI * 0.95);
        ctx.moveTo(0, 9.5);
        ctx.arc(2.4, 9.5, 2.4, Math.PI, Math.PI * 0.05, true);
      }
      ctx.stroke();
      if (sp.muzzle === "otter") {
        ctx.fillStyle = "rgba(90,70,56,0.6)";
        for (const sx of [-1, 1]) for (const d of [0, 1, 2]) {
          ellipse(ctx, sx * (6 + d * 2.5), 8 + (d % 2), 0.9, 0.9);
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(90,70,56,0.7)";
        ctx.lineWidth = 1;
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sx * 12, 8);
          ctx.lineTo(sx * 26, 5);
          ctx.moveTo(sx * 12, 10);
          ctx.lineTo(sx * 26, 11);
          ctx.stroke();
        }
      }
      if (sp.muzzle === "squirrel" && !sad) {
        rrPath(ctx, -2.4, 11, 4.8, 3.8, 1);
        fillStroke(ctx, C.white, 1);
      }
      break;
    }
    default:
      ctx.beginPath();
      if (sad) {
        ctx.moveTo(-4, 11);
        ctx.quadraticCurveTo(0, 8.5, 4, 11);
        ctx.stroke();
      } else if (delighted) {
        ctx.moveTo(-5, 7);
        ctx.quadraticCurveTo(0, 15, 5, 7);
        ctx.closePath();
        fillStroke(ctx, "#E8707A", 1.4);
      } else {
        ctx.arc(0, 6, 5, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
  }

  // Head props
  switch (sp.prop) {
    case "bow": {
      ctx.save();
      ctx.translate(15, -20);
      ctx.rotate(0.3);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sx * 10, -6);
        ctx.lineTo(sx * 10, 6);
        ctx.closePath();
        fillStroke(ctx, C.coral, 2);
      }
      ellipse(ctx, 0, 0, 3.2, 3.2);
      fillStroke(ctx, C.coral, 2);
      ctx.restore();
      break;
    }
    case "hat": {
      ctx.beginPath();
      ctx.ellipse(0, -headR + 7, headR + 4, 5, 0, 0, Math.PI * 2);
      fillStroke(ctx, C.lemon, 2.5);
      ctx.beginPath();
      ctx.ellipse(0, -headR + 6, 13, 12, 0, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, C.lemon, 2.5);
      rrPath(ctx, -13, -headR + 1, 26, 4, 2);
      ctx.fillStyle = C.coral;
      ctx.fill();
      drawLemon(ctx, 9, -headR - 1, 4, C.lemon, 0.3);
      break;
    }
    case "crown": {
      ctx.beginPath();
      ctx.moveTo(-11, -headR + 4);
      ctx.lineTo(-11, -headR - 8);
      ctx.lineTo(-5, -headR - 2);
      ctx.lineTo(0, -headR - 11);
      ctx.lineTo(5, -headR - 2);
      ctx.lineTo(11, -headR - 8);
      ctx.lineTo(11, -headR + 4);
      ctx.closePath();
      fillStroke(ctx, C.gold, 2.2);
      ellipse(ctx, 0, -headR - 1, 2.2, 2.2);
      ctx.fillStyle = C.coral;
      ctx.fill();
      break;
    }
    default:
      break;
  }
  if (sp.muzzle === "beak") {
    // Head tuft
    ctx.beginPath();
    ctx.moveTo(-3, -headR + 3);
    ctx.quadraticCurveTo(-4, -headR - 10, 3, -headR - 8);
    ctx.moveTo(1, -headR + 3);
    ctx.quadraticCurveTo(4, -headR - 7, 9, -headR - 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.cocoa;
    ctx.stroke();
  }
  if (delighted) {
    const tw = motion ? 0.6 + 0.4 * Math.sin(t * 9) : 1;
    ctx.fillStyle = C.gold;
    star(ctx, -headR - 8, -18, 4.5 * tw, 4, 0.35);
    ctx.fill();
    star(ctx, headR + 8, -24, 3.5 * tw, 4, 0.35);
    ctx.fill();
  }
  ctx.restore(); // head
  ctx.restore();
}
