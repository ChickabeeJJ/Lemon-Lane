// UI icons are drawn with the same procedural art functions as the world,
// so menus and the lane share one visual language.
import { WHEEL, customerById, helperById, recipeById } from "../content/content";
import { drawOrderBoard, drawBeehive, drawChute, drawEmptyPlot, drawFactory, drawFountain, drawSellCrate, drawSprinkler, drawStatue, drawWheel } from "./drawWorld";
import type { CustomerId, HelperId, RecipeId, UpgradeId, PerkId, RegionId } from "../content/types";
import {
  drawBasket,
  drawBench,
  drawCart,
  drawCustomer,
  drawDrink,
  drawFlowerPot,
  drawHelper,
  drawIceBox,
  drawLemon,
  drawPress,
  drawTree,
  drawUmbrella,
  ellipse,
  fillStroke,
  label,
  rrPath,
  star,
  drawHouse,
  drawStall,
  drawPicnicTable,
  drawBoat,
  drawLantern,
  drawFence,
  drawHedge,
} from "./draw";
import { C } from "./palette";

const cache = new Map<string, string>();
const SIZE = 96;

function make(key: string, paint: (ctx: CanvasRenderingContext2D) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  try {
    paint(ctx);
  } catch (e) {
    console.warn("[icons] failed", key, e);
  }
  const url = canvas.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

function fit(ctx: CanvasRenderingContext2D, s: number, cx = SIZE / 2, by = SIZE - 8): void {
  ctx.translate(cx, by);
  ctx.scale(s, s);
}

const ripe = (n: number) => Array.from({ length: n }, () => ({ g: 1, golden: false }));

export function upgradeIcon(id: UpgradeId): string {
  return make(`u:${id}`, (ctx) => {
    switch (id) {
      case "lemon_tree":
        fit(ctx, 0.34);
        drawTree(ctx, 0, 0, 1, ripe(5), 0, false);
        break;
      case "basket":
        fit(ctx, 0.85, SIZE / 2, SIZE - 22);
        drawBasket(ctx, 0, 0, 0, 7, 99);
        break;
      case "stand_counter":
        fit(ctx, 1);
        rrPath(ctx, -38, -44, 76, 44, 8);
        fillStroke(ctx, C.cream);
        rrPath(ctx, -44, -52, 88, 12, 6);
        fillStroke(ctx, C.wood);
        drawDrink(ctx, -20, -52, recipeById.get("classic")!, 0.9);
        drawDrink(ctx, 4, -52, recipeById.get("classic")!, 0.9);
        drawDrink(ctx, 26, -52, recipeById.get("classic")!, 0.9);
        break;
      case "juice_press":
        fit(ctx, 0.52, SIZE / 2 - 6);
        drawPress(ctx, 0, 0, 0, 0.6, false, 0, recipeById.get("classic")!, 0, true, false);
        break;
      case "ice_box":
        fit(ctx, 1);
        drawIceBox(ctx, 0, 0, 0);
        break;
      case "signboard":
        fit(ctx, 1, SIZE / 2, SIZE / 2 + 10);
        rrPath(ctx, -4, 0, 8, 30, 3);
        fillStroke(ctx, C.woodDark);
        rrPath(ctx, -42, -30, 84, 36, 10);
        fillStroke(ctx, C.lemon);
        drawLemon(ctx, 0, -12, 11, C.white, -0.3);
        break;
      case "cash_register":
        fit(ctx, 1.2, SIZE / 2, SIZE - 14);
        rrPath(ctx, -26, -34, 52, 34, 6);
        fillStroke(ctx, C.coral);
        rrPath(ctx, -18, -48, 36, 14, 4);
        fillStroke(ctx, C.white, 2);
        label(ctx, "$", 0, -17, 16, C.white);
        break;
      case "delivery_cart":
        fit(ctx, 0.78, SIZE / 2 - 6);
        drawCart(ctx, 0, 0, 0, 0, false, false);
        break;
      case "helper_bench":
        fit(ctx, 0.9);
        drawBench(ctx, 0, 0, 2);
        break;
      case "sun_umbrella":
        fit(ctx, 0.42);
        drawUmbrella(ctx, 0, 0, 0);
        break;
      case "flower_pots":
        fit(ctx, 1.1);
        drawFlowerPot(ctx, -18, 0, 0, 0, false);
        drawFlowerPot(ctx, 18, 0, 2, 0, false);
        break;
      case "grove_plot":
        fit(ctx, 0.26, SIZE / 2, SIZE - 12);
        drawEmptyPlot(ctx, 0, 30, 1.6, false, 0, false);
        drawTree(ctx, 0, 10, 0.95, ripe(4), 0, false);
        break;
      case "sprinkler":
        fit(ctx, 0.42, SIZE / 2, SIZE - 12);
        drawSprinkler(ctx, 0, 0, 0, 0.4, false);
        break;
      case "beehive":
        fit(ctx, 0.46, SIZE / 2, SIZE - 6);
        drawBeehive(ctx, 0, 0, 3, 0, false);
        break;
      case "sell_crate":
        fit(ctx, 0.36, SIZE / 2 - 8, SIZE - 8);
        drawSellCrate(ctx, 0, 0, 1, 5, "", 0, false);
        break;
      case "lemon_chute":
        fit(ctx, 0.34, SIZE / 2 + 6, SIZE - 8);
        drawChute(ctx, 0, 0, 0, false);
        break;
      case "juice_factory":
        fit(ctx, 0.26, SIZE / 2, SIZE - 8);
        drawFactory(ctx, 0, 0, 1, false, recipeById.get("classic")!, 0, false);
        break;
      case "lucky_wheel":
        fit(ctx, 0.3, SIZE / 2, SIZE - 6);
        drawWheel(ctx, 0, 0, WHEEL, 0, false, 0, false);
        break;
      case "fountain":
        fit(ctx, 0.34, SIZE / 2, SIZE - 14);
        drawFountain(ctx, 0, 0, 3, 0.3, false);
        break;
      case "order_board":
        fit(ctx, 0.36, SIZE / 2, SIZE - 6);
        drawOrderBoard(ctx, 0, 0, 1, [{ recipe: recipeById.get("classic")!, label: "×8" }, { recipe: recipeById.get("honey_lemon")!, label: "×15" }], false, 0, false);
        break;
      case "golden_statue":
        fit(ctx, 0.3, SIZE / 2, SIZE - 6);
        drawStatue(ctx, 0, 0, 1, 0, false);
        break;
      case "recipe_book":
        fit(ctx, 1, SIZE / 2, SIZE / 2 + 20);
        rrPath(ctx, -34, -40, 68, 50, 6);
        fillStroke(ctx, C.leaf);
        rrPath(ctx, -26, -32, 52, 34, 3);
        fillStroke(ctx, C.cream, 2);
        drawLemon(ctx, 0, -15, 10, C.lemon, -0.3);
        break;
    }
  });
}

export function recipeIcon(id: RecipeId): string {
  return make(`r:${id}`, (ctx) => {
    fit(ctx, 1.9, SIZE / 2, SIZE - 8);
    drawDrink(ctx, 0, 0, recipeById.get(id)!);
  });
}

export function customerIcon(id: CustomerId): string {
  return make(`c:${id}`, (ctx) => {
    fit(ctx, 1.05, SIZE / 2 - (id === "squirrel" || id === "fox" ? 8 : 0), SIZE - 6);
    drawCustomer(ctx, 0, 0, customerById.get(id)!, "happy", 0, false, false);
  });
}

export function helperIcon(id: HelperId): string {
  return make(`h:${id}`, (ctx) => {
    fit(ctx, 1.25);
    drawHelper(ctx, 0, 0, helperById.get(id)!, 0, false, false);
  });
}

export function regionIcon(id: RegionId): string {
  return make(`g:${id}`, (ctx) => {
    ctx.fillStyle = C.sky;
    rrPath(ctx, 4, 4, SIZE - 8, SIZE - 8, 16);
    ctx.fill();
    ctx.fillStyle = "#9BD58A";
    ctx.fillRect(4, SIZE - 30, SIZE - 8, 26);
    ctx.save();
    switch (id) {
      case "tiny_yard":
        fit(ctx, 0.28, SIZE / 2, SIZE - 14);
        drawTree(ctx, 0, 0, 1, ripe(3), 0, false);
        break;
      case "sunny_lane":
        fit(ctx, 0.7, SIZE / 2, SIZE - 14);
        drawFence(ctx, -60, 60, 0);
        drawHouse(ctx, 0, -8, 50, 40, C.cream, C.coral);
        break;
      case "picnic_corner":
        fit(ctx, 0.7, SIZE / 2, SIZE - 14);
        drawPicnicTable(ctx, 0, 0);
        break;
      case "market_row":
        fit(ctx, 0.75, SIZE / 2, SIZE - 14);
        drawStall(ctx, 0, 0, C.coral);
        break;
      case "orchard_hill":
        fit(ctx, 0.2, SIZE / 2, SIZE - 14);
        drawTree(ctx, -90, 0, 1, ripe(4), 0, false);
        drawTree(ctx, 90, -20, 1, ripe(4), 0, false);
        break;
      case "riverside":
        ctx.fillStyle = C.skyDeep;
        ctx.fillRect(4, SIZE - 40, SIZE - 8, 16);
        fit(ctx, 0.8, SIZE / 2, SIZE - 30);
        drawBoat(ctx, 0, 0);
        break;
      case "sunset_plaza":
        fit(ctx, 1, SIZE / 2, SIZE / 2);
        drawLantern(ctx, -24, 0, C.coral, 1);
        drawLantern(ctx, 0, 8, C.lemon, 1);
        drawLantern(ctx, 24, 0, C.leaf, 1);
        break;
      case "moonlit_market":
        ctx.fillStyle = "#8FA3D9";
        rrPath(ctx, 4, 4, SIZE - 8, SIZE - 36, 16);
        ctx.fill();
        ellipse(ctx, SIZE / 2, 36, 18, 18);
        fillStroke(ctx, C.white, 2, "#B9C7F5");
        ctx.fillStyle = C.white;
        star(ctx, 22, 22, 4, 4, 0.4);
        ctx.fill();
        star(ctx, 74, 30, 4, 4, 0.4);
        ctx.fill();
        break;
    }
    ctx.restore();
    rrPath(ctx, 4, 4, SIZE - 8, SIZE - 8, 16);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.cocoa;
    ctx.stroke();
  });
}

export function perkIcon(id: PerkId): string {
  return make(`p:${id}`, (ctx) => {
    ellipse(ctx, SIZE / 2, SIZE / 2, 38, 38);
    fillStroke(ctx, C.lemon, 3);
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    switch (id) {
      case "warm_soil":
        ctx.translate(0, 26);
        ctx.scale(0.2, 0.2);
        drawTree(ctx, 0, 0, 1, ripe(4), 0, false);
        break;
      case "sunny_smiles":
        ctx.scale(0.8, 0.8);
        drawCustomer(ctx, 0, 34, customerById.get("mochi_cat")!, "delighted", 0, false, false);
        break;
      case "bright_ideas":
        ellipse(ctx, 0, -6, 16, 16);
        fillStroke(ctx, C.white, 3);
        rrPath(ctx, -8, 8, 16, 12, 3);
        fillStroke(ctx, C.sky, 3);
        break;
      case "golden_hour":
        drawLemon(ctx, 0, 0, 18, C.gold, -0.3);
        break;
      case "open_windows":
        rrPath(ctx, -20, -20, 40, 40, 4);
        fillStroke(ctx, C.sky, 3);
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, 20);
        ctx.moveTo(-20, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
        break;
      case "kind_neighbors":
        ctx.scale(0.8, 0.8);
        drawHelper(ctx, 0, 30, helperById.get("roo")!, 0, false, false);
        break;
      case "fresh_sign":
        star(ctx, 0, 0, 22);
        fillStroke(ctx, C.gold, 3);
        break;
      case "longer_days":
        ellipse(ctx, 0, 0, 20, 20);
        fillStroke(ctx, C.white, 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -13);
        ctx.moveTo(0, 0);
        ctx.lineTo(9, 5);
        ctx.stroke();
        break;
      case "festival_spirit":
        drawLantern(ctx, -12, 0, C.coral, 1);
        drawLantern(ctx, 12, 4, C.leaf, 1);
        break;
      case "evergreen_lane":
        ctx.scale(0.8, 0.8);
        drawHedge(ctx, -30, 40, 20);
        break;
    }
    ctx.restore();
  });
}

export function coinIcon(): string {
  return make("coin", (ctx) => {
    ellipse(ctx, SIZE / 2, SIZE / 2, 36, 36);
    fillStroke(ctx, C.gold, 5, C.cocoa);
    ellipse(ctx, SIZE / 2, SIZE / 2, 24, 24);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.lemonDeep;
    ctx.stroke();
    drawLemon(ctx, SIZE / 2, SIZE / 2, 11, C.lemon, -0.3);
  });
}

export function lemonIcon(): string {
  return make("lemon", (ctx) => drawLemon(ctx, SIZE / 2, SIZE / 2, 30, C.lemon, -0.3));
}

export function tokenIcon(): string {
  return make("token", (ctx) => {
    ctx.fillStyle = C.lemon;
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.rotate((i / 12) * Math.PI * 2);
      rrPath(ctx, -4, -44, 8, 14, 4);
      fillStroke(ctx, C.lemon, 2.5);
      ctx.restore();
    }
    ellipse(ctx, SIZE / 2, SIZE / 2, 28, 28);
    fillStroke(ctx, C.gold, 4);
  });
}

export function starIcon(): string {
  return make("star", (ctx) => {
    star(ctx, SIZE / 2, SIZE / 2 + 3, 40);
    fillStroke(ctx, C.gold, 4);
  });
}

export function drinkIconFor(id: RecipeId): string {
  return recipeIcon(id);
}
