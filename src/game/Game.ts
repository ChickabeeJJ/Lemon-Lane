// Game: owns state, runs the fixed-step simulation, routes events to presentation,
// and is the single entry point for every player action (atomic → save → animate).
import { TUNING } from "../content/content";
import { nameOf, t } from "../content/strings";
import type { CosmeticId, HelperId, PerkId, RecipeId, RegionId, UpgradeId } from "../content/types";
import { Analytics } from "../analytics/Analytics";
import { AudioManager } from "../audio/AudioManager";
import {
  buyHelper,
  buyPerk,
  buyUpgrade,
  cosmeticUnlocked,
  discoverRecipe,
  equipCosmetic,
  nextRegion,
  performSunrise,
  setActiveRecipe,
  unlockRegion,
  type ActionResult,
} from "../core/actions";
import { automatedRates, collectionStars, computeStats, offlineEarnings, regionCost, slotsOf, type StatBlock } from "../core/economy";
import { GROUND_Y, LAYOUT } from "../core/layout";
import { claimDaily, claimQuest, evaluateQuest, noteCombo, startQuest, type ActiveQuest } from "../core/quests";
import { createRng, type Rng } from "../core/rng";
import { harvestAny, harvestTree, pressCanRun, sellLemons, serveFront, squeeze, step, addCoins, type SimContext, type SimEvent } from "../core/sim";
import { createFreshState, createSession, type GameState, type SessionState, type Settings } from "../core/state";
import type { PlatformAdapter, PlatformUser } from "../platform/PlatformAdapter";
import { Renderer, type ViewExtras } from "../render/Renderer";
import type { LoadStatus, SaveManager } from "../save/SaveManager";
import { formatDuration, formatNumber } from "../ui/format";
import { C } from "../render/palette";
import { COSMETICS, FACILITY_IDS, ZONES, upgradeById, zoneById } from "../content/content";
import { upgradeLocked } from "../core/actions";
import { rawLemonValue, upgradeCost } from "../core/economy";
import { FACILITY_SPOTS, type FacilitySpotId } from "../core/layout";
import { spinCooldownLeft, spinWheel, wheelOwned } from "../core/wheel";
import type { ZoneId } from "../content/types";

const TICK = 1 / 30;
const SAVE_DEBOUNCE_MS = 2000;
const SAVE_PERIOD_MS = 15000;

export interface GameHooks {
  toast(text: string, kind?: "info" | "good" | "warn"): void;
  zoneChanged(zone: ZoneId): void;
  offlineSummary(seconds: number, coins: number, onCollect: (doubled: boolean) => void): void;
  sunriseTransition(): void;
  structureChanged(): void;
}

export class Game {
  g: GameState;
  s: SessionState = createSession();
  stats: StatBlock;
  readonly analytics = new Analytics();
  readonly audio = new AudioManager();
  user: PlatformUser | null = null;
  private rng: Rng;
  private renderer!: Renderer;
  private hooks!: GameHooks;
  private acc = 0;
  private lastFrame = 0;
  private running = false;
  private hidden = false;
  private blocked = 0;
  private playing = false;
  private lastSave = 0;
  private saveDueAt = 0;
  private sessionStart = Date.now();
  private sessionMarks = new Set<string>();
  private earnLog: { at: number; amount: number }[] = [];
  private notifiedQuest = -1;
  /** Current zone slot: -1 grove, 0 stand, 1 market, 2 fair. */
  zoneIndex = 0;
  private starsSeen = 0;
  private extras: ViewExtras = {
    now: 0,
    reducedMotion: false,
    pressSquash: 0,
    treeShake: [],
    helperWorking: {},
    cartTimer: 0,
  };

  constructor(
    readonly platform: PlatformAdapter,
    private saves: SaveManager,
    loaded: GameState,
    private loadStatus: LoadStatus,
  ) {
    this.g = loaded;
    this.rng = createRng((Date.now() ^ 0x5eed) >>> 0);
    this.stats = computeStats(this.g);
    this.starsSeen = collectionStars(this.g);
    if (this.g.quest.index === 0 && this.g.quest.baseline === 0) startQuest(this.g, 0);
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.renderer = new Renderer(canvas);
  }

  setHooks(h: GameHooks): void {
    this.hooks = h;
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  async start(): Promise<void> {
    this.analytics.track("session_start", { platform: this.platform.name, returning: this.loadStatus !== "fresh" });
    if (this.loadStatus === "loaded" || this.loadStatus === "recovered") this.analytics.track("load_success", { status: this.loadStatus });
    if (this.loadStatus === "recovered") {
      this.analytics.track("load_conflict", { resolved: "backup" });
      this.hooks.toast(t("ui.saveRecovered"), "warn");
    }
    if (this.loadStatus === "quarantined") this.hooks.toast(t("ui.saveQuarantine"), "warn");

    this.audio.setSettings(this.g.settings.music, this.g.settings.sfx);
    this.audio.setExternalMute(this.platform.platformMuted());
    this.platform.onSettingsChange(() => this.audio.setExternalMute(this.platform.platformMuted()));
    this.user = await this.platform.getUser();

    this.catchUp(Date.now(), true);
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
    this.updateGameplayState();

    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", () => this.saveNow());
  }

  resize(cssW: number, cssH: number, insetBottom = 0): void {
    this.renderer.resize(cssW, cssH, window.devicePixelRatio || 1, insetBottom);
  }

  /** Pause/unpause for modals and ads; gameplay events follow. */
  block(on: boolean): void {
    this.blocked = Math.max(0, this.blocked + (on ? 1 : -1));
    this.updateGameplayState();
  }

  private updateGameplayState(): void {
    const playing = this.running && !this.hidden && this.blocked === 0;
    if (playing === this.playing) return;
    this.playing = playing;
    if (playing) {
      this.platform.gameplayStart();
      this.analytics.track("gameplay_start");
    } else {
      this.platform.gameplayStop();
      this.analytics.track("gameplay_stop");
    }
  }

  private onVisibility = (): void => {
    this.hidden = document.visibilityState === "hidden";
    this.audio.setHidden(this.hidden);
    if (this.hidden) {
      this.g.lastActiveAt = Date.now();
      this.saveNow();
    } else {
      this.catchUp(Date.now(), false);
      this.lastFrame = performance.now();
    }
    this.updateGameplayState();
  };

  /** Apply time passed while the game was closed or hidden. */
  private catchUp(now: number, onBoot: boolean): void {
    const away = (now - this.g.lastActiveAt) / 1000;
    if (!Number.isFinite(away) || away <= 0) {
      this.g.lastActiveAt = now;
      return;
    }
    if (away < TUNING.offlineSummaryMinSeconds && !onBoot) {
      this.simulate(Math.min(away, 60));
      this.g.lastActiveAt = now;
      return;
    }
    if (away < TUNING.offlineSummaryMinSeconds) {
      this.g.lastActiveAt = now;
      return;
    }
    const res = offlineEarnings(this.g, this.stats, away);
    this.g.lastActiveAt = now;
    if (res.coins <= 0 && !onBoot) return;
    if (res.coins <= 0 && this.g.lifetime.customersServed === 0) return;
    this.hooks.offlineSummary(res.seconds, res.coins, (doubled) => {
      const amount = addCoins(this.g, res.coins * (doubled ? 2 : 1));
      if (amount > 0) {
        this.renderer.floatText(640, 260, `+${formatNumber(amount)}`, C.cocoa, 28);
        this.audio.play("coin");
      }
      this.requestSave(true);
    });
  }

  // -------------------------------------------------------------------------
  // Loop

  private frame = (ts: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.25, Math.max(0, (ts - this.lastFrame) / 1000));
    this.lastFrame = ts;
    if (!this.hidden) {
      if (this.blocked === 0) {
        this.acc += dt;
        while (this.acc >= TICK) {
          this.acc -= TICK;
          this.simulate(TICK);
        }
      }
      this.tickPresentation(dt);
      this.renderer.render(this.g, this.s, this.stats, this.extras, this.blocked === 0 ? dt : 0, dt);
    }
    this.housekeeping();
    requestAnimationFrame(this.frame);
  };

  private ctx(): SimContext {
    return { stats: this.stats, rng: this.rng, now: Date.now(), emit: (e) => this.onSimEvent(e) };
  }

  private simulate(dt: number): void {
    this.stats = computeStats(this.g);
    step(this.g, this.s, dt, this.ctx());
    this.g.lastActiveAt = Date.now();
  }

  private tickPresentation(dt: number): void {
    const x = this.extras;
    x.now = Date.now();
    x.reducedMotion = this.g.settings.reducedMotion;
    x.pressSquash = Math.max(0, x.pressSquash - dt * 5);
    x.treeShake = x.treeShake.map((v) => Math.max(0, v - dt * 3));
    for (const k of Object.keys(x.helperWorking) as HelperId[]) x.helperWorking[k] = Math.max(0, (x.helperWorking[k] ?? 0) - dt);
    x.cartTimer = Math.max(0, x.cartTimer - dt * 0.8);
    const nr = nextRegion(this.g);
    x.nextRegion = nr;
    x.nextRegionCost = nr ? regionCost(nr) : undefined;
  }

  private housekeeping(): void {
    const now = Date.now();
    // Quest completion notice
    const q = evaluateQuest(this.g);
    if (q.done && this.notifiedQuest !== this.g.quest.index) {
      this.notifiedQuest = this.g.quest.index;
      this.hooks.toast(t("ui.toast.quest"), "good");
      this.audio.play("sparkle");
    }
    // New cosmetics unlocked by collection stars
    const stars = collectionStars(this.g);
    if (stars > this.starsSeen) {
      for (const c of COSMETICS) if (c.stars > this.starsSeen && c.stars <= stars) this.hooks.toast(t("ui.toast.cosmetic", { ref: nameOf("cosmetic", c.id) }), "good");
      this.starsSeen = stars;
    }
    // Session milestones
    const elapsed = now - this.sessionStart;
    if (elapsed > 120_000 && !this.sessionMarks.has("2")) {
      this.sessionMarks.add("2");
      this.analytics.track("session_2min");
    }
    if (elapsed > 600_000 && !this.sessionMarks.has("10")) {
      this.sessionMarks.add("10");
      this.analytics.track("session_10min");
    }
    // Saving
    if ((this.saveDueAt && now >= this.saveDueAt) || now - this.lastSave > SAVE_PERIOD_MS) this.saveNow();
    // Earnings log trim
    while (this.earnLog.length && now - this.earnLog[0].at > 10_000) this.earnLog.shift();
  }

  // -------------------------------------------------------------------------
  // Events → presentation

  private onSimEvent(e: SimEvent): void {
    const r = this.renderer;
    switch (e.type) {
      case "harvest": {
        const from = r.fruitWorldPos(this.g, e.tree, e.fruit);
        r.lemonArc(from.x, from.y, LAYOUT.basket.x, LAYOUT.basket.y - 60, e.golden);
        if (e.by === "helper") this.extras.helperWorking.pip = 0.4;
        this.audio.play("pop");
        if (e.golden || e.diamond) {
          r.sparkle(from.x, from.y, e.diamond ? 12 : 6);
          r.floatText(from.x, from.y - 20, `+${formatNumber(e.bonus)}`, e.diamond ? "#3E9BC8" : C.cocoa, e.diamond ? 28 : 22);
          this.audio.play("sparkle");
          this.hooks.toast(t(e.diamond ? "ui.toast.diamond" : "ui.toast.golden", { n: formatNumber(e.bonus) }), "good");
          if (e.diamond) this.platform.happytime();
        } else if (e.sold && e.bonus > 0) {
          const crate = FACILITY_SPOTS.sell_crate;
          r.floatText(crate.x, crate.y - 150, `+${formatNumber(e.bonus)}`, C.cocoa, 16);
        }
        if (e.bonus > 0) this.logEarn(e.bonus);
        break;
      }
      case "sell": {
        const crate = FACILITY_SPOTS.sell_crate;
        r.floatText(crate.x, crate.y - 170, `+${formatNumber(e.amount)}`, C.cocoa, 28);
        r.sparkle(crate.x, crate.y - 120, 8);
        this.audio.play("coin");
        this.logEarn(e.amount);
        if (e.by === "player") {
          this.hooks.toast(t("ui.sellAll", { c: e.count, n: formatNumber(e.amount) }), "good");
          this.analytics.track("lemons_sold", { count: e.count });
        }
        break;
      }
      case "fountain": {
        const f = FACILITY_SPOTS.fountain;
        r.floatText(f.x, f.y - 200, `+${formatNumber(e.amount)}`, C.cocoa, 18);
        this.logEarn(e.amount);
        break;
      }
      case "basketFull":
        break;
      case "drink":
        this.extras.pressSquash = Math.max(this.extras.pressSquash, 0.6);
        this.audio.play("drink");
        break;
      case "squeeze":
        this.extras.pressSquash = 1;
        this.audio.play("squeeze");
        break;
      case "sale": {
        const p = r.customerWorldPos(this.s, e.uid);
        r.floatText(p.x, p.y - 40, `+${formatNumber(e.amount)}`, e.premium ? C.coral : C.cocoa, e.tip > 0 ? 24 : 20);
        if (e.by === "helper") this.extras.helperWorking.roo = 0.5;
        this.audio.play("coin");
        if (e.done) noteCombo(this.g, e.combo);
        this.logEarn(e.amount);
        if (e.combo >= 10 && e.done) this.platform.happytime();
        break;
      }
      case "leave":
        this.audio.play("soft");
        break;
      case "delivery":
        this.extras.cartTimer = 1;
        r.floatText(1110, GROUND_Y + 20, `+${formatNumber(e.amount)}`, C.cocoa, 18);
        this.logEarn(e.amount);
        break;
      case "sticker":
        this.hooks.toast(t("ui.toast.newCustomer", { ref: nameOf("customer", e.customer) }), "good");
        this.hooks.structureChanged();
        break;
      case "noDrinks":
        this.audio.play("deny");
        break;
      case "arrive":
        break;
    }
  }

  private logEarn(amount: number): void {
    this.earnLog.push({ at: Date.now(), amount });
  }

  /** Measured income over the last 10 seconds (what the player actually earned). */
  incomePerSec(): number {
    const now = Date.now();
    const recent = this.earnLog.filter((e) => now - e.at <= 10_000);
    const measured = recent.reduce((a, e) => a + e.amount, 0) / 10;
    return Math.max(measured, automatedRates(this.g, this.stats, now).coinsPerSec);
  }

  // -------------------------------------------------------------------------
  // Saving

  requestSave(soon = false): void {
    const due = Date.now() + (soon ? 300 : SAVE_DEBOUNCE_MS);
    this.saveDueAt = this.saveDueAt ? Math.min(this.saveDueAt, due) : due;
  }

  saveNow(): void {
    const now = Date.now();
    this.saveDueAt = 0;
    this.lastSave = now;
    this.g.lastActiveAt = now;
    const res = this.saves.save(this.g, now);
    if (res === "ok") this.analytics.track("save_success");
    else if (res === "conflict") {
      if (!this.sessionMarks.has("conflict")) {
        this.sessionMarks.add("conflict");
        this.analytics.track("load_conflict", { resolved: "newer_elsewhere" });
        this.hooks.toast("Your lane continued in another tab. Reload to pick up the newest progress.", "warn");
      }
    } else {
      this.analytics.track("save_failure");
      this.hooks.toast(t("ui.saveFailed"), "warn");
    }
  }

  // -------------------------------------------------------------------------
  // Player actions (UI + input)

  pick(tree?: number): void {
    const ctx = this.ctx();
    const before = this.g.lemons;
    if (tree !== undefined) harvestTree(this.g, ctx, tree);
    else {
      let n = 0;
      while (n < 12 && harvestAny(this.g, ctx, "player")) n++;
    }
    const picked = this.g.lemons - before;
    if (tree !== undefined) this.extras.treeShake[tree] = 1;
    if (picked === 0) {
      if (this.g.lemons >= slotsOf(this.stats.basketCap)) this.renderer.floatText(LAYOUT.basket.x, GROUND_Y - 90, "Basket full!", C.coral, 18);
      this.audio.play("deny");
    }
  }

  squeeze(): void {
    if (!squeeze(this.g, this.ctx())) {
      this.audio.play("deny");
      const recipeLemons = this.g.drinks >= slotsOf(this.stats.counterCap) ? "Counter full!" : "Need lemons";
      this.renderer.floatText(LAYOUT.press.x, GROUND_Y - 170, recipeLemons, C.coral, 16);
    }
  }

  serve(): void {
    if (!serveFront(this.g, this.s, this.ctx(), "player")) {
      if (this.g.drinks > 0) this.audio.play("deny");
      else this.renderer.floatText(LAYOUT.stand.x, GROUND_Y - 150, "No drinks yet", C.coral, 16);
    }
  }

  canPick(): boolean {
    return this.g.trees.some((t) => t.some((f) => f.g >= 1)) && this.g.lemons < slotsOf(this.stats.basketCap);
  }
  canSqueeze(): boolean {
    return pressCanRun(this.g, this.ctx());
  }
  canServe(): boolean {
    return this.g.drinks > 0 && this.s.customers.some((c) => c.phase === "waiting");
  }

  handleCanvasTap(cssX: number, cssY: number): void {
    this.audio.unlock();
    const hit = this.renderer.hitTest(cssX, cssY, this.g);
    if (!hit) return;
    if (hit.kind === "tree") this.pick(hit.index);
    else if (hit.kind === "press") this.squeeze();
    else if (hit.kind === "facility") this.tapFacility(hit.id);
    else this.serve();
  }

  // -------------------------------------------------------------------------
  // Exploring

  zoneId(): ZoneId {
    return ZONES.find((z) => z.index === this.zoneIndex)?.id ?? "home";
  }

  goZone(index: number, snap = false): void {
    const min = Math.min(...ZONES.map((z) => z.index));
    const max = Math.max(...ZONES.map((z) => z.index));
    const next = Math.max(min, Math.min(max, index));
    if (next === this.zoneIndex && !snap) return;
    this.zoneIndex = next;
    this.renderer.setZone(next, snap || this.g.settings.reducedMotion);
    this.audio.play("click");
    this.hooks.zoneChanged(this.zoneId());
    this.analytics.track("zone_visit", { zone: this.zoneId() });
  }

  walk(delta: number): void {
    this.goZone(this.zoneIndex + delta);
  }

  goToZoneOf(id: UpgradeId): void {
    const def = upgradeById.get(id);
    const z = def ? zoneById.get(def.zone) : undefined;
    if (z) this.goZone(z.index);
  }

  /** Tap on a facility in the world: build it, or use it. */
  tapFacility(id: UpgradeId): void {
    const lv = this.g.upgrades[id] ?? 0;
    const spot = FACILITY_SPOTS[id as FacilitySpotId] ?? { x: LAYOUT.stand.x, y: GROUND_Y };
    if (lv > 0 && id !== "grove_plot") {
      if (id === "sell_crate") return void this.sell();
      if (id === "lucky_wheel") return void this.spin();
      this.renderer.floatText(spot.x, spot.y - 200, `${nameOf("upgrade", id)} · ${t("ui.level", { n: lv })}`, C.cocoa, 18);
      return;
    }
    if (upgradeLocked(this.g, id)) {
      this.audio.play("deny");
      this.hooks.toast(t("ui.lockedRegion", { ref: nameOf("region", upgradeById.get(id)!.region) }), "info");
      return;
    }
    const cost = upgradeCost(this.g, id, this.stats);
    if (this.g.coins < cost) {
      this.audio.play("deny");
      this.hooks.toast(t("ui.need", { n: formatNumber(cost - this.g.coins) }), "info");
      return;
    }
    if (this.buyUpgrade(id)) this.hooks.toast(t("ui.toast.built", { ref: nameOf("upgrade", id) }), "good");
  }

  canSell(): boolean {
    return (this.g.upgrades.sell_crate ?? 0) > 0 && this.g.lemons > 0;
  }

  sell(): void {
    if ((this.g.upgrades.sell_crate ?? 0) <= 0) return;
    if (sellLemons(this.g, this.ctx(), "player") <= 0) {
      this.audio.play("deny");
      this.hooks.toast(t("ui.nothingToSell"), "info");
      return;
    }
    this.requestSave();
  }

  rawLemonPrice(): number {
    return rawLemonValue(this.g, this.stats, Date.now());
  }

  spinReadyIn(): number {
    return spinCooldownLeft(this.g, this.stats, Date.now());
  }

  wheelOwned(): boolean {
    return wheelOwned(this.g);
  }

  private spinning = false;

  spin(): void {
    if (this.spinning) return;
    const res = spinWheel(this.g, this.stats, this.rng, Date.now(), this.incomePerSec());
    if (!res) {
      this.audio.play("deny");
      const left = this.spinReadyIn();
      this.hooks.toast(t("ui.spinIn", { t: formatDuration(left) }), "info");
      return;
    }
    this.spinning = true;
    this.analytics.track("wheel_spin", { reward: res.kind });
    this.requestSave(true);
    this.audio.play("whoosh");
    this.renderer.spinWheel(res.segment, this.g.settings.reducedMotion);
    const wheel = FACILITY_SPOTS.lucky_wheel;
    setTimeout(
      () => {
        this.spinning = false;
        const key = `ui.wheel.${res.kind}`;
        this.hooks.toast(t(key, { n: formatNumber(res.amount) }), "good");
        this.renderer.sparkle(wheel.x, wheel.y - 175, 12);
        this.audio.play(res.kind === "bigCoins" ? "unlock" : "sparkle");
        if (res.kind === "coins" || res.kind === "bigCoins") this.logEarn(res.amount);
        this.stats = computeStats(this.g);
        this.hooks.structureChanged();
      },
      this.g.settings.reducedMotion ? 100 : 2700,
    );
  }

  hoverTarget(cssX: number, cssY: number): boolean {
    return this.renderer.hitTest(cssX, cssY, this.g) !== null;
  }

  private afterPurchase(res: ActionResult, event: Parameters<Analytics["track"]>[0], payload: Record<string, string | number>): boolean {
    if (!res.ok) {
      this.audio.play("deny");
      return false;
    }
    this.stats = computeStats(this.g);
    this.analytics.track(event, payload);
    this.requestSave(true);
    this.audio.play("unlock");
    this.hooks.structureChanged();
    return true;
  }

  buyUpgrade(id: UpgradeId): boolean {
    const res = buyUpgrade(this.g, id, this.stats);
    const ok = this.afterPurchase(res, "upgrade_purchase", { id, level: this.g.upgrades[id] ?? 0 });
    if (ok) {
      // A newly built facility is worth seeing: walk over to it.
      if (this.g.upgrades[id] === 1 && (FACILITY_IDS.includes(id) || id === "grove_plot")) this.goToZoneOf(id);
      if (id === "grove_plot") this.goToZoneOf(id);
      this.celebrateStation(id);
    }
    return ok;
  }

  private celebrateStation(id: UpgradeId): void {
    const at: Partial<Record<UpgradeId, { x: number; y: number }>> = {
      lemon_tree: { x: LAYOUT.trees[0].x, y: GROUND_Y - 200 },
      basket: { x: LAYOUT.basket.x, y: GROUND_Y - 60 },
      juice_press: { x: LAYOUT.press.x, y: GROUND_Y - 120 },
      signboard: { x: LAYOUT.stand.x, y: GROUND_Y - 300 },
      stand_counter: { x: LAYOUT.stand.x, y: GROUND_Y - 120 },
    };
    const f = FACILITY_SPOTS[id as FacilitySpotId];
    const p = at[id] ?? (f ? { x: f.x, y: f.y - f.h * 0.6 } : { x: LAYOUT.stand.x, y: GROUND_Y - 120 });
    this.renderer.sparkle(p.x, p.y, 8);
    if (id === "lemon_tree") this.extras.treeShake[0] = 1;
    if (id === "juice_press") this.extras.pressSquash = 1;
  }

  buyHelper(id: HelperId): boolean {
    const first = (this.g.helpers[id] ?? 0) === 0;
    const res = buyHelper(this.g, id, this.stats);
    const ok = this.afterPurchase(res, "helper_unlock", { id, level: this.g.helpers[id] ?? 0 });
    if (ok && first) this.extras.helperWorking[id] = 1;
    return ok;
  }

  unlockRegion(id: RegionId): boolean {
    const res = unlockRegion(this.g, id);
    const ok = this.afterPurchase(res, "region_unlock", { id });
    if (ok) {
      this.hooks.toast(t("ui.toast.region", { ref: nameOf("region", id) }), "good");
      this.renderer.sparkle(640, 300, 12);
      this.audio.play("sparkle");
      this.platform.happytime();
    }
    return ok;
  }

  discoverRecipe(id: RecipeId): boolean {
    const res = discoverRecipe(this.g, id, this.stats);
    const ok = this.afterPurchase(res, "recipe_unlock", { id });
    if (ok) this.hooks.toast(t("ui.toast.recipe", { ref: nameOf("recipe", id) }), "good");
    return ok;
  }

  useRecipe(id: RecipeId): boolean {
    const res = setActiveRecipe(this.g, id);
    if (res.ok) {
      this.stats = computeStats(this.g);
      this.requestSave();
      this.audio.play("click");
      this.hooks.structureChanged();
    }
    return res.ok;
  }

  buyPerk(id: PerkId): boolean {
    return this.afterPurchase(buyPerk(this.g, id), "upgrade_purchase", { id, level: this.g.perks[id] ?? 0, perk: 1 });
  }

  equip(id: CosmeticId): boolean {
    if (!cosmeticUnlocked(this.g, id)) return false;
    equipCosmetic(this.g, id);
    this.requestSave();
    this.audio.play("click");
    this.hooks.structureChanged();
    return true;
  }

  sunrise(): boolean {
    const res = performSunrise(this.g, Date.now());
    if (!res.ok) {
      this.audio.play("deny");
      return false;
    }
    this.s = createSession();
    this.stats = computeStats(this.g);
    this.analytics.track("sunrise_complete", { tokens: res.tokens, sunrises: this.g.sunrises });
    this.saveNow();
    this.audio.play("whoosh");
    this.hooks.sunriseTransition();
    this.hooks.structureChanged();
    this.platform.happytime();
    return true;
  }

  quest(): ActiveQuest {
    return evaluateQuest(this.g);
  }

  claimQuest(): number {
    const n = claimQuest(this.g, this.stats, this.incomePerSec());
    if (n > 0) {
      this.analytics.track("tutorial_step_complete", { index: this.g.quest.index - 1 });
      this.renderer.floatText(640, 200, `+${formatNumber(n)}`, C.cocoa, 26);
      this.audio.play("coin");
      this.requestSave(true);
      this.hooks.structureChanged();
    }
    return n;
  }

  claimDaily(): number {
    const n = claimDaily(this.g, this.stats, this.incomePerSec(), Date.now());
    if (n > 0) {
      this.analytics.track("daily_reward_claim", { amount: Math.floor(n) });
      this.hooks.toast(t("ui.toast.daily", { n: formatNumber(n) }), "good");
      this.audio.play("coin");
      this.requestSave(true);
      this.hooks.structureChanged();
    }
    return n;
  }

  setSetting(key: keyof Settings, value: boolean): void {
    this.g.settings[key] = value;
    this.audio.setSettings(this.g.settings.music, this.g.settings.sfx);
    this.requestSave();
  }

  eraseSave(): void {
    this.saves.wipe();
    this.g = createFreshState(Date.now());
    this.s = createSession();
    this.stats = computeStats(this.g);
    startQuest(this.g, 0);
    this.starsSeen = 0;
    this.saveNow();
    this.hooks.structureChanged();
  }

  // -------------------------------------------------------------------------
  // Ads (player-initiated only; never grant a reward unless the ad finished)

  async showRewardedAd(kind: "rush" | "offline"): Promise<boolean> {
    if (!this.platform.adsAvailable) return false;
    this.analytics.track("ad_offer_shown", { kind });
    this.block(true);
    let started = false;
    const outcome = await this.platform.requestAd("rewarded", () => {
      started = true;
      this.audio.setAdMute(true);
      this.analytics.track("ad_started", { kind });
    });
    this.audio.setAdMute(false);
    this.block(false);
    this.lastFrame = performance.now();
    if (outcome === "finished") {
      this.analytics.track("ad_completed", { kind });
      return true;
    }
    this.analytics.track("ad_failed", { kind, started });
    this.hooks.toast(t("ui.adFailed"), "info");
    return false;
  }

  async requestRush(): Promise<void> {
    if (Date.now() < this.g.boostUntil) return;
    if (await this.showRewardedAd("rush")) {
      this.g.boostUntil = Date.now() + TUNING.burstSeconds * 1000;
      this.audio.play("sparkle");
      this.requestSave(true);
    }
  }

  /** Midgame ad only at a natural break (right after a Sunrise), never mid-action. */
  async naturalBreakAd(): Promise<void> {
    if (!this.platform.adsAvailable) return;
    this.block(true);
    const outcome = await this.platform.requestAd("midgame", () => this.audio.setAdMute(true));
    this.audio.setAdMute(false);
    this.block(false);
    this.lastFrame = performance.now();
    this.analytics.track(outcome === "finished" ? "ad_completed" : "ad_failed", { kind: "midgame" });
  }
}
