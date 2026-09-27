// Renderer: composes the lane scene each frame from game state. Read-only with respect to state.
import { COSMETICS, FACILITY_IDS, TUNING, WHEEL, customerById, helperById, recipeById, upgradeById } from "../content/content";
import type { HelperId, RegionId, UpgradeId } from "../content/types";
import { upgradeLocked } from "../core/actions";
import { activeRecipe, rawLemonValue, slotsOf, upgradeCost, type StatBlock } from "../core/economy";
import { FACILITY_SPOTS, GROUND_Y, GROVE_TREES, LAYOUT, WORLD_H, WORLD_W, constructionSignRect, grovePlotSpot, treeSpot, zoneLeft, type FacilitySpot, type FacilitySpotId } from "../core/layout";
import { CUSTOMER_TOP } from "./critters";
import { constructionText } from "./labels";
import { spinCooldownLeft } from "../core/wheel";
import { HOME_TREE_SLOTS } from "../core/state";
import {
  drawBeehive,
  drawChute,
  drawConstruction,
  drawEmptyPlot,
  drawFactory,
  drawFairBackdrop,
  drawFountain,
  drawGroveBackdrop,
  drawMarketBackdrop,
  drawOrderBoard,
  drawSqueezeGauge,
  drawSellCrate,
  drawSprinkler,
  drawStatue,
  drawWheel,
  type BuildState,
} from "./drawWorld";
import type { GameState, SessionState } from "../core/state";
import { nameOf } from "../content/strings";
import {
  FRUIT_SPOTS,
  drawBasket,
  drawBench,
  drawBoat,
  drawCart,
  drawCloud,
  drawCustomer,
  drawDrink,
  drawFence,
  drawFlowerPot,
  drawHedge,
  drawHelper,
  drawHouse,
  drawIceBox,
  drawLantern,
  drawLemon,
  drawPicnicTable,
  drawPress,
  drawSignpost,
  drawStall,
  drawStand,
  drawTree,
  drawUmbrella,
  ellipse,
  fillStroke,
  label,
  rrPath,
  star,
} from "./draw";
import { C } from "./palette";
import { formatNumber } from "../ui/format";

export type Hit =
  | { kind: "tree"; index: number }
  | { kind: "press" }
  | { kind: "serve" }
  | { kind: "facility"; id: UpgradeId };

interface Particle {
  kind: "text" | "lemon" | "sparkle";
  x: number;
  y: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  life: number;
  text: string;
  color: string;
  size: number;
}

const MAX_PARTICLES = 90;
const CUSTOMER_SCALE = 1.28;

const HELPER_SPOTS: Record<HelperId, { x: number; y: number; behindCounter?: boolean }> = {
  pip: { x: 262, y: GROUND_Y + 34 },
  roo: { x: 798, y: GROUND_Y + 30 },
  basil: { x: 395, y: GROUND_Y + 50 },
  peony: { x: 470, y: GROUND_Y + 86 },
  mochi: { x: 595, y: GROUND_Y - 92, behindCounter: true },
  coco: { x: 190, y: GROUND_Y + 82 },
  nori: { x: 300, y: GROUND_Y + 88 },
  sunny: { x: 710, y: GROUND_Y - 92, behindCounter: true },
};

/** The next lane spot previews itself with one signpost in a clear spot at the front-left of the stand zone. */
const REGION_SIGN = { x: 60, y: GROUND_Y + 92 };

export interface ViewExtras {
  now: number;
  reducedMotion: boolean;
  nextRegion?: RegionId;
  nextRegionCost?: number;
  pressSquash: number;
  treeShake: number[];
  helperWorking: Partial<Record<HelperId, number>>;
  cartTimer: number;
  squeezeMeter: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private particles: Particle[] = [];
  /** Camera: world x of the view's left edge, eased toward camTarget. */
  private camX = 0;
  private camTarget = 0;
  private wheelAngle = 0;
  private wheelFrom = 0;
  private wheelTo = 0;
  private wheelT = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number, dpr: number, insetBottom = 0): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.scale = Math.min(this.cssW / WORLD_W, this.cssH / WORLD_H);
    this.ox = (this.cssW - WORLD_W * this.scale) / 2;
    // Keep the ground in view: on tall screens, bias the world downward, above any bottom overlay.
    this.oy = Math.max(0, (this.cssH - insetBottom - WORLD_H * this.scale) * 0.85);
    if (this.oy + WORLD_H * this.scale > this.cssH) this.oy = (this.cssH - WORLD_H * this.scale) * 0.6;
  }

  toWorld(cssX: number, cssY: number): { x: number; y: number } {
    return { x: (cssX - this.ox) / this.scale + this.camX, y: (cssY - this.oy) / this.scale };
  }

  /** Move the camera to a zone slot (home = 0). */
  setZone(index: number, snap = false): void {
    this.camTarget = zoneLeft(index);
    if (snap) this.camX = this.camTarget;
  }

  private updateCamera(dt: number, reduced: boolean): void {
    const d = this.camTarget - this.camX;
    if (reduced || Math.abs(d) < 0.5) this.camX = this.camTarget;
    else this.camX += d * Math.min(1, dt * 7);
  }

  /** Spin the Lucky Wheel so `segment` ends under the pointer. */
  spinWheel(segment: number, reduced: boolean): void {
    const n = WHEEL.length;
    const target = -(segment / n) * Math.PI * 2;
    const base = this.wheelAngle - (this.wheelAngle % (Math.PI * 2));
    this.wheelFrom = this.wheelAngle;
    this.wheelTo = base - Math.PI * 2 * 5 + target;
    this.wheelT = reduced ? 1 : 0;
    if (reduced) this.wheelAngle = this.wheelTo;
  }

  private updateWheel(dt: number): void {
    if (this.wheelT >= 1) return;
    this.wheelT = Math.min(1, this.wheelT + dt / 2.6);
    const e = 1 - Math.pow(1 - this.wheelT, 3);
    this.wheelAngle = this.wheelFrom + (this.wheelTo - this.wheelFrom) * e;
  }

  hitTest(cssX: number, cssY: number, g: GameState): Hit | null {
    const { x, y } = this.toWorld(cssX, cssY);
    // Facilities (built or not) and the next grove plot
    for (const id of FACILITY_IDS) {
      const f = FACILITY_SPOTS[id as FacilitySpotId];
      if (f && x > f.x - f.w / 2 && x < f.x + f.w / 2 && y > f.y - f.h && y < f.y + 10) return { kind: "facility", id };
    }
    const nextPlot = slotsOf(this.lastStats?.grovePlots ?? 0);
    const plot = GROVE_TREES[nextPlot];
    if (plot && (g.upgrades.grove_plot ?? 0) < (upgradeById.get("grove_plot")?.maxLevel ?? 0) && Math.abs(x - plot.x) < 75 && y > plot.y - 190 && y < plot.y + 20) {
      return { kind: "facility", id: "grove_plot" };
    }
    // Press
    const p = LAYOUT.press;
    if (x > p.x - 62 && x < p.x + 70 && y > p.y - 160 && y < p.y + 10) return { kind: "press" };
    // Trees (front-most first)
    for (let i = 0; i < g.trees.length; i++) {
      if (!g.trees[i]?.length) continue;
      const tr = treeSpot(i);
      const cx = tr.x;
      const cy = tr.y - 175 * tr.scale;
      const r = 115 * tr.scale;
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return { kind: "tree", index: i };
      if (Math.abs(x - tr.x) < 22 * tr.scale && y < tr.y && y > tr.y - 120 * tr.scale) return { kind: "tree", index: i };
    }
    // Stand + queue
    const st = LAYOUT.stand;
    if (x > st.x - st.w / 2 && x < WORLD_W + 20 && y > GROUND_Y - 300 && y < GROUND_Y + 90) return { kind: "serve" };
    return null;
  }

  fruitWorldPos(g: GameState, tree: number, fruit: number): { x: number; y: number } {
    const tr = treeSpot(tree);
    const s = tr.scale * (tree < HOME_TREE_SLOTS ? this.treeScale(g) : 1);
    const [fx, fy] = FRUIT_SPOTS[fruit % FRUIT_SPOTS.length];
    return { x: tr.x + fx * s, y: tr.y + fy * s };
  }

  customerWorldPos(s: SessionState, uid: number): { x: number; y: number } {
    const c = s.customers.find((c) => c.uid === uid);
    return { x: c?.x ?? LAYOUT.queueFrontX, y: LAYOUT.customerY - (c ? CUSTOMER_TOP[c.type] : 90) * CUSTOMER_SCALE * 0.95 };
  }

  private treeScale(g: GameState): number {
    return 1 + Math.min(0.25, (g.upgrades.lemon_tree ?? 0) * 0.008);
  }

  // -------------------------------------------------------------------------
  // FX

  private push(p: Omit<Particle, "t">): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ ...p, t: 0 });
  }

  floatText(x: number, y: number, text: string, color: string = C.cocoa, size = 20): void {
    // Identical notices (e.g. "Counter full!") never stack up.
    if (!text.startsWith("+") && this.particles.some((p) => p.kind === "text" && p.text === text && p.t < 0.8)) return;
    this.push({ kind: "text", x, y, x0: x, y0: y, x1: x, y1: y - 50, life: 1.1, text, color, size });
  }

  lemonArc(x0: number, y0: number, x1: number, y1: number, golden: boolean): void {
    this.push({ kind: "lemon", x: x0, y: y0, x0, y0, x1, y1, life: 0.55, text: "", color: golden ? C.gold : C.lemon, size: 9 });
  }

  sparkle(x: number, y: number, n = 6): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.push({ kind: "sparkle", x, y, x0: x, y0: y, x1: x + Math.cos(a) * 40, y1: y + Math.sin(a) * 40, life: 0.6, text: "", color: C.gold, size: 6 });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) p.t += dt;
    this.particles = this.particles.filter((p) => p.t < p.life);
  }

  // -------------------------------------------------------------------------
  // Frame

  private lastStats: StatBlock | null = null;

  render(g: GameState, s: SessionState, stats: StatBlock, x: ViewExtras, dt: number, realDt = dt): void {
    const ctx = this.ctx;
    const motion = !x.reducedMotion;
    const time = s.time;
    this.lastStats = stats;
    this.updateParticles(dt);
    this.updateCamera(realDt, x.reducedMotion);
    this.updateWheel(realDt);
    const camX = this.camX;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);

    const wx0 = -this.ox / this.scale - 2;
    const wx1 = (this.cssW - this.ox) / this.scale + 2;
    const wy0 = -this.oy / this.scale - 2;
    const wy1 = (this.cssH - this.oy) / this.scale + 2;
    const has = (r: RegionId) => g.regions.includes(r);
    const night = has("moonlit_market");

    // Sky
    const sky = ctx.createLinearGradient(0, wy0, 0, GROUND_Y);
    sky.addColorStop(0, night ? "#8FA3D9" : C.sky);
    sky.addColorStop(1, night ? "#F6D8C4" : C.cream);
    ctx.fillStyle = sky;
    ctx.fillRect(wx0, wy0, wx1 - wx0, GROUND_Y - wy0);

    // Sun (or moon)
    ctx.save();
    ctx.translate(1060, 95);
    if (motion) ctx.rotate(time * 0.08);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      rrPath(ctx, -4, -70, 8, 18, 4);
      ctx.fillStyle = "rgba(255,217,90,0.7)";
      ctx.fill();
    }
    ctx.restore();
    ellipse(ctx, 1060, 95, 44, 44);
    fillStroke(ctx, C.lemon, 3, C.lemonDeep);
    if (night) {
      ellipse(ctx, 930, 70, 24, 24);
      fillStroke(ctx, C.white, 2, "#B9C7F5");
      ellipse(ctx, 940, 64, 20, 20);
      ctx.fillStyle = "#A9B8E8";
      ctx.fill();
      ctx.fillStyle = C.white;
      for (let i = 0; i < 7; i++) {
        star(ctx, 640 + i * 70, 40 + ((i * 37) % 60), 4, 4, 0.4);
        ctx.fill();
      }
    }

    // Clouds
    for (let i = 0; i < 4; i++) {
      const span = WORLD_W + 400;
      const cx = (((i * 330 + (motion ? time * (8 + i * 3) : 0) - camX * 0.25) % span) + span) % span - 200;
      drawCloud(ctx, cx, 70 + (i % 2) * 60 + i * 8, 0.8 + (i % 3) * 0.25);
    }

    // Far hills (parallax, tiled)
    ctx.save();
    const px = camX * 0.5;
    ctx.translate(-px, 0);
    ctx.fillStyle = "#CDEBB5";
    for (let k = Math.floor((wx0 + px) / WORLD_W) - 1; k <= Math.ceil((wx1 + px) / WORLD_W); k++) {
      ellipse(ctx, 300 + k * WORLD_W, GROUND_Y - 20, 520, 170);
      ctx.fill();
      ellipse(ctx, 950 + k * WORLD_W, GROUND_Y - 10, 560, 150);
      ctx.fill();
    }
    ctx.restore();

    // Everything below scrolls with the camera.
    ctx.translate(-camX, 0);
    const vx0 = wx0 + camX;
    const vx1 = wx1 + camX;
    const visible = (lo: number, hi: number) => hi >= vx0 && lo <= vx1;
    // Orchard hill (left)
    ellipse(ctx, 440, GROUND_Y - 60, 200, 110);
    ctx.fillStyle = has("orchard_hill") ? "#B5E09A" : "#D7EEC6";
    ctx.fill();

    // Riverside
    if (has("riverside")) {
      ctx.fillStyle = C.skyDeep;
      rrPath(ctx, vx0, GROUND_Y - 118, vx1 - vx0, 26, 13);
      ctx.fill();
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const rx = ((i * 110 + (motion ? time * 20 : 0)) % (WORLD_W + 100)) - 50 + Math.floor(camX / WORLD_W) * WORLD_W;
        ctx.beginPath();
        ctx.moveTo(rx, GROUND_Y - 105);
        ctx.lineTo(rx + 24, GROUND_Y - 105);
        ctx.stroke();
      }
      const bx = (((motion ? time * 25 : 0) % (WORLD_W + 200)) - 100);
      drawBoat(ctx, bx, GROUND_Y - 112);
    }

    // Midground neighborhood
    if (has("market_row")) {
      drawStall(ctx, 900, GROUND_Y - 58, C.coral);
      drawStall(ctx, 1010, GROUND_Y - 62, C.leaf);
      drawStall(ctx, 1120, GROUND_Y - 58, C.sky);
    } else {
      drawHouse(ctx, 930, GROUND_Y - 60, 90, 70, C.cream, C.coral);
      drawHouse(ctx, 1110, GROUND_Y - 64, 80, 64, C.white, C.skyDeep);
    }
    drawHouse(ctx, 520, GROUND_Y - 70, 76, 60, C.white, C.leaf);
    if (has("sunny_lane")) drawFence(ctx, -30, 385, GROUND_Y - 38);

    // Sunset Plaza lanterns / Moonlit Market lanterns
    if (has("sunset_plaza") || night) {
      ctx.beginPath();
      ctx.moveTo(760, 175);
      ctx.quadraticCurveTo(980, 235, 1200, 175);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.cocoa;
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const lx = 790 + i * 58;
        const t = (lx - 760) / 440;
        const ly = 175 + 60 * 2 * t * (1 - t) + 6;
        const glow = motion ? 0.6 + 0.4 * Math.sin(time * 2 + i) : 1;
        drawLantern(ctx, lx, ly, night && i % 2 ? "#B9C7F5" : [C.coral, C.lemon, C.leaf][i % 3], glow);
      }
    }

    // Zone backdrops that stand behind the ground line
    if (visible(-WORLD_W, 0)) drawGroveBackdrop(ctx);

    // Ground
    ctx.fillStyle = "#9BD58A";
    ctx.fillRect(vx0, GROUND_Y - 40, vx1 - vx0, wy1 - (GROUND_Y - 40));
    ctx.fillStyle = C.leaf;
    ctx.fillRect(vx0, GROUND_Y - 40, vx1 - vx0, 6);
    ctx.fillStyle = C.sand;
    ctx.fillRect(vx0, GROUND_Y + 8, vx1 - vx0, 62);
    ctx.fillStyle = "rgba(167,116,79,0.18)";
    for (let px2 = Math.floor(vx0 / 60) * 60; px2 < vx1; px2 += 60) {
      rrPath(ctx, px2 + 8, GROUND_Y + 30, 26, 8, 4);
      ctx.fill();
    }
    if (visible(WORLD_W, 2 * WORLD_W)) drawMarketBackdrop(ctx, time, motion);
    if (visible(2 * WORLD_W, 3 * WORLD_W)) drawFairBackdrop(ctx, time, motion);

    if ((g.perks.evergreen_lane ?? 0) > 0) drawHedge(ctx, -20, 520, GROUND_Y - 20);

    // Picnic Corner
    if (has("picnic_corner")) {
      drawPicnicTable(ctx, 1000, GROUND_Y - 22);
      drawPicnicTable(ctx, 1140, GROUND_Y - 18);
    }

    // Next region preview (signposts that stand behind the lane)
    this.drawRegionSign(x, false);

    // Grove plots: planted trees, empty mounds, and the next plot's build sign (back row first)
    if (visible(-WORLD_W - 100, 100)) this.drawGrove(g, stats, x, time, motion);

    // Stand trees: extra trees first (farther back), main tree last
    const tScale = this.treeScale(g);
    for (let i = HOME_TREE_SLOTS - 1; i >= 0; i--) {
      if (!g.trees[i]?.length) continue;
      const tr = treeSpot(i);
      drawTree(ctx, tr.x, tr.y, tr.scale * tScale, g.trees[i], time, motion, x.treeShake[i] ?? 0);
    }

    // Helper bench
    const bench = g.upgrades.helper_bench ?? 0;
    if (bench > 0) drawBench(ctx, 360, GROUND_Y - 36, slotsOf(stats.helperSlots));

    // Basket and press
    const recipe = activeRecipe(g);
    drawBasket(ctx, LAYOUT.basket.x, LAYOUT.basket.y - 40, g.upgrades.basket ?? 0, g.lemons, slotsOf(stats.basketCap));
    const running = g.lemons >= recipe.lemons && g.drinks < slotsOf(stats.counterCap);
    drawPress(ctx, LAYOUT.press.x, LAYOUT.press.y, g.upgrades.juice_press ?? 0, g.pressProgress, running, time, recipe, x.pressSquash, g.lemons > 0, motion);
    if (running) drawSqueezeGauge(ctx, LAYOUT.press.x, GROUND_Y - 168, x.squeezeMeter, TUNING.perfectWindow);

    // Umbrella behind the queue
    const umb = g.upgrades.sun_umbrella ?? 0;
    if (umb > 0) drawUmbrella(ctx, 930, GROUND_Y + 8, umb);

    // Helpers behind the counter
    const helperT = (id: HelperId) => (x.helperWorking[id] ?? 0) > 0;
    for (const [id, spot] of Object.entries(HELPER_SPOTS) as [HelperId, (typeof HELPER_SPOTS)[HelperId]][]) {
      if (spot.behindCounter && (g.helpers[id] ?? 0) > 0) drawHelper(ctx, spot.x, spot.y, helperById.get(id)!, time, helperT(id), motion, 0.9);
    }

    // Stand
    const cos = COSMETICS.find((c) => c.id === g.cosmetic) ?? COSMETICS[0];
    const st = LAYOUT.stand;
    drawStand(ctx, st.x, st.y, st.w, {
      stripes: cos.stripes,
      signLevel: g.upgrades.signboard ?? 0,
      registerLevel: g.upgrades.cash_register ?? 0,
      bookLevel: g.upgrades.recipe_book ?? 0,
      time,
      motion,
    });
    // Drinks on the counter
    const cap = slotsOf(stats.counterCap);
    const shownSlots = Math.min(cap, 8);
    const left = st.x - st.w / 2 + ((g.upgrades.cash_register ?? 0) > 0 ? 62 : 22);
    const right = st.x + st.w / 2 - ((g.upgrades.recipe_book ?? 0) > 0 ? 58 : 22);
    const gap = shownSlots > 1 ? (right - left) / (shownSlots - 1) : 0;
    for (let i = 0; i < shownSlots; i++) {
      const dx = shownSlots > 1 ? left + gap * i : st.x;
      if (i < g.drinks) {
        drawDrink(ctx, dx, st.y - 108, recipe, 0.95);
        // Perfect drinks (served first) wear a gold star.
        if (i >= g.drinks - g.perfectDrinks) {
          star(ctx, dx + 9, st.y - 138, 6, 5, 0.45);
          fillStroke(ctx, C.gold, 1.5);
        }
      }
      else {
        ctx.fillStyle = "rgba(90,70,56,0.12)";
        ellipse(ctx, dx, st.y - 110, 8, 3);
        ctx.fill();
      }
    }
    if (g.drinks > shownSlots) label(ctx, `+${g.drinks - shownSlots}`, right + 4, st.y - 150, 14, C.cocoa, "center", C.white);
    // Counter status tag
    rrPath(ctx, st.x - 38, st.y + 6, 76, 20, 10);
    fillStroke(ctx, g.drinks >= cap ? C.coral : C.cream, 2);
    label(ctx, `${g.drinks}/${cap}`, st.x, st.y + 16.5, 13);

    // Ice box and flower pots
    const ice = g.upgrades.ice_box ?? 0;
    if (ice > 0) {
      ctx.save();
      ctx.translate(556, GROUND_Y + 62);
      ctx.scale(0.8, 0.8);
      drawIceBox(ctx, 0, 0, ice);
      ctx.restore();
    }
    const pots = Math.min(6, g.upgrades.flower_pots ?? 0);
    for (let i = 0; i < pots; i++) drawFlowerPot(ctx, 662 + i * 30, GROUND_Y + 78, i, time, motion);

    // Delivery cart
    const cartLv = g.upgrades.delivery_cart ?? 0;
    if (cartLv > 0 || stats.deliveryRate > 0) {
      const moving = x.cartTimer > 0;
      const offset = moving ? Math.sin((1 - x.cartTimer) * Math.PI) * 60 : 0;
      drawCart(ctx, 1110 + offset, GROUND_Y + 110, cartLv, time, moving, motion);
    }

    // Facilities in the other zones
    this.drawFacilities(g, stats, x, time, motion, visible);

    // Customers (back to front)
    const customers = [...s.customers].sort((a, b) => b.x - a.x);
    for (const c of customers) {
      const def = customerById.get(c.type)!;
      const walking = c.phase === "arriving" || c.phase === "leaving";
      drawCustomer(ctx, c.x, LAYOUT.customerY, def, c.mood, c.t + c.uid, walking, motion, CUSTOMER_SCALE, c.uid);
      const top = LAYOUT.customerY - CUSTOMER_TOP[c.type] * CUSTOMER_SCALE * 0.95;
      if (c.phase === "waiting") this.drawOrderBubble(c.x, top - 34, c.owed, c.patience / c.patienceMax, c.premium, recipe.id);
      if (c.phase === "served" || (c.phase === "leaving" && c.mood !== "sad" && c.t < 0.8)) {
        const rise = motion ? c.t * 20 : 0;
        if (c.mood === "delighted") this.heart(c.x, top - 14 - rise);
        else label(ctx, "♪", c.x + 16, top - 14 - rise, 20, C.cocoa);
      }
      if (c.mood === "sad" && c.phase === "leaving" && c.t < 1.5) {
        rrPath(ctx, c.x - 18, top - 26, 36, 20, 10);
        fillStroke(ctx, C.white, 2);
        label(ctx, "…", c.x, top - 18, 16);
      }
    }

    // Other helpers
    for (const [id, spot] of Object.entries(HELPER_SPOTS) as [HelperId, (typeof HELPER_SPOTS)[HelperId]][]) {
      if (!spot.behindCounter && (g.helpers[id] ?? 0) > 0) drawHelper(ctx, spot.x, spot.y, helperById.get(id)!, time, helperT(id), motion, 0.9);
    }

    // Next region preview (foreground signposts)
    this.drawRegionSign(x, true);

    // Combo
    if (s.combo >= 2) {
      const cx = LAYOUT.queueFrontX + 40;
      const pulse = motion ? 1 + 0.06 * Math.sin(time * 8) : 1;
      rrPath(ctx, cx - 50 * pulse, GROUND_Y - 262, 100 * pulse, 30, 15);
      fillStroke(ctx, C.lemon, 2.5);
      label(ctx, `Combo ×${s.combo}`, cx, GROUND_Y - 246, 17);
      const w = 84 * (s.comboTimer / stats.comboWindow);
      rrPath(ctx, cx - 42, GROUND_Y - 227, Math.max(2, w), 5, 2.5);
      ctx.fillStyle = C.coral;
      ctx.fill();
    }

    // Particles
    for (const p of this.particles) {
      const k = p.t / p.life;
      if (p.kind === "text") {
        const y = motion ? p.y0 + (p.y1 - p.y0) * k : p.y0;
        ctx.globalAlpha = 1 - Math.max(0, k - 0.5) * 2;
        label(ctx, p.text, p.x0, y, p.size, p.color, "center", C.white);
        ctx.globalAlpha = 1;
      } else if (p.kind === "lemon") {
        const e = motion ? k : 1;
        const lx = p.x0 + (p.x1 - p.x0) * e;
        const ly = p.y0 + (p.y1 - p.y0) * e - Math.sin(e * Math.PI) * 60;
        const squash = 1 + 0.25 * Math.sin(e * Math.PI);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.scale(squash, 1 / squash);
        drawLemon(ctx, 0, 0, p.size, p.color, e * 4);
        ctx.restore();
      } else {
        const px = p.x0 + (p.x1 - p.x0) * k;
        const py = p.y0 + (p.y1 - p.y0) * k;
        ctx.globalAlpha = 1 - k;
        star(ctx, px, py, p.size * (1 - k * 0.5), 4, 0.4);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private buildState(g: GameState, stats: StatBlock, id: UpgradeId): BuildState {
    if (upgradeLocked(g, id)) return "locked";
    return g.coins >= upgradeCost(g, id, stats) ? "affordable" : "saving";
  }

  private constructionFor(g: GameState, stats: StatBlock, id: UpgradeId, spot: FacilitySpot, time: number, motion: boolean): void {
    const state = this.buildState(g, stats, id);
    const { title, line2 } = constructionText(g, stats, id);
    const sign = constructionSignRect(spot, title, line2);
    drawConstruction(this.ctx, spot.x, spot.y, spot.w, spot.h, sign, title, line2, state, time, motion);
  }

  private drawGrove(g: GameState, stats: StatBlock, x: ViewExtras, time: number, motion: boolean): void {
    const ctx = this.ctx;
    const planted = slotsOf(stats.grovePlots);
    // Back row (odd slots) then front row (even slots)
    for (const row of [1, 0]) {
      for (let j = 0; j < GROVE_TREES.length; j++) {
        if (j % 2 !== row) continue;
        const spot = GROVE_TREES[j];
        const idx = HOME_TREE_SLOTS + j;
        if (j < planted && g.trees[idx]?.length) {
          drawTree(ctx, spot.x, spot.y, spot.scale, g.trees[idx], time, motion, x.treeShake[idx] ?? 0);
        } else {
          drawEmptyPlot(ctx, spot.x, spot.y, spot.scale, j === planted, time, motion);
        }
      }
    }
    const next = GROVE_TREES[planted];
    if (next && (g.upgrades.grove_plot ?? 0) < (upgradeById.get("grove_plot")?.maxLevel ?? 0)) {
      this.constructionFor(g, stats, "grove_plot", grovePlotSpot(planted), time, motion);
    }
  }

  private drawFacilities(g: GameState, stats: StatBlock, x: ViewExtras, time: number, motion: boolean, visible: (lo: number, hi: number) => boolean): void {
    const ctx = this.ctx;
    const recipe = activeRecipe(g);
    for (const id of FACILITY_IDS) {
      const f = FACILITY_SPOTS[id as FacilitySpotId];
      if (!f || !visible(f.x - f.w, f.x + f.w)) continue;
      const lv = g.upgrades[id] ?? 0;
      if (lv <= 0) {
        this.constructionFor(g, stats, id, f, time, motion);
        continue;
      }
      switch (id) {
        case "beehive":
          drawBeehive(ctx, f.x, f.y, lv, time, motion);
          break;
        case "sprinkler":
          drawSprinkler(ctx, f.x, f.y, lv, time, motion);
          break;
        case "sell_crate":
          drawSellCrate(ctx, f.x, f.y, lv, g.lemons, `+${formatNumber(rawLemonValue(g, stats, x.now))} each`, time, motion);
          break;
        case "lemon_chute":
          drawChute(ctx, f.x, f.y, time, motion);
          break;
        case "juice_factory":
          drawFactory(ctx, f.x, f.y, lv, g.lemons >= recipe.lemons, recipe, time, motion);
          break;
        case "fountain":
          drawFountain(ctx, f.x, f.y, lv, time, motion);
          break;
        case "lucky_wheel": {
          const left = spinCooldownLeft(g, stats, x.now);
          drawWheel(ctx, f.x, f.y, WHEEL, this.wheelAngle, left <= 0 && this.wheelT >= 1, time, motion);
          label(ctx, left <= 0 ? "SPIN!" : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`, f.x, f.y - 19, 17, C.cocoa);
          break;
        }
        case "order_board": {
          const c = g.contract;
          const now = x.now;
          const notes = c.active
            ? [{ recipe: recipeById.get(c.active.recipe)!, label: `${c.delivered}/${c.active.count}`, progress: c.delivered / c.active.count }]
            : c.offers.map((o) => ({ recipe: recipeById.get(o.recipe)!, label: `×${o.count}` }));
          drawOrderBoard(ctx, f.x, f.y, lv, notes, !!c.active, time, motion);
          if (c.active) {
            const left = Math.max(0, (c.expiresAt - now) / 1000);
            label(ctx, `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`, f.x, f.y - 20, 16, left < 30 ? C.coral : C.cocoa, "center", C.white);
          }
          break;
        }
        case "golden_statue":
          drawStatue(ctx, f.x, f.y, lv, time, motion);
          break;
      }
    }
  }

  private drawRegionSign(x: ViewExtras, foreground: boolean): void {
    if (!x.nextRegion || x.nextRegionCost === undefined) return;
    if (!foreground) return;
    const sp = REGION_SIGN;
    drawSignpost(this.ctx, sp.x, sp.y, nameOf("region", x.nextRegion), `${formatNumber(x.nextRegionCost)} coins`);
  }

  private heart(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.bezierCurveTo(x - 14, y - 4, x - 6, y - 14, x, y - 6);
    ctx.bezierCurveTo(x + 6, y - 14, x + 14, y - 4, x, y + 6);
    fillStroke(ctx, C.coral, 2);
  }

  private drawOrderBubble(x: number, y: number, owed: number, patience: number, premium: boolean, recipeId: GameState["activeRecipe"]): void {
    const ctx = this.ctx;
    const w = owed > 1 ? 64 : 46;
    rrPath(ctx, x - w / 2, y - 22, w, 44, 14);
    fillStroke(ctx, premium ? "#FFF1B8" : C.white, 2.5);
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 21);
    ctx.lineTo(x, y + 30);
    ctx.lineTo(x + 6, y + 21);
    ctx.fillStyle = premium ? "#FFF1B8" : C.white;
    ctx.fill();
    const r = recipeById.get(recipeId)!;
    drawDrink(ctx, owed > 1 ? x - 10 : x, y + 14, r, 0.75);
    if (owed > 1) label(ctx, `×${owed}`, x + 16, y, 13);
    // Patience ring: arc length shows remaining patience; color shifts too.
    ctx.beginPath();
    ctx.arc(x + w / 2 - 2, y - 20, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, patience));
    ctx.lineWidth = 4;
    ctx.strokeStyle = patience > 0.35 ? C.leaf : C.coral;
    ctx.stroke();
    if (premium) {
      star(ctx, x - w / 2 + 2, y - 20, 9);
      fillStroke(ctx, C.gold, 2);
    }
  }
}
