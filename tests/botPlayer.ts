// Headless player bots used by balance tests. They drive the real simulation and actions.
import { HELPERS, RECIPES, UPGRADES } from "../src/content/content";
import {
  buyHelper,
  buyUpgrade,
  discoverRecipe,
  helperLocked,
  nextRegion,
  performSunrise,
  recipeLocked,
  unlockRegion,
  upgradeLocked,
} from "../src/core/actions";
import { automatedRates, computeStats, helperCost, helpersHired, recipeCost, regionCost, slotsOf, sunriseTokens, upgradeCost } from "../src/core/economy";
import { claimQuest, evaluateQuest, noteCombo, startQuest } from "../src/core/quests";
import { createRng } from "../src/core/rng";
import { harvestAny, sellLemons, serveFront, squeeze, step, type SimContext } from "../src/core/sim";
import { createFreshState, createSession, type GameState, type SessionState } from "../src/core/state";

export type Profile = "active" | "casual" | "automation";

export interface BotLog {
  firstUpgradeAt?: number;
  pipAt?: number;
  sunnyLaneAt?: number;
  rooAt?: number;
  picnicAt?: number;
  marketAt?: number;
  orchardAt?: number;
  sunriseReadyAt?: number;
  coinsAt: Record<number, number>;
}

export function runBot(profile: Profile, minutes: number, seed = 1, start?: GameState): { g: GameState; s: SessionState; log: BotLog } {
  const g = start ?? createFreshState(0);
  const s = createSession();
  const rng = createRng(seed);
  startQuest(g, 0);
  const log: BotLog = { coinsAt: {} };
  const ctx = (): SimContext => ({
    stats: computeStats(g),
    rng,
    now: 0,
    emit: (e) => {
      if (e.type === "sale" && e.done) noteCombo(g, e.combo);
    },
  });
  const DT = 0.25;
  const steps = Math.round((minutes * 60) / DT);
  // Casual players act roughly every 3 seconds; active players every second.
  const actEvery = profile === "active" ? 4 : 12;
  let earnedPerSec = 0;
  let lastEarned = 0;
  for (let i = 0; i < steps; i++) {
    const tSec = i * DT;
    step(g, s, DT, ctx());
    const auto = (g.helpers.pip ?? 0) > 0 && (g.helpers.roo ?? 0) > 0;
    const tapping = profile === "active" || profile === "casual" || !auto;
    if (i % actEvery === 0 && tapping) {
      const c = ctx();
      for (let k = 0; k < 4 && harvestAny(g, c, "player"); k++);
      squeeze(g, c);
      serveFront(g, s, c, "player");
      // Sell when the basket is full (players do this at the Sell Crate).
      if (g.lemons >= slotsOf(c.stats.basketCap)) sellLemons(g, c, "player");
    }
    if (i % 4 === 0) shop(g, tSec, log, earnedPerSec);
    if (i % 40 === 0) {
      earnedPerSec = (g.lifetime.coinsEarned - lastEarned) / 10;
      lastEarned = g.lifetime.coinsEarned;
    }
    if (i % Math.round(60 / DT) === 0) log.coinsAt[Math.round(tSec / 60)] = g.coins;
    if (!log.sunriseReadyAt && sunriseTokens(g, computeStats(g)) > 0) log.sunriseReadyAt = tSec;
  }
  return { g, s, log };
}

function shop(g: GameState, t: number, log: BotLog, measured: number): void {
  const st = computeStats(g);
  const income = Math.max(measured, automatedRates(g, st, 0).coinsPerSec);
  if (evaluateQuest(g).done) claimQuest(g, st, income);

  // Priorities: next region when affordable, missing core helpers, best recipe, then cheapest upgrade.
  const nr = nextRegion(g);
  if (nr && g.coins >= regionCost(nr)) {
    if (unlockRegion(g, nr).ok) {
      const key = ({ sunny_lane: "sunnyLaneAt", picnic_corner: "picnicAt", market_row: "marketAt", orchard_hill: "orchardAt" } as const)[nr as "sunny_lane"];
      if (key && log[key] === undefined) log[key] = t;
      return;
    }
  }
  for (const h of HELPERS) {
    if ((g.helpers[h.id] ?? 0) === 0 && !helperLocked(g, h.id) && helpersHired(g) < slotsOf(st.helperSlots) && g.coins >= helperCost(g, h.id, st)) {
      buyHelper(g, h.id, st);
      if (h.id === "pip") log.pipAt ??= t;
      if (h.id === "roo") log.rooAt ??= t;
      return;
    }
  }
  const bestRecipe = [...RECIPES].filter((r) => !recipeLocked(g, r.id) && !g.recipes.includes(r.id)).sort((a, b) => b.value - a.value)[0];
  if (bestRecipe && g.coins >= recipeCost(bestRecipe.id, st)) {
    discoverRecipe(g, bestRecipe.id, st);
    return;
  }
  // Save for the cheapest big goal when it's reachable in about two minutes.
  const goals: number[] = [];
  if (nr) goals.push(regionCost(nr));
  if (bestRecipe) goals.push(recipeCost(bestRecipe.id, st));
  for (const h of HELPERS) {
    if ((g.helpers[h.id] ?? 0) === 0 && !helperLocked(g, h.id) && helpersHired(g) < slotsOf(st.helperSlots)) goals.push(helperCost(g, h.id, st));
  }
  const goal = Math.min(...goals, Infinity);
  const cheap = cheapestUpgrade(g, st);
  const saving = Number.isFinite(goal) && goal > g.coins && goal - g.coins < income * 120;
  if (saving && (!cheap || cheap.cost > (goal - g.coins) * 0.1)) return;
  const helperUp = HELPERS.filter((h) => (g.helpers[h.id] ?? 0) > 0 && (g.helpers[h.id] ?? 0) < h.maxLevel)
    .map((h) => ({ id: h.id, cost: helperCost(g, h.id, st) }))
    .sort((a, b) => a.cost - b.cost)[0];
  if (helperUp && (!cheap || helperUp.cost < cheap.cost) && g.coins >= helperUp.cost) {
    buyHelper(g, helperUp.id, st);
    return;
  }
  if (cheap && g.coins >= cheap.cost) {
    buyUpgrade(g, cheap.id, st);
    log.firstUpgradeAt ??= t;
  }
}

function cheapestUpgrade(g: GameState, st: ReturnType<typeof computeStats>) {
  return UPGRADES.filter((u) => !upgradeLocked(g, u.id) && (g.upgrades[u.id] ?? 0) < u.maxLevel)
    .map((u) => ({ id: u.id, cost: upgradeCost(g, u.id, st) }))
    .sort((a, b) => a.cost - b.cost)[0];
}

export function sunriseAndContinue(g: GameState): number {
  const r = performSunrise(g, 0);
  return r.ok ? r.tokens : 0;
}
