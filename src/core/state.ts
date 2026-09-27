// GameState: the authoritative, durable (saved) state, plus the temporary SessionState
// that is rebuilt on every load and never saved.
import type { CosmeticId, CustomerId, HelperId, PerkId, RecipeId, RegionId, UpgradeId } from "../content/types";

export const SAVE_SCHEMA = 2;

/** Tree slots: 0–4 stand beside the stand (home zone), 5–10 are Orchard Grove plots. */
export const HOME_TREE_SLOTS = 5;
export const GROVE_TREE_SLOTS = 6;

export interface Fruit {
  /** Growth progress 0..1; ripe at 1. */
  g: number;
  golden: boolean;
  /** Very rare, very valuable (schema 2+). */
  diamond?: boolean;
}

export interface QuestState {
  index: number;
  /** Counter value when this goal started (for cumulative goals). */
  baseline: number;
  /** Best combo seen since this goal started (for combo goals). */
  best: number;
  /** Generated goals store their own target/reward; authored goals leave these at 0. */
  target: number;
  reward: number;
}

export interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
}

export interface Stats {
  lemonsHarvested: number;
  customersServed: number;
  drinksMade: number;
  coinsEarned: number;
  upgradesBought: number;
  goldenHarvested: number;
  bestCombo: number;
  lemonsSold: number;
  diamondHarvested: number;
  wheelSpins: number;
}

export interface GameState {
  schema: number;
  /** Wall-clock ms of the last save; used for conflict resolution. */
  savedAt: number;
  /** Wall-clock ms of the last simulated moment; used for offline progress. */
  lastActiveAt: number;
  createdAt: number;

  // Temporary (reset by Sunrise)
  coins: number;
  runCoins: number;
  lemons: number;
  drinks: number;
  pressProgress: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  helpers: Partial<Record<HelperId, number>>;
  regions: RegionId[];
  activeRecipe: RecipeId;
  trees: Fruit[][];
  quest: QuestState;

  // Permanent (survive Sunrise)
  sunnyTokens: number;
  sunrises: number;
  perks: Partial<Record<PerkId, number>>;
  recipes: RecipeId[];
  stickers: CustomerId[];
  cosmetic: CosmeticId;
  lifetime: Stats;
  run: Stats;
  lastDailyDay: string;
  boostUntil: number;
  /** Wall-clock ms of the last Lucky Wheel spin (schema 2+). */
  lastSpinAt: number;
  settings: Settings;
  /** Once the player has served at least once, tutorial hints fade. */
  tutorialDone: boolean;
}

export function emptyStats(): Stats {
  return { lemonsHarvested: 0, customersServed: 0, drinksMade: 0, coinsEarned: 0, upgradesBought: 0, goldenHarvested: 0, bestCombo: 0, lemonsSold: 0, diamondHarvested: 0, wheelSpins: 0 };
}

export function freshQuest(): QuestState {
  return { index: 0, baseline: 0, best: 0, target: 0, reward: 0 };
}

export function createFreshState(now: number): GameState {
  return {
    schema: SAVE_SCHEMA,
    savedAt: 0,
    lastActiveAt: now,
    createdAt: now,
    coins: 0,
    runCoins: 0,
    lemons: 0,
    drinks: 0,
    pressProgress: 0,
    upgrades: {},
    helpers: {},
    regions: ["tiny_yard"],
    activeRecipe: "classic",
    // First fruit starts nearly ripe so the very first action is available within seconds.
    trees: [[{ g: 0.9, golden: false }, { g: 0.6, golden: false }, { g: 0.3, golden: false }]],
    quest: freshQuest(),
    sunnyTokens: 0,
    sunrises: 0,
    perks: {},
    recipes: ["classic"],
    stickers: [],
    cosmetic: "awning_lemon",
    lifetime: emptyStats(),
    run: emptyStats(),
    lastDailyDay: "",
    boostUntil: 0,
    lastSpinAt: 0,
    settings: { music: true, sfx: true, reducedMotion: false },
    tutorialDone: false,
  };
}

// ---------------------------------------------------------------------------
// Session (temporary) state: customers, timers, combo. Never saved.

export type CustomerPhase = "arriving" | "waiting" | "served" | "leaving";

export interface Customer {
  uid: number;
  type: CustomerId;
  /** Drinks still owed for this order. */
  owed: number;
  patience: number;
  patienceMax: number;
  premium: boolean;
  phase: CustomerPhase;
  /** Render position (world units) and animation timer. */
  x: number;
  t: number;
  mood: "happy" | "delighted" | "sad" | "neutral";
}

export interface SessionState {
  customers: Customer[];
  nextUid: number;
  arrivalTimer: number;
  helperTimers: Partial<Record<HelperId, number>>;
  deliveryTimer: number;
  combo: number;
  comboTimer: number;
  fountainTimer: number;
  fountainBank: number;
  /** Seconds of simulated time since boot (animation clock). */
  time: number;
}

export function createSession(): SessionState {
  return { customers: [], nextUid: 1, arrivalTimer: 1.5, helperTimers: {}, deliveryTimer: 0, combo: 0, comboTimer: 0, fountainTimer: 0, fountainBank: 0, time: 0 };
}
