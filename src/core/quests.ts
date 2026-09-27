// Goal chain: authored objectives first, then gently scaling generated goals.
import { QUESTS } from "../content/content";
import type { QuestDef, QuestKind } from "../content/types";
import { dailyAvailable, dailyReward, dayKey } from "./actions";
import { type StatBlock } from "./economy";
import { addCoins } from "./sim";
import type { GameState } from "./state";

export interface ActiveQuest {
  id: string;
  kind: QuestKind;
  ref?: string;
  target: number;
  reward: number;
  progress: number;
  done: boolean;
}

const GENERATED: QuestKind[] = ["serve", "harvest", "earn", "golden"];

function counterFor(g: GameState, kind: QuestKind): number {
  switch (kind) {
    case "harvest":
      return g.lifetime.lemonsHarvested;
    case "serve":
      return g.lifetime.customersServed;
    case "earn":
      return g.lifetime.coinsEarned;
    case "buyUpgrade":
      return g.lifetime.upgradesBought;
    case "golden":
      return g.lifetime.goldenHarvested;
    case "sell":
      return g.lifetime.lemonsSold;
    case "spin":
      return g.lifetime.wheelSpins;
    default:
      return 0;
  }
}

function isCumulative(kind: QuestKind): boolean {
  return kind === "harvest" || kind === "serve" || kind === "earn" || kind === "buyUpgrade" || kind === "golden" || kind === "sell" || kind === "spin";
}

function generatedDef(g: GameState): QuestDef {
  const k = g.quest.index - QUESTS.length;
  const kind = GENERATED[k % GENERATED.length];
  return { id: `gen_${k}`, kind, target: g.quest.target, reward: g.quest.reward };
}

export function currentQuestDef(g: GameState): QuestDef {
  return g.quest.index < QUESTS.length ? QUESTS[g.quest.index] : generatedDef(g);
}

export function evaluateQuest(g: GameState): ActiveQuest {
  const def = currentQuestDef(g);
  let progress = 0;
  switch (def.kind) {
    case "harvest":
    case "serve":
    case "earn":
    case "buyUpgrade":
    case "golden":
    case "sell":
    case "spin":
      progress = counterFor(g, def.kind) - g.quest.baseline;
      break;
    case "upgradeLevel":
      progress = (g.upgrades as Record<string, number>)[def.ref ?? ""] ?? 0;
      break;
    case "hire":
      progress = ((g.helpers as Record<string, number>)[def.ref ?? ""] ?? 0) > 0 ? 1 : 0;
      break;
    case "region":
      progress = g.regions.includes(def.ref as never) ? 1 : 0;
      break;
    case "recipe":
      progress = g.recipes.includes(def.ref as never) ? 1 : 0;
      break;
    case "combo":
      progress = g.quest.best;
      break;
    case "sunrise":
      progress = g.sunrises;
      break;
  }
  progress = Math.max(0, progress);
  return { ...def, progress: Math.min(progress, def.target), done: progress >= def.target };
}

/** Called whenever a combo is reached so combo goals can track the best since they began. */
export function noteCombo(g: GameState, combo: number): void {
  if (combo > g.quest.best) g.quest.best = combo;
}

/** Prepare the goal at g.quest.index (baseline, generated target). */
export function startQuest(g: GameState, incomePerSec: number): void {
  g.quest.best = 0;
  g.quest.target = 0;
  g.quest.reward = 0;
  if (g.quest.index >= QUESTS.length) {
    const k = g.quest.index - QUESTS.length;
    const kind = GENERATED[k % GENERATED.length];
    const round = Math.floor(k / GENERATED.length) + 1;
    const income = Math.max(1, incomePerSec);
    if (kind === "serve") g.quest.target = 40 + 20 * round;
    else if (kind === "harvest") g.quest.target = 80 + 40 * round;
    else if (kind === "golden") g.quest.target = Math.min(10, 1 + round);
    else g.quest.target = Math.ceil((income * 240) / 10) * 10;
    g.quest.reward = Math.max(50, Math.floor(income * (90 + 15 * Math.min(round, 10))));
  }
  const def = currentQuestDef(g);
  g.quest.baseline = isCumulative(def.kind) ? counterFor(g, def.kind) : 0;
}

export function claimQuest(g: GameState, s: StatBlock, incomePerSec: number): number {
  const q = evaluateQuest(g);
  if (!q.done) return 0;
  const reward = addCoins(g, q.reward * s.rewardMult);
  g.quest.index += 1;
  startQuest(g, incomePerSec);
  return reward;
}

export function claimDaily(g: GameState, s: StatBlock, incomePerSec: number, now: number): number {
  if (!dailyAvailable(g, now)) return 0;
  g.lastDailyDay = dayKey(now);
  return addCoins(g, dailyReward(incomePerSec, s));
}
