// Content type definitions. Every piece of game content is data with a stable ID.
// Localization keys are derived as `<family>.<id>.name` / `<family>.<id>.desc`
// and must exist in src/content/strings.ts (checked by the content validator).

export type RegionId =
  | "tiny_yard"
  | "sunny_lane"
  | "picnic_corner"
  | "market_row"
  | "orchard_hill"
  | "riverside"
  | "sunset_plaza"
  | "moonlit_market";

export type UpgradeId =
  | "lemon_tree"
  | "basket"
  | "stand_counter"
  | "juice_press"
  | "ice_box"
  | "signboard"
  | "cash_register"
  | "delivery_cart"
  | "helper_bench"
  | "sun_umbrella"
  | "flower_pots"
  | "recipe_book"
  // Facilities in the other zones
  | "grove_plot"
  | "sprinkler"
  | "beehive"
  | "sell_crate"
  | "lemon_chute"
  | "juice_factory"
  | "fountain"
  | "lucky_wheel"
  | "golden_statue";

/** Explorable zones, left to right. The camera moves between them with arrows. */
export type ZoneId = "grove" | "home" | "market" | "fair";

export type RecipeId =
  | "classic"
  | "honey_lemon"
  | "mint_sparkle"
  | "berry_fizz"
  | "peachy_tea"
  | "citrus_float"
  | "sunbeam_soda"
  | "moon_cooler";

export type CustomerId =
  | "mochi_cat"
  | "bun_rabbit"
  | "duckling"
  | "squirrel"
  | "fox"
  | "turtle"
  | "otter"
  | "golden_sun";

export type HelperId = "pip" | "roo" | "basil" | "peony" | "mochi" | "coco" | "nori" | "sunny";

export type PerkId =
  | "warm_soil"
  | "sunny_smiles"
  | "bright_ideas"
  | "golden_hour"
  | "open_windows"
  | "kind_neighbors"
  | "fresh_sign"
  | "longer_days"
  | "festival_spirit"
  | "evergreen_lane";

export type CosmeticId = "awning_lemon" | "awning_mint" | "awning_berry" | "awning_sky" | "awning_peach" | "awning_moon";

/** Every tunable number the simulation reads. Base values live in STAT_BASE. */
export type StatId =
  | "growthSpeed"
  | "fruitSlots"
  | "goldenChance"
  | "basketCap"
  | "counterCap"
  | "queueSize"
  | "pressSpeed"
  | "drinkValue"
  | "premiumChance"
  | "premiumBonus"
  | "arrivalRate"
  | "comboWindow"
  | "tipChance"
  | "deliveryRate"
  | "offlineEfficiency"
  | "offlineCapHours"
  | "helperSlots"
  | "helperSpeed"
  | "patience"
  | "favoriteBonus"
  | "recipeDiscount"
  | "tokenGain"
  | "incomeMult"
  | "upgradeCostScale"
  | "rewardMult"
  | "treeCount"
  | "starBonus"
  | "grovePlots"
  | "diamondChance"
  | "lemonPrice"
  | "autoSell"
  | "passiveIncome"
  | "wheelCooldown";

/**
 * A stat modifier applied once per level of its source (regions count as level 1).
 * Final stat = (base + Σ add·level) × (1 + Σ pct·level), then clamped by STAT_LIMITS.
 */
export interface Effect {
  stat: StatId;
  add?: number;
  pct?: number;
}

export interface UpgradeDef {
  id: UpgradeId;
  /** Zone where the station/facility stands in the world. */
  zone: ZoneId;
  region: RegionId;
  baseCost: number;
  growth: number;
  maxLevel: number;
  effects: Effect[];
  sort: number;
}

export type RecipeTrait = "none" | "premium" | "combo" | "offline" | "rare";

export interface RecipeDef {
  id: RecipeId;
  region: RegionId;
  unlockCost: number;
  /** Lemons consumed per drink. */
  lemons: number;
  /** Seconds per drink at press speed 1. */
  pressTime: number;
  /** Base sale value in coins. */
  value: number;
  trait: RecipeTrait;
  /** Sunrises required before this recipe can be discovered. */
  sunrises: number;
  art: { liquid: string; garnish: string; glass: "cup" | "tall" | "mug" | "float" | "bottle" | "star" };
  sort: number;
}

export interface CustomerDef {
  id: CustomerId;
  region: RegionId;
  /** Seconds a customer waits before leaving (before modifiers). */
  patience: number;
  /** Drinks per order. */
  order: number;
  /** Value multiplier applied to this customer's payment. */
  valueMult: number;
  /** Extra tip chance for this customer. */
  tipBonus: number;
  /** Relative spawn weight. */
  weight: number;
  favorite: RecipeId;
  sunrises: number;
  art: { body: string; accent: string; ears: "cat" | "rabbit" | "none" | "squirrel" | "fox" | "otter" | "sun"; shell?: boolean };
}

export type HelperAction = "harvest" | "serve" | "none";

export interface HelperDef {
  id: HelperId;
  region: RegionId;
  hireCost: number;
  growth: number;
  maxLevel: number;
  action: HelperAction;
  /** Seconds between actions at level 1 (for action helpers). */
  interval: number;
  /** Passive effects, applied per helper level. */
  effects: Effect[];
  art: { body: string; accent: string };
  sort: number;
}

export interface RegionDef {
  id: RegionId;
  cost: number;
  sunrises: number;
  effects: Effect[];
  sort: number;
}

export interface PerkDef {
  id: PerkId;
  baseCost: number;
  growth: number;
  maxLevel: number;
  effects: Effect[];
  sort: number;
}

export type QuestKind =
  | "harvest"
  | "serve"
  | "earn"
  | "buyUpgrade"
  | "upgradeLevel"
  | "hire"
  | "region"
  | "recipe"
  | "combo"
  | "golden"
  | "sunrise"
  | "sell"
  | "spin";

export interface QuestDef {
  id: string;
  kind: QuestKind;
  target: number;
  /** Optional content ID for kinds that reference one (e.g. an upgrade or helper). */
  ref?: string;
  reward: number;
}

export interface CosmeticDef {
  id: CosmeticId;
  stars: number;
  stripes: [string, string];
  sort: number;
}

export interface ZoneDef {
  id: ZoneId;
  /** Horizontal slot; home is 0, each zone is one world-width wide. */
  index: number;
}

export type WheelRewardKind = "coins" | "bigCoins" | "lemons" | "rush" | "ripen" | "drinks";

export interface WheelSegment {
  kind: WheelRewardKind;
  weight: number;
  color: string;
}
