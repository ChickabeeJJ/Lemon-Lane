// ProductionService + CustomerService + AutomationService as one deterministic step function.
// The simulation never touches rendering; it emits SimEvents that presentation layers consume.
import { CUSTOMERS, TUNING } from "../content/content";
import type { CustomerId } from "../content/types";
import {
  activeRecipe,
  baseDrinkValue,
  helperInterval,
  fountainPerSec,
  maxCombo,
  rawLemonValue,
  slotsOf,
  type StatBlock,
} from "./economy";
import { LAYOUT, queueSlotX } from "./layout";
import { pickWeighted, type Rng } from "./rng";
import { GROVE_TREE_SLOTS, HOME_TREE_SLOTS, type Customer, type Fruit, type GameState, type SessionState } from "./state";

export type Actor = "player" | "helper";

export type SimEvent =
  | { type: "harvest"; tree: number; fruit: number; golden: boolean; diamond: boolean; bonus: number; by: Actor; sold: boolean }
  | { type: "sell"; count: number; amount: number; by: Actor }
  | { type: "fountain"; amount: number }
  | { type: "basketFull" }
  | { type: "drink" }
  | { type: "squeeze" }
  | { type: "arrive"; uid: number }
  | { type: "sale"; uid: number; amount: number; tip: number; premium: boolean; delighted: boolean; combo: number; done: boolean; by: Actor }
  | { type: "leave"; uid: number }
  | { type: "delivery"; amount: number }
  | { type: "sticker"; customer: CustomerId }
  | { type: "noDrinks" };

export interface SimContext {
  stats: StatBlock;
  rng: Rng;
  /** Wall-clock ms, used only for timed boosts. */
  now: number;
  emit: (e: SimEvent) => void;
}

const MAX_STEP = 0.25;

export function addCoins(g: GameState, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const a = Math.floor(amount * 100) / 100;
  g.coins += a;
  g.runCoins += a;
  g.run.coinsEarned += a;
  g.lifetime.coinsEarned += a;
  return a;
}

function newFruit(ctx: SimContext): Fruit {
  const r = ctx.rng();
  const diamond = r < ctx.stats.diamondChance;
  return { g: 0, golden: !diamond && r < ctx.stats.diamondChance + ctx.stats.goldenChance, diamond };
}

/** Is tree slot `i` planted? Slots 0–4 stand by the stand, 5–10 are grove plots. */
export function treeSlotActive(i: number, stats: StatBlock): boolean {
  return i < HOME_TREE_SLOTS ? i < slotsOf(stats.treeCount) : i - HOME_TREE_SLOTS < slotsOf(stats.grovePlots);
}

/** Keep tree/fruit arrays in sync with planted slots and fruit slots. */
export function syncTrees(g: GameState, ctx: SimContext): void {
  const total = HOME_TREE_SLOTS + GROVE_TREE_SLOTS;
  const slots = slotsOf(ctx.stats.fruitSlots);
  while (g.trees.length < total) g.trees.push([]);
  if (g.trees.length > total) g.trees.length = total;
  g.trees.forEach((tree, i) => {
    const want = treeSlotActive(i, ctx.stats) ? slots : 0;
    while (tree.length < want) {
      const f = newFruit(ctx);
      f.g = ctx.rng() * 0.5;
      tree.push(f);
    }
    if (tree.length > want) tree.length = want;
  });
}

function lemonBonus(g: GameState, ctx: SimContext, f: Fruit): number {
  const drink = baseDrinkValue(g, ctx.stats, ctx.now);
  if (f.diamond) return drink * TUNING.diamondValueDrinks;
  if (f.golden) return drink * TUNING.goldenValueDrinks;
  return 0;
}

/** Sell every lemon in the basket at the Sell Crate. Returns coins earned. */
export function sellLemons(g: GameState, ctx: SimContext, by: Actor): number {
  if ((g.upgrades.sell_crate ?? 0) <= 0 || g.lemons <= 0) return 0;
  const count = g.lemons;
  const amount = addCoins(g, count * rawLemonValue(g, ctx.stats, ctx.now));
  g.lemons = 0;
  g.run.lemonsSold += count;
  g.lifetime.lemonsSold += count;
  ctx.emit({ type: "sell", count, amount, by });
  return amount;
}

export function waitingCustomers(s: SessionState): Customer[] {
  return s.customers.filter((c) => c.phase === "waiting" || c.phase === "arriving");
}

function frontCustomer(s: SessionState): Customer | undefined {
  // Only a customer who has reached the counter can be served.
  const q = waitingCustomers(s);
  return q.length && q[0].phase === "waiting" ? q[0] : undefined;
}

// ---------------------------------------------------------------------------
// Player / helper actions that happen inside the simulation

export function harvestFruit(g: GameState, ctx: SimContext, tree: number, fruit: number, by: Actor): boolean {
  const f = g.trees[tree]?.[fruit];
  if (!f || f.g < 1) return false;
  const full = g.lemons >= slotsOf(ctx.stats.basketCap);
  // With the Lemon Chute, a full basket no longer stops picking: the extra lemon sells itself.
  const chute = full && ctx.stats.autoSell >= 1 && (g.upgrades.sell_crate ?? 0) > 0;
  if (full && !chute) {
    ctx.emit({ type: "basketFull" });
    return false;
  }
  let bonus = 0;
  if (f.golden || f.diamond) {
    bonus = addCoins(g, lemonBonus(g, ctx, f));
    if (f.diamond) {
      g.run.diamondHarvested++;
      g.lifetime.diamondHarvested++;
    } else {
      g.run.goldenHarvested++;
      g.lifetime.goldenHarvested++;
    }
  }
  if (chute) {
    bonus += addCoins(g, rawLemonValue(g, ctx.stats, ctx.now));
    g.run.lemonsSold++;
    g.lifetime.lemonsSold++;
  } else {
    g.lemons++;
  }
  g.run.lemonsHarvested++;
  g.lifetime.lemonsHarvested++;
  ctx.emit({ type: "harvest", tree, fruit, golden: f.golden, diamond: !!f.diamond, bonus, by, sold: chute });
  g.trees[tree][fruit] = newFruit(ctx);
  return true;
}

/** Harvest every ripe lemon on one tree (as space allows). Returns lemons picked. */
export function harvestTree(g: GameState, ctx: SimContext, tree: number): number {
  let n = 0;
  const fruits = g.trees[tree] ?? [];
  for (let i = 0; i < fruits.length; i++) {
    if (fruits[i].g >= 1) {
      if (!harvestFruit(g, ctx, tree, i, "player")) break;
      n++;
    }
  }
  return n;
}

export function harvestAny(g: GameState, ctx: SimContext, by: Actor): boolean {
  for (let t = 0; t < g.trees.length; t++) {
    const fruits = g.trees[t];
    // Prefer diamond and golden lemons, then any ripe one.
    let idx = fruits.findIndex((f) => f.g >= 1 && (f.golden || f.diamond));
    if (idx < 0) idx = fruits.findIndex((f) => f.g >= 1);
    if (idx >= 0) return harvestFruit(g, ctx, t, idx, by);
  }
  return false;
}

export function pressCanRun(g: GameState, ctx: SimContext): boolean {
  return g.lemons >= activeRecipe(g).lemons && g.drinks < slotsOf(ctx.stats.counterCap);
}

export function squeeze(g: GameState, ctx: SimContext): boolean {
  if (!pressCanRun(g, ctx)) return false;
  g.pressProgress = Math.min(1, g.pressProgress + TUNING.squeezeBoost);
  ctx.emit({ type: "squeeze" });
  finishPress(g, ctx);
  return true;
}

function finishPress(g: GameState, ctx: SimContext): void {
  const recipe = activeRecipe(g);
  if (g.pressProgress >= 1 && g.lemons >= recipe.lemons && g.drinks < slotsOf(ctx.stats.counterCap)) {
    g.lemons -= recipe.lemons;
    g.drinks++;
    g.pressProgress = 0;
    g.run.drinksMade++;
    g.lifetime.drinksMade++;
    ctx.emit({ type: "drink" });
  }
}

export function serveFront(g: GameState, s: SessionState, ctx: SimContext, by: Actor): boolean {
  const c = frontCustomer(s);
  if (!c) return false;
  if (g.drinks < 1) {
    if (by === "player") ctx.emit({ type: "noDrinks" });
    return false;
  }
  return serveCustomer(g, s, ctx, c, by);
}

export function serveCustomerByUid(g: GameState, s: SessionState, ctx: SimContext, uid: number): boolean {
  // Tapping any waiting customer serves the queue front: the queue stays fair and orderly.
  const c = s.customers.find((x) => x.uid === uid);
  if (!c || c.phase !== "waiting") return false;
  return serveFront(g, s, ctx, "player");
}

function serveCustomer(g: GameState, s: SessionState, ctx: SimContext, c: Customer, by: Actor): boolean {
  const def = CUSTOMERS.find((d) => d.id === c.type)!;
  const st = ctx.stats;
  g.drinks--;
  c.owed--;
  const done = c.owed <= 0;
  const favorite = def.favorite === g.activeRecipe;
  let amount = baseDrinkValue(g, st, ctx.now) * def.valueMult * (favorite ? 1 + st.favoriteBonus : 1);
  if (c.premium) amount *= 1 + st.premiumBonus;
  let tip = 0;
  let combo = s.combo;
  if (done) {
    combo = s.comboTimer > 0 ? Math.min(maxCombo(g), s.combo + 1) : 1;
    s.combo = combo;
    s.comboTimer = st.comboWindow;
    if (combo > g.run.bestCombo) g.run.bestCombo = combo;
    if (combo > g.lifetime.bestCombo) g.lifetime.bestCombo = combo;
  }
  amount *= 1 + TUNING.comboStep * Math.max(0, combo - 1);
  if (done && ctx.rng() < Math.min(1, st.tipChance + def.tipBonus)) tip = amount * TUNING.tipSize;
  const paid = addCoins(g, amount + tip);
  const delighted = favorite || tip > 0 || c.premium;
  if (done) {
    c.phase = "served";
    c.t = 0;
    c.mood = delighted ? "delighted" : "happy";
    g.run.customersServed++;
    g.lifetime.customersServed++;
    g.tutorialDone = true;
    if (!g.stickers.includes(c.type)) {
      g.stickers.push(c.type);
      ctx.emit({ type: "sticker", customer: c.type });
    }
  }
  ctx.emit({ type: "sale", uid: c.uid, amount: paid, tip, premium: c.premium, delighted, combo, done, by });
  return true;
}

function spawnCustomer(g: GameState, s: SessionState, ctx: SimContext): void {
  const pool = CUSTOMERS.filter((c) => g.regions.includes(c.region) && g.sunrises >= c.sunrises);
  const def = pickWeighted(pool, ctx.rng);
  if (!def) return;
  const patience = def.patience * ctx.stats.patience;
  const c: Customer = {
    uid: s.nextUid++,
    type: def.id,
    owed: def.order,
    patience,
    patienceMax: patience,
    premium: ctx.rng() < ctx.stats.premiumChance,
    phase: "arriving",
    x: LAYOUT.spawnX,
    t: 0,
    mood: "neutral",
  };
  s.customers.push(c);
  ctx.emit({ type: "arrive", uid: c.uid });
}

// ---------------------------------------------------------------------------
// The step

export function step(g: GameState, s: SessionState, dtIn: number, ctx: SimContext): void {
  // Clamp unreasonable deltas; long gaps are handled as offline progress instead.
  let remaining = Number.isFinite(dtIn) ? Math.max(0, Math.min(dtIn, 10)) : 0;
  while (remaining > 0) {
    const dt = Math.min(MAX_STEP, remaining);
    remaining -= dt;
    stepOnce(g, s, dt, ctx);
  }
}

function stepOnce(g: GameState, s: SessionState, dt: number, ctx: SimContext): void {
  const st = ctx.stats;
  s.time += dt;
  syncTrees(g, ctx);

  // Grow
  const growth = (dt * st.growthSpeed) / TUNING.fruitGrowTime;
  for (const tree of g.trees) for (const f of tree) if (f.g < 1) f.g = Math.min(1, f.g + growth);

  // Press
  if (pressCanRun(g, ctx)) {
    g.pressProgress = Math.min(1, g.pressProgress + (dt * st.pressSpeed) / activeRecipe(g).pressTime);
    finishPress(g, ctx);
  }

  // Helpers
  for (const id of ["pip", "roo"] as const) {
    const interval = helperInterval(g, id, st);
    if (!Number.isFinite(interval)) continue;
    const timer = Math.min(interval, (s.helperTimers[id] ?? 0) + dt);
    s.helperTimers[id] = timer;
    if (timer >= interval) {
      const acted = id === "pip" ? harvestAny(g, ctx, "helper") : serveFront(g, s, ctx, "helper");
      if (acted) s.helperTimers[id] = 0;
    }
  }

  // Combo decay
  if (s.comboTimer > 0) {
    s.comboTimer = Math.max(0, s.comboTimer - dt);
    if (s.comboTimer === 0) s.combo = 0;
  }

  // Arrivals
  s.arrivalTimer -= dt;
  if (s.arrivalTimer <= 0) {
    if (waitingCustomers(s).length < slotsOf(st.queueSize)) {
      spawnCustomer(g, s, ctx);
      s.arrivalTimer = (TUNING.arrivalInterval / st.arrivalRate) * (0.7 + 0.6 * ctx.rng());
    } else {
      s.arrivalTimer = 0.5;
    }
  }

  // Customer movement and patience
  const queue = waitingCustomers(s);
  for (const c of s.customers) {
    c.t += dt;
    if (c.phase === "arriving" || c.phase === "waiting") {
      const target = queueSlotX(queue.indexOf(c));
      c.x = Math.max(target, c.x - LAYOUT.walkSpeed * dt);
      if (c.phase === "arriving" && c.x <= target + 0.5) {
        c.phase = "waiting";
        c.t = 0;
      }
      if (c.phase === "waiting") {
        c.patience -= dt;
        if (c.patience <= 0) {
          c.phase = "leaving";
          c.mood = "sad";
          c.t = 0;
          s.combo = 0;
          s.comboTimer = 0;
          ctx.emit({ type: "leave", uid: c.uid });
        }
      }
    } else if (c.phase === "served") {
      if (c.t > 0.7) {
        c.phase = "leaving";
        c.t = 0;
      }
    } else if (c.phase === "leaving") {
      c.x += LAYOUT.walkSpeed * 1.2 * dt;
    }
  }
  s.customers = s.customers.filter((c) => !(c.phase === "leaving" && c.x > LAYOUT.exitX));

  // Lemonade Fountain: passive coins, paid out in small lumps.
  if (st.passiveIncome > 0) {
    s.fountainBank += fountainPerSec(g, st, ctx.now) * dt;
    s.fountainTimer += dt;
    if (s.fountainTimer >= TUNING.fountainInterval) {
      s.fountainTimer = 0;
      const amount = addCoins(g, s.fountainBank);
      s.fountainBank = 0;
      if (amount > 0) ctx.emit({ type: "fountain", amount });
    }
  }

  // Delivery cart sells spare drinks when nobody is waiting at the counter.
  if (st.deliveryRate > 0 && g.drinks > 0 && !frontCustomer(s)) {
    s.deliveryTimer += dt;
    const interval = 60 / st.deliveryRate;
    if (s.deliveryTimer >= interval) {
      s.deliveryTimer = 0;
      g.drinks--;
      const amount = addCoins(g, baseDrinkValue(g, st, ctx.now) * TUNING.deliveryValue);
      ctx.emit({ type: "delivery", amount });
    }
  } else {
    s.deliveryTimer = Math.max(0, s.deliveryTimer - dt);
  }
}
