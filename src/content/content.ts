// ContentRegistry: all balancing and content numbers live here, never in rendering code.
import type {
  ContractTier,
  CosmeticDef,
  WheelSegment,
  ZoneDef,
  CustomerDef,
  HelperDef,
  PerkDef,
  QuestDef,
  RecipeDef,
  RegionDef,
  StatId,
  UpgradeDef,
  UpgradeId,
} from "./types";

export const CONTENT_VERSION = 1;

export const STAT_BASE: Record<StatId, number> = {
  growthSpeed: 1,
  fruitSlots: 3,
  goldenChance: 0.02,
  basketCap: 8,
  counterCap: 3,
  queueSize: 2,
  pressSpeed: 1,
  drinkValue: 1,
  premiumChance: 0.08,
  premiumBonus: 0.5,
  arrivalRate: 1,
  comboWindow: 4,
  tipChance: 0.08,
  deliveryRate: 0,
  offlineEfficiency: 0.3,
  offlineCapHours: 2,
  helperSlots: 2,
  helperSpeed: 1,
  patience: 1,
  favoriteBonus: 0.25,
  recipeDiscount: 0,
  tokenGain: 1,
  incomeMult: 1,
  upgradeCostScale: 1,
  rewardMult: 1,
  treeCount: 1,
  starBonus: 0,
  grovePlots: 0,
  diamondChance: 0.002,
  lemonPrice: 1,
  autoSell: 0,
  passiveIncome: 0,
  wheelCooldown: 660,
  contractBonus: 0,
};

/** Soft limits keep multiplicative systems from running away. */
export const STAT_LIMITS: Partial<Record<StatId, [number, number]>> = {
  fruitSlots: [1, 12],
  goldenChance: [0, 0.25],
  basketCap: [1, 999],
  counterCap: [1, 40],
  queueSize: [1, 6],
  pressSpeed: [0.1, 25],
  premiumChance: [0, 0.5],
  arrivalRate: [0.1, 12],
  comboWindow: [1, 12],
  tipChance: [0, 0.6],
  offlineEfficiency: [0, 0.9],
  offlineCapHours: [0.5, 12],
  helperSlots: [0, 8],
  helperSpeed: [0.1, 6],
  patience: [0.2, 3],
  recipeDiscount: [0, 0.6],
  upgradeCostScale: [0.5, 1],
  treeCount: [1, 5],
  starBonus: [0, 1],
  grovePlots: [0, 6],
  diamondChance: [0, 0.05],
  lemonPrice: [0.5, 3],
  autoSell: [0, 1],
  wheelCooldown: [180, 900],
};

/** Global simulation constants (not tied to one content item). */
export const TUNING = {
  /** Seconds for one fruit to grow from blossom to ripe at growth speed 1. */
  fruitGrowTime: 5,
  /** Seconds between customer arrivals at arrival rate 1. */
  arrivalInterval: 4,
  /** Fraction of a press cycle added by one tap on the press. */
  squeezeBoost: 0.35,
  /** Each combo step adds this to the sale multiplier. */
  comboStep: 0.05,
  comboMaxSteps: 10,
  /** Tip size as a fraction of the sale. */
  tipSize: 0.5,
  /** Golden lemon harvest pays this many drinks' worth of coins. */
  goldenValueDrinks: 8,
  /** Delivery cart sells drinks at this fraction of their value. */
  deliveryValue: 0.8,
  /** Coins earned this run before Sunrise is possible. */
  sunriseMinCoins: 1_000_000,
  sunriseTokenScale: 3,
  /** Rewarded production burst. */
  burstSeconds: 90,
  burstMult: 2,
  /** Offline time shorter than this is simulated silently; longer shows a summary. */
  offlineSummaryMinSeconds: 60,
  dailyBaseReward: 100,
  dailyIncomeSeconds: 300,
  /** Diamond lemon harvest pays this many drinks' worth of coins. */
  diamondValueDrinks: 40,
  /** A raw lemon sells for this fraction of a drink's per-lemon value (before Sell Crate upgrades). */
  rawLemonShare: 0.25,
  /** Fountain pays out in lumps this often (seconds). */
  fountainInterval: 3,
  /** Lucky Wheel rewards. */
  wheelCoinSeconds: 60,
  wheelBigCoinSeconds: 300,
  wheelMinCoins: 40,
  wheelRushSeconds: 45,
  /** Perfect Squeeze: the gauge sweeps at this speed (rad/s); the top slice of the sweep is "perfect". */
  meterSpeed: 1.7,
  perfectWindow: 0.16,
  perfectBoost: 0.6,
  /** Extra value for a Perfect drink. */
  perfectBonus: 0.5,
  /** Market Demand: one recipe is "hot" for this many minutes, worth this much more. */
  demandMinutes: 4,
  demandBonus: 0.5,
  /** Order Board: new offers after finishing/expiring, offer rotation, streak bonus per success. */
  contractCooldownSeconds: 20,
  contractRotateMinutes: 10,
  contractStreakStep: 0.1,
  contractStreakMax: 5,
};

export const UPGRADES: UpgradeDef[] = [
  { id: "lemon_tree", zone: "home", region: "tiny_yard", baseCost: 15, growth: 1.45, maxLevel: 40, sort: 1,
    effects: [{ stat: "growthSpeed", pct: 0.12 }, { stat: "fruitSlots", add: 0.25 }] },
  { id: "signboard", zone: "home", region: "tiny_yard", baseCost: 20, growth: 1.5, maxLevel: 40, sort: 2,
    effects: [{ stat: "arrivalRate", pct: 0.12 }] },
  { id: "juice_press", zone: "home", region: "tiny_yard", baseCost: 30, growth: 1.5, maxLevel: 40, sort: 3,
    effects: [{ stat: "pressSpeed", pct: 0.15 }, { stat: "drinkValue", pct: 0.08 }] },
  { id: "basket", zone: "home", region: "tiny_yard", baseCost: 25, growth: 1.55, maxLevel: 30, sort: 4,
    effects: [{ stat: "basketCap", add: 4 }] },
  { id: "stand_counter", zone: "home", region: "tiny_yard", baseCost: 40, growth: 1.6, maxLevel: 30, sort: 5,
    effects: [{ stat: "counterCap", add: 1 }, { stat: "queueSize", add: 0.34 }] },
  { id: "flower_pots", zone: "home", region: "sunny_lane", baseCost: 120, growth: 1.55, maxLevel: 30, sort: 6,
    effects: [{ stat: "tipChance", add: 0.015 }, { stat: "patience", pct: 0.04 }] },
  { id: "ice_box", zone: "home", region: "sunny_lane", baseCost: 180, growth: 1.6, maxLevel: 30, sort: 7,
    effects: [{ stat: "premiumBonus", add: 0.1 }, { stat: "premiumChance", add: 0.01 }] },
  { id: "sun_umbrella", zone: "home", region: "sunny_lane", baseCost: 220, growth: 1.6, maxLevel: 25, sort: 8,
    effects: [{ stat: "patience", pct: 0.08 }] },
  { id: "cash_register", zone: "home", region: "picnic_corner", baseCost: 900, growth: 1.6, maxLevel: 30, sort: 9,
    effects: [{ stat: "comboWindow", add: 0.5 }, { stat: "tipChance", add: 0.01 }] },
  { id: "recipe_book", zone: "home", region: "picnic_corner", baseCost: 1200, growth: 1.7, maxLevel: 12, sort: 10,
    effects: [{ stat: "recipeDiscount", add: 0.05 }, { stat: "favoriteBonus", add: 0.05 }] },
  { id: "helper_bench", zone: "home", region: "picnic_corner", baseCost: 1800, growth: 2.2, maxLevel: 6, sort: 11,
    effects: [{ stat: "helperSlots", add: 1 }, { stat: "helperSpeed", pct: 0.05 }] },
  { id: "delivery_cart", zone: "home", region: "market_row", baseCost: 9000, growth: 1.65, maxLevel: 30, sort: 12,
    effects: [{ stat: "deliveryRate", add: 3 }, { stat: "offlineEfficiency", add: 0.015 }] },

  // Orchard Grove (left)
  { id: "grove_plot", zone: "grove", region: "tiny_yard", baseCost: 250, growth: 2.3, maxLevel: 6, sort: 20,
    effects: [{ stat: "grovePlots", add: 1 }] },
  { id: "sprinkler", zone: "grove", region: "sunny_lane", baseCost: 700, growth: 1.65, maxLevel: 20, sort: 21,
    effects: [{ stat: "growthSpeed", pct: 0.1 }] },
  { id: "beehive", zone: "grove", region: "picnic_corner", baseCost: 5000, growth: 1.8, maxLevel: 15, sort: 22,
    effects: [{ stat: "goldenChance", add: 0.006 }, { stat: "diamondChance", add: 0.0015 }] },

  // Market Square (right)
  { id: "sell_crate", zone: "market", region: "tiny_yard", baseCost: 40, growth: 1.55, maxLevel: 30, sort: 30,
    effects: [{ stat: "lemonPrice", pct: 0.12 }] },
  { id: "lemon_chute", zone: "market", region: "sunny_lane", baseCost: 1200, growth: 2, maxLevel: 1, sort: 31,
    effects: [{ stat: "autoSell", add: 1 }] },
  { id: "juice_factory", zone: "market", region: "picnic_corner", baseCost: 9000, growth: 1.75, maxLevel: 20, sort: 32,
    effects: [{ stat: "pressSpeed", pct: 0.25 }, { stat: "counterCap", add: 0.5 }] },

  // Lemon Fair (far right)
  { id: "lucky_wheel", zone: "fair", region: "tiny_yard", baseCost: 250, growth: 3, maxLevel: 5, sort: 40,
    effects: [{ stat: "wheelCooldown", add: -60 }] },
  { id: "fountain", zone: "fair", region: "sunny_lane", baseCost: 1500, growth: 1.6, maxLevel: 25, sort: 41,
    effects: [{ stat: "passiveIncome", add: 2 }] },
  { id: "order_board", zone: "market", region: "tiny_yard", baseCost: 350, growth: 2.1, maxLevel: 10, sort: 33,
    effects: [{ stat: "contractBonus", add: 0.15 }] },
  { id: "golden_statue", zone: "fair", region: "market_row", baseCost: 40000, growth: 2, maxLevel: 10, sort: 42,
    effects: [{ stat: "incomeMult", pct: 0.12 }] },
];

export const ZONES: ZoneDef[] = [
  { id: "grove", index: -1 },
  { id: "home", index: 0 },
  { id: "market", index: 1 },
  { id: "fair", index: 2 },
];

/** Upgrades that only exist as a building once bought (level 0 shows a construction outline). */
export const FACILITY_IDS: UpgradeId[] = ["sprinkler", "beehive", "sell_crate", "lemon_chute", "juice_factory", "order_board", "lucky_wheel", "fountain", "golden_statue"];

/** Order Board contract tiers: easy, medium, big. */
export const CONTRACT_TIERS: ContractTier[] = [
  { count: [6, 10], seconds: 180, mult: 2.2 },
  { count: [14, 22], seconds: 300, mult: 2.8 },
  { count: [30, 45], seconds: 480, mult: 3.6 },
];

export const WHEEL: WheelSegment[] = [
  { kind: "coins", weight: 3, color: "#FFD95A" },
  { kind: "lemons", weight: 2, color: "#79C96B" },
  { kind: "ripen", weight: 2, color: "#A9DDF5" },
  { kind: "coins", weight: 3, color: "#FFF4D6" },
  { kind: "drinks", weight: 1.5, color: "#F4A3B8" },
  { kind: "rush", weight: 1.5, color: "#F28C7A" },
  { kind: "coins", weight: 3, color: "#FFD95A" },
  { kind: "bigCoins", weight: 1, color: "#FFC83D" },
];

export const RECIPES: RecipeDef[] = [
  { id: "classic", region: "tiny_yard", unlockCost: 0, lemons: 1, pressTime: 2.5, value: 5, trait: "none", sunrises: 0, sort: 1,
    art: { liquid: "#FFE680", garnish: "#FFD95A", glass: "cup" } },
  { id: "honey_lemon", region: "sunny_lane", unlockCost: 900, lemons: 2, pressTime: 4, value: 16, trait: "none", sunrises: 0, sort: 2,
    art: { liquid: "#F7C04A", garnish: "#C98A2B", glass: "mug" } },
  { id: "mint_sparkle", region: "picnic_corner", unlockCost: 4000, lemons: 1, pressTime: 2, value: 30, trait: "premium", sunrises: 0, sort: 3,
    art: { liquid: "#C8F0C0", garnish: "#79C96B", glass: "tall" } },
  { id: "berry_fizz", region: "picnic_corner", unlockCost: 9000, lemons: 2, pressTime: 3, value: 70, trait: "combo", sunrises: 0, sort: 4,
    art: { liquid: "#F4A3B8", garnish: "#C94F6D", glass: "tall" } },
  { id: "peachy_tea", region: "market_row", unlockCost: 40000, lemons: 2, pressTime: 4, value: 160, trait: "offline", sunrises: 0, sort: 5,
    art: { liquid: "#F9C79A", garnish: "#F28C7A", glass: "mug" } },
  { id: "citrus_float", region: "orchard_hill", unlockCost: 250000, lemons: 3, pressTime: 5, value: 450, trait: "rare", sunrises: 0, sort: 6,
    art: { liquid: "#FFF1B8", garnish: "#FFFDF7", glass: "float" } },
  { id: "sunbeam_soda", region: "sunset_plaza", unlockCost: 6_000_000, lemons: 3, pressTime: 4, value: 2500, trait: "none", sunrises: 1, sort: 7,
    art: { liquid: "#FFB347", garnish: "#FFD95A", glass: "bottle" } },
  { id: "moon_cooler", region: "moonlit_market", unlockCost: 40_000_000, lemons: 4, pressTime: 5, value: 9000, trait: "none", sunrises: 2, sort: 8,
    art: { liquid: "#B9C7F5", garnish: "#FFFDF7", glass: "star" } },
];

/** Bonuses granted by a recipe's trait while it is the active recipe. */
export const RECIPE_TRAIT_BONUS = {
  premium: 0.1, // + premium chance
  combo: 5, // + max combo steps
  offline: 0.15, // + offline efficiency
  rare: 0.03, // + golden chance
};

export const CUSTOMERS: CustomerDef[] = [
  { id: "mochi_cat", region: "tiny_yard", patience: 30, order: 1, valueMult: 1, tipBonus: 0, weight: 5, favorite: "classic", sunrises: 0,
    art: { body: "#F6E2C8", accent: "#F28C7A", ears: "cat" } },
  { id: "bun_rabbit", region: "tiny_yard", patience: 14, order: 1, valueMult: 1.2, tipBonus: 0.1, weight: 3, favorite: "mint_sparkle", sunrises: 0,
    art: { body: "#FFFDF7", accent: "#F4A3B8", ears: "rabbit" } },
  { id: "duckling", region: "sunny_lane", patience: 22, order: 1, valueMult: 1.1, tipBonus: 0.02, weight: 3, favorite: "honey_lemon", sunrises: 0,
    art: { body: "#FFE680", accent: "#F7A541", ears: "none" } },
  { id: "squirrel", region: "picnic_corner", patience: 24, order: 1, valueMult: 1.2, tipBonus: 0.03, weight: 3, favorite: "berry_fizz", sunrises: 0,
    art: { body: "#D08A56", accent: "#FFF4D6", ears: "squirrel" } },
  { id: "otter", region: "picnic_corner", patience: 20, order: 1, valueMult: 1.25, tipBonus: 0.05, weight: 2, favorite: "mint_sparkle", sunrises: 0,
    art: { body: "#9C7358", accent: "#E9D3BC", ears: "otter" } },
  { id: "fox", region: "market_row", patience: 18, order: 1, valueMult: 1.8, tipBonus: 0.15, weight: 2, favorite: "peachy_tea", sunrises: 0,
    art: { body: "#F28C4A", accent: "#FFFDF7", ears: "fox" } },
  { id: "turtle", region: "market_row", patience: 45, order: 3, valueMult: 1.1, tipBonus: 0.02, weight: 2, favorite: "citrus_float", sunrises: 0,
    art: { body: "#9BD58A", accent: "#5E9E57", ears: "none", shell: true } },
  { id: "golden_sun", region: "sunset_plaza", patience: 25, order: 2, valueMult: 5, tipBonus: 0.3, weight: 0.4, favorite: "sunbeam_soda", sunrises: 1,
    art: { body: "#FFD95A", accent: "#F7A541", ears: "sun" } },
];

export const HELPERS: HelperDef[] = [
  { id: "pip", region: "tiny_yard", hireCost: 150, growth: 1.9, maxLevel: 15, action: "harvest", interval: 2.2, effects: [], sort: 1,
    art: { body: "#FFE680", accent: "#79C96B" } },
  { id: "roo", region: "sunny_lane", hireCost: 500, growth: 1.9, maxLevel: 15, action: "serve", interval: 2.6, effects: [], sort: 2,
    art: { body: "#E9B98A", accent: "#F28C7A" } },
  { id: "basil", region: "picnic_corner", hireCost: 2500, growth: 2.0, maxLevel: 15, action: "none", interval: 0, sort: 3,
    effects: [{ stat: "pressSpeed", pct: 0.2 }], art: { body: "#9BD58A", accent: "#3F7650" } },
  { id: "peony", region: "picnic_corner", hireCost: 4000, growth: 2.0, maxLevel: 15, action: "none", interval: 0, sort: 4,
    effects: [{ stat: "patience", pct: 0.08 }, { stat: "tipChance", add: 0.01 }], art: { body: "#F4A3B8", accent: "#FFFDF7" } },
  { id: "mochi", region: "market_row", hireCost: 20000, growth: 2.0, maxLevel: 15, action: "none", interval: 0, sort: 5,
    effects: [{ stat: "tipChance", add: 0.03 }], art: { body: "#FFFDF7", accent: "#5A4638" } },
  { id: "coco", region: "orchard_hill", hireCost: 120000, growth: 2.1, maxLevel: 15, action: "none", interval: 0, sort: 6,
    effects: [{ stat: "starBonus", add: 0.004 }], art: { body: "#A7744F", accent: "#FFD95A" } },
  { id: "nori", region: "riverside", hireCost: 700000, growth: 2.1, maxLevel: 15, action: "none", interval: 0, sort: 7,
    effects: [{ stat: "premiumChance", add: 0.02 }], art: { body: "#5E7F6B", accent: "#A9DDF5" } },
  { id: "sunny", region: "sunset_plaza", hireCost: 4_000_000, growth: 2.2, maxLevel: 10, action: "none", interval: 0, sort: 8,
    effects: [{ stat: "tokenGain", pct: 0.1 }], art: { body: "#FFD95A", accent: "#F28C7A" } },
];

export const REGIONS: RegionDef[] = [
  { id: "tiny_yard", cost: 0, sunrises: 0, sort: 1, effects: [] },
  { id: "sunny_lane", cost: 450, sunrises: 0, sort: 2,
    effects: [{ stat: "queueSize", add: 1 }, { stat: "treeCount", add: 1 }, { stat: "incomeMult", pct: 0.25 }] },
  { id: "picnic_corner", cost: 4000, sunrises: 0, sort: 3,
    effects: [{ stat: "patience", pct: 0.1 }, { stat: "incomeMult", pct: 0.5 }] },
  { id: "market_row", cost: 20000, sunrises: 0, sort: 4,
    effects: [{ stat: "arrivalRate", pct: 0.25 }, { stat: "incomeMult", pct: 0.75 }] },
  { id: "orchard_hill", cost: 150000, sunrises: 0, sort: 5,
    effects: [{ stat: "treeCount", add: 2 }, { stat: "goldenChance", add: 0.02 }, { stat: "incomeMult", pct: 1 }] },
  { id: "riverside", cost: 900000, sunrises: 0, sort: 6,
    effects: [{ stat: "offlineEfficiency", add: 0.1 }, { stat: "deliveryRate", add: 6 }, { stat: "incomeMult", pct: 1.5 }] },
  { id: "sunset_plaza", cost: 5_000_000, sunrises: 1, sort: 7,
    effects: [{ stat: "premiumChance", add: 0.05 }, { stat: "incomeMult", pct: 2 }] },
  { id: "moonlit_market", cost: 30_000_000, sunrises: 2, sort: 8,
    effects: [{ stat: "tokenGain", pct: 0.25 }, { stat: "incomeMult", pct: 3 }] },
];

export const PERKS: PerkDef[] = [
  { id: "warm_soil", baseCost: 1, growth: 1.5, maxLevel: 20, sort: 1, effects: [{ stat: "growthSpeed", pct: 0.15 }] },
  { id: "sunny_smiles", baseCost: 1, growth: 1.5, maxLevel: 20, sort: 2, effects: [{ stat: "arrivalRate", pct: 0.1 }] },
  { id: "bright_ideas", baseCost: 2, growth: 1.7, maxLevel: 10, sort: 3, effects: [{ stat: "upgradeCostScale", pct: -0.04 }] },
  { id: "golden_hour", baseCost: 2, growth: 1.6, maxLevel: 10, sort: 4, effects: [{ stat: "goldenChance", add: 0.01 }] },
  { id: "open_windows", baseCost: 1, growth: 1.6, maxLevel: 10, sort: 5, effects: [{ stat: "offlineEfficiency", add: 0.05 }] },
  { id: "kind_neighbors", baseCost: 2, growth: 1.6, maxLevel: 15, sort: 6, effects: [{ stat: "helperSpeed", pct: 0.1 }] },
  { id: "fresh_sign", baseCost: 2, growth: 1.6, maxLevel: 10, sort: 7, effects: [{ stat: "premiumChance", add: 0.02 }] },
  { id: "longer_days", baseCost: 2, growth: 1.8, maxLevel: 8, sort: 8, effects: [{ stat: "offlineCapHours", add: 1 }] },
  { id: "festival_spirit", baseCost: 1, growth: 1.6, maxLevel: 10, sort: 9, effects: [{ stat: "rewardMult", pct: 0.15 }] },
  { id: "evergreen_lane", baseCost: 5, growth: 1, maxLevel: 1, sort: 10, effects: [{ stat: "incomeMult", pct: 0.25 }] },
];

/** Authored objective chain; after it ends, generated goals take over (see core/quests.ts). */
export const QUESTS: QuestDef[] = [
  { id: "q_first_pick", kind: "harvest", target: 3, reward: 10 },
  { id: "q_first_serve", kind: "serve", target: 2, reward: 10 },
  { id: "q_first_upgrade", kind: "buyUpgrade", target: 1, reward: 15 },
  { id: "q_hire_pip", kind: "hire", ref: "pip", target: 1, reward: 25 },
  { id: "q_build_crate", kind: "upgradeLevel", ref: "sell_crate", target: 1, reward: 30 },
  { id: "q_sell_20", kind: "sell", target: 20, reward: 40 },
  { id: "q_perfect_3", kind: "perfect", target: 3, reward: 50 },
  { id: "q_serve_10", kind: "serve", target: 10, reward: 40 },
  { id: "q_tree_3", kind: "upgradeLevel", ref: "lemon_tree", target: 3, reward: 60 },
  { id: "q_wheel", kind: "upgradeLevel", ref: "lucky_wheel", target: 1, reward: 80 },
  { id: "q_spin", kind: "spin", target: 1, reward: 60 },
  { id: "q_plot", kind: "upgradeLevel", ref: "grove_plot", target: 1, reward: 120 },
  { id: "q_board", kind: "upgradeLevel", ref: "order_board", target: 1, reward: 150 },
  { id: "q_contract_1", kind: "contract", target: 1, reward: 300 },
  { id: "q_sunny_lane", kind: "region", ref: "sunny_lane", target: 1, reward: 100 },
  { id: "q_hire_roo", kind: "hire", ref: "roo", target: 1, reward: 150 },
  { id: "q_honey", kind: "recipe", ref: "honey_lemon", target: 1, reward: 200 },
  { id: "q_fountain", kind: "upgradeLevel", ref: "fountain", target: 1, reward: 400 },
  { id: "q_combo_5", kind: "combo", target: 5, reward: 250 },
  { id: "q_golden", kind: "golden", target: 1, reward: 300 },
  { id: "q_earn_5k", kind: "earn", target: 5000, reward: 500 },
  { id: "q_picnic", kind: "region", ref: "picnic_corner", target: 1, reward: 800 },
  { id: "q_press_10", kind: "upgradeLevel", ref: "juice_press", target: 10, reward: 1500 },
  { id: "q_mint", kind: "recipe", ref: "mint_sparkle", target: 1, reward: 2500 },
  { id: "q_hire_basil", kind: "hire", ref: "basil", target: 1, reward: 3000 },
  { id: "q_factory", kind: "upgradeLevel", ref: "juice_factory", target: 1, reward: 4000 },
  { id: "q_serve_250", kind: "serve", target: 250, reward: 5000 },
  { id: "q_market", kind: "region", ref: "market_row", target: 1, reward: 10000 },
  { id: "q_combo_15", kind: "combo", target: 15, reward: 15000 },
  { id: "q_earn_250k", kind: "earn", target: 250000, reward: 40000 },
  { id: "q_orchard", kind: "region", ref: "orchard_hill", target: 1, reward: 80000 },
  { id: "q_sunrise", kind: "sunrise", target: 1, reward: 500 },
];

export const COSMETICS: CosmeticDef[] = [
  { id: "awning_lemon", stars: 0, stripes: ["#FFD95A", "#FFFDF7"], sort: 1 },
  { id: "awning_mint", stars: 3, stripes: ["#79C96B", "#FFFDF7"], sort: 2 },
  { id: "awning_berry", stars: 6, stripes: ["#F28C7A", "#FFF4D6"], sort: 3 },
  { id: "awning_sky", stars: 10, stripes: ["#A9DDF5", "#FFFDF7"], sort: 4 },
  { id: "awning_peach", stars: 14, stripes: ["#F9C79A", "#F28C7A"], sort: 5 },
  { id: "awning_moon", stars: 20, stripes: ["#6C7BC4", "#FFD95A"], sort: 6 },
];

/** Authored goal IDs as shipped in save schema 1, used to remap goal progress in migration 1 → 2. */
export const QUEST_IDS_V1 = [
  "q_first_pick", "q_first_serve", "q_first_upgrade", "q_hire_pip", "q_serve_10", "q_tree_3", "q_sunny_lane", "q_hire_roo",
  "q_honey", "q_combo_5", "q_golden", "q_earn_5k", "q_picnic", "q_press_10", "q_mint", "q_hire_basil", "q_serve_250",
  "q_market", "q_combo_15", "q_earn_250k", "q_orchard", "q_sunrise",
];

/** Authored goal IDs as shipped in save schema 2, used to remap goal progress in migration 2 → 3. */
export const QUEST_IDS_V2 = [
  "q_first_pick", "q_first_serve", "q_first_upgrade", "q_hire_pip", "q_build_crate", "q_sell_20", "q_serve_10", "q_tree_3",
  "q_wheel", "q_spin", "q_plot", "q_sunny_lane", "q_hire_roo", "q_honey", "q_fountain", "q_combo_5", "q_golden", "q_earn_5k",
  "q_picnic", "q_press_10", "q_mint", "q_hire_basil", "q_factory", "q_serve_250", "q_market", "q_combo_15", "q_earn_250k",
  "q_orchard", "q_sunrise",
];

export const upgradeById = new Map(UPGRADES.map((u) => [u.id, u]));
export const recipeById = new Map(RECIPES.map((r) => [r.id, r]));
export const customerById = new Map(CUSTOMERS.map((c) => [c.id, c]));
export const helperById = new Map(HELPERS.map((h) => [h.id, h]));
export const regionById = new Map(REGIONS.map((r) => [r.id, r]));
export const perkById = new Map(PERKS.map((p) => [p.id, p]));
export const cosmeticById = new Map(COSMETICS.map((c) => [c.id, c]));
export const zoneById = new Map(ZONES.map((z) => [z.id, z]));
