// UIController: HUD, dock, tabbed panels, modals and toasts.
// Panels are built once per structural change and refreshed in place a few times per second,
// so no DOM nodes are created per frame.
import {
  COSMETICS,
  CUSTOMERS,
  HELPERS,
  PERKS,
  QUESTS,
  RECIPES,
  REGIONS,
  TUNING,
  UPGRADES,
  helperById,
  regionById,
  upgradeById,
} from "../content/content";
import { descOf, nameOf, t } from "../content/strings";
import type { Effect, HelperId, PerkId, RecipeId, RegionId, StatId, UpgradeId } from "../content/types";
import {
  cosmeticUnlocked,
  dailyAvailable,
  dailyReward,
  helperLocked,
  nextRegion,
  recipeLocked,
  regionLocked,
  upgradeLocked,
} from "../core/actions";
import {
  collectionStars,
  computeStats,
  helperCost,
  helperInterval,
  helpersHired,
  perkCost,
  recipeCost,
  slotsOf,
  sunriseTokens,
  upgradeCost,
  type StatBlock,
} from "../core/economy";
import type { Game, GameHooks } from "../game/Game";
import {
  coinIcon,
  customerIcon,
  helperIcon,
  lemonIcon,
  perkIcon,
  recipeIcon,
  regionIcon,
  starIcon,
  tokenIcon,
  upgradeIcon,
} from "../render/icons";
import { formatDuration, formatNumber } from "./format";

type TabId = "upgrades" | "helpers" | "recipes" | "lane" | "sunrise" | "goals" | "style";
const TABS: TabId[] = ["upgrades", "helpers", "recipes", "lane", "sunrise", "goals", "style"];

type Attrs = Record<string, string | number | boolean | undefined>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: (Node | string | null | undefined)[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

function img(src: string, alt = ""): HTMLImageElement {
  const i = el("img", { src, alt, draggable: "false" });
  if (!alt) i.setAttribute("aria-hidden", "true");
  return i;
}

// Stat display for "what changes" previews.
const pct = (v: number) => `${Math.round(v * 100)}%`;
const mult = (v: number) => `×${v.toFixed(2)}`;
const STAT_FMT: Record<StatId, (v: number) => string> = {
  growthSpeed: mult,
  fruitSlots: (v) => String(slotsOf(v)),
  goldenChance: pct,
  basketCap: (v) => String(slotsOf(v)),
  counterCap: (v) => String(slotsOf(v)),
  queueSize: (v) => String(slotsOf(v)),
  pressSpeed: mult,
  drinkValue: mult,
  premiumChance: pct,
  premiumBonus: (v) => `+${pct(v)}`,
  arrivalRate: (v) => ((v * 60) / TUNING.arrivalInterval).toFixed(1),
  comboWindow: (v) => `${v.toFixed(1)}s`,
  tipChance: pct,
  deliveryRate: (v) => v.toFixed(0),
  offlineEfficiency: pct,
  offlineCapHours: (v) => `${v.toFixed(0)}h`,
  helperSlots: (v) => String(slotsOf(v)),
  helperSpeed: mult,
  patience: mult,
  favoriteBonus: (v) => `+${pct(v)}`,
  recipeDiscount: pct,
  tokenGain: mult,
  incomeMult: mult,
  upgradeCostScale: mult,
  rewardMult: mult,
  treeCount: (v) => String(slotsOf(v)),
  starBonus: (v) => `+${(v * 100).toFixed(1)}%`,
};

function statDiff(effects: Effect[], before: StatBlock, after: StatBlock): string {
  const parts: string[] = [];
  const seen = new Set<StatId>();
  for (const e of effects) {
    if (seen.has(e.stat)) continue;
    seen.add(e.stat);
    const f = STAT_FMT[e.stat];
    const a = f(before[e.stat]);
    const b = f(after[e.stat]);
    if (a !== b) parts.push(`${t(`stat.${e.stat}`)} ${a} → ${b}`);
  }
  return parts.join(" · ");
}

interface Refresher {
  (): void;
}

export class UI implements GameHooks {
  private root: HTMLElement;
  private stage!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private panel!: HTMLElement;
  private panelTitle!: HTMLElement;
  private panelBody!: HTMLElement;
  private toasts!: HTMLElement;
  private tabButtons = new Map<TabId, HTMLButtonElement>();
  private tabDots = new Map<TabId, HTMLElement>();
  private openTab: TabId | null = null;
  private refreshers: Refresher[] = [];
  private signature = "";
  private hudCoins!: HTMLElement;
  private hudRate!: HTMLElement;
  private hudTokens!: HTMLElement;
  private hudTokensPill!: HTMLElement;
  private hudStars!: HTMLElement;
  private hudBoost!: HTMLElement;
  private who!: HTMLElement;
  private goal!: HTMLElement;
  private goalText!: HTMLElement;
  private goalHint!: HTMLElement;
  private goalBar!: HTMLElement;
  private goalCount!: HTMLElement;
  private goalClaim!: HTMLButtonElement;
  private actPick!: HTMLButtonElement;
  private actSqueeze!: HTMLButtonElement;
  private actServe!: HTMLButtonElement;
  private actRush!: HTMLButtonElement;
  private modalOpen = 0;
  private lastRefresh = 0;
  private game!: Game;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  attach(game: Game): void {
    this.game = game;
    this.build();
    document.body.classList.toggle("reduced-motion", game.g.settings.reducedMotion);
    const loop = () => {
      const now = performance.now();
      this.refreshFast();
      if (now - this.lastRefresh > 250) {
        this.lastRefresh = now;
        this.refreshSlow();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get canvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  get stageElement(): HTMLElement {
    return this.stage;
  }

  /** Height covered by the bottom goal card in portrait layouts (0 elsewhere). */
  worldInsetBottom(): number {
    const portrait = window.matchMedia("(orientation: portrait), (max-width: 600px)").matches;
    return portrait && !this.goal.hidden ? this.goal.offsetHeight + 16 : 0;
  }

  // -------------------------------------------------------------------------
  // Build

  private build(): void {
    this.root.innerHTML = "";
    this.canvas = el("canvas", { id: "world", "aria-label": "Lemon Lane stand. Tap the tree to pick lemons, the press to squeeze, and customers to serve." });
    this.stage = el("div", { id: "stage" }, [this.canvas]);

    // HUD
    this.hudCoins = el("span", { text: "0" });
    this.hudRate = el("span", { class: "rate" });
    const coinPill = el("div", { class: "pill", title: t("ui.coins") }, [img(coinIcon(), t("ui.coins")), el("span", {}, [this.hudCoins, " ", this.hudRate])]);
    this.hudTokens = el("span", { text: "0" });
    this.hudTokensPill = el("div", { class: "pill", title: t("ui.tokens") }, [img(tokenIcon(), t("ui.tokens")), this.hudTokens]);
    this.hudStars = el("span", { text: "0" });
    const starPill = el("div", { class: "pill", title: t("ui.stars") }, [img(starIcon(), t("ui.stars")), this.hudStars]);
    this.hudBoost = el("div", { class: "pill boost", hidden: true });
    this.who = el("div", { class: "who", hidden: true });
    const settingsBtn = el("button", { class: "icon-btn", "aria-label": t("ui.settings"), title: t("ui.settings"), text: "⚙" });
    settingsBtn.addEventListener("click", () => this.openSettings());
    const hud = el("div", { id: "hud" }, [coinPill, this.hudTokensPill, starPill, this.hudBoost, el("div", { class: "hud-spacer" }), this.who, settingsBtn]);

    // Goal card
    this.goalText = el("div", { class: "goal-text" });
    this.goalClaim = el("button", { class: "btn green small", text: t("ui.claim") });
    this.goalClaim.addEventListener("click", () => this.game.claimQuest());
    this.goalHint = el("div", { class: "goal-hint" });
    this.goalBar = el("i");
    this.goalCount = el("div", { class: "goal-count" });
    this.goal = el("div", { id: "goal", role: "status", "aria-live": "polite" }, [
      el("div", { class: "goal-label", text: t("ui.goal") }),
      el("div", { class: "goal-top" }, [this.goalText, this.goalClaim]),
      el("div", { class: "bar" }, [this.goalBar]),
      this.goalCount,
      this.goalHint,
    ]);

    this.toasts = el("div", { id: "toasts", "aria-live": "polite" });
    this.stage.append(hud, this.goal, this.toasts);

    // Dock: action buttons + tabs
    this.actPick = this.actionButton(lemonIcon(), "Pick", "Space", () => this.game.pick());
    this.actSqueeze = this.actionButton(recipeIcon("classic"), "Squeeze", "S", () => this.game.squeeze());
    this.actServe = this.actionButton(customerIcon("mochi_cat"), "Serve", "E", () => this.game.serve());
    this.actRush = el("button", { class: "btn ad", hidden: !this.game.platform.adsAvailable }, [el("span", { class: "ad-badge", text: t("ui.adBadge") }), t("ui.burstDesc")]);
    this.actRush.addEventListener("click", () => void this.game.requestRush());
    const actions = el("div", { class: "actions" }, [this.actPick, this.actSqueeze, this.actServe, this.actRush]);

    const tabs = el("div", { class: "tabs", role: "tablist" });
    const tabIcons: Record<TabId, string> = {
      upgrades: upgradeIcon("juice_press"),
      helpers: helperIcon("pip"),
      recipes: recipeIcon("mint_sparkle"),
      lane: regionIcon("sunny_lane"),
      sunrise: tokenIcon(),
      goals: starIcon(),
      style: customerIcon("bun_rabbit"),
    };
    TABS.forEach((id, i) => {
      const dot = el("span", { class: "dot", hidden: true });
      const b = el("button", { class: "tab", role: "tab", "aria-selected": "false", title: `${t(`ui.tab.${id}`)} (${i + 1})` }, [img(tabIcons[id]), t(`ui.tab.${id}`), dot]);
      b.addEventListener("click", () => this.toggleTab(id));
      this.tabButtons.set(id, b);
      this.tabDots.set(id, dot);
      tabs.append(b);
    });
    const dock = el("div", { id: "dock" }, [actions, tabs]);

    // Panel
    this.panelTitle = el("h2");
    const close = el("button", { class: "icon-btn", "aria-label": t("ui.close"), text: "✕" });
    close.addEventListener("click", () => this.toggleTab(null));
    this.panelBody = el("div", { class: "panel-body" });
    this.panel = el("section", { id: "panel", hidden: true, "aria-labelledby": "panel-title" }, [el("div", { class: "panel-head" }, [this.panelTitle, close]), this.panelBody]);
    this.panelTitle.id = "panel-title";

    this.root.append(this.stage, this.panel, dock);

    // Input
    this.canvas.addEventListener("pointerdown", (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.game.handleCanvasTap(e.clientX - r.left, e.clientY - r.top);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = this.canvas.getBoundingClientRect();
      this.canvas.classList.toggle("pointer", this.game.hoverTarget(e.clientX - r.left, e.clientY - r.top));
    });
    window.addEventListener("keydown", (e) => this.onKey(e));
    const unlock = () => this.game.audio.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }

  private actionButton(icon: string, text: string, key: string, fn: () => void): HTMLButtonElement {
    const b = el("button", { class: "btn white", "aria-keyshortcuts": key === "Space" ? "Space" : key }, [img(icon), text, el("span", { class: "key", text: key })]);
    b.addEventListener("click", fn);
    return b;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      if (this.modalOpen) return; // modal handles its own Escape
      if (this.openTab) this.toggleTab(null);
      return;
    }
    if (this.modalOpen) return;
    const onButton = document.activeElement instanceof HTMLButtonElement;
    const k = e.key.toLowerCase();
    if (k === " " && !onButton) {
      e.preventDefault();
      this.game.pick();
    } else if (k === "s") this.game.squeeze();
    else if ((k === "e" || (k === "enter" && !onButton))) this.game.serve();
    else if (/^[1-7]$/.test(k)) this.toggleTab(TABS[Number(k) - 1]);
  }

  // -------------------------------------------------------------------------
  // Tabs

  toggleTab(id: TabId | null): void {
    const next = id === this.openTab ? null : id;
    this.openTab = next;
    for (const [tid, b] of this.tabButtons) b.setAttribute("aria-selected", String(tid === next));
    this.panel.hidden = next === null;
    this.root.classList.toggle("panel-open", next !== null);
    if (next) {
      this.panelTitle.textContent = t(`ui.tab.${next}`);
      this.rebuildPanel();
      this.panelBody.scrollTop = 0;
    }
    this.game.audio.play("click");
  }

  structureChanged(): void {
    this.signature = "";
  }

  private structuralSignature(): string {
    const g = this.game.g;
    return [
      this.openTab,
      g.regions.length,
      g.recipes.length,
      g.activeRecipe,
      g.sunrises,
      g.stickers.length,
      g.cosmetic,
      g.quest.index,
      Object.keys(g.helpers).length,
      g.lastDailyDay,
    ].join("|");
  }

  private rebuildPanel(): void {
    if (!this.openTab) return;
    this.signature = this.structuralSignature();
    this.refreshers = [];
    const body = this.panelBody;
    const scroll = body.scrollTop;
    body.innerHTML = "";
    switch (this.openTab) {
      case "upgrades":
        this.buildUpgrades(body);
        break;
      case "helpers":
        this.buildHelpers(body);
        break;
      case "recipes":
        this.buildRecipes(body);
        break;
      case "lane":
        this.buildLane(body);
        break;
      case "sunrise":
        this.buildSunrise(body);
        break;
      case "goals":
        this.buildGoals(body);
        break;
      case "style":
        this.buildStyle(body);
        break;
    }
    body.scrollTop = scroll;
    for (const r of this.refreshers) r();
  }

  /** Standard purchase row. */
  private row(opts: {
    icon: string;
    title: string;
    desc: string;
    locked?: string;
    active?: boolean;
    level?: () => string;
    preview?: () => string;
    status?: () => string;
    button?: { label: () => string; enabled: () => boolean; onClick: () => void; cls?: string };
    extraButton?: HTMLButtonElement;
  }): HTMLElement {
    const lvl = el("span", { class: "lvl" });
    const preview = el("div", { class: "row-preview" });
    const status = el("span", { class: "row-status" });
    const actions = el("div", { class: "row-actions" }, [status]);
    const row = el("div", { class: `row${opts.locked ? " locked" : ""}${opts.active ? " active" : ""}` }, [
      img(opts.icon),
      el("div", { class: "row-title" }, [el("span", { text: opts.title }), opts.level ? lvl : null]),
      el("div", { class: "row-desc", text: opts.locked ?? opts.desc }),
      opts.locked ? null : preview,
      actions,
    ]);
    (row.firstChild as HTMLElement).className = "row-icon";
    if (opts.extraButton) actions.append(opts.extraButton);
    let btn: HTMLButtonElement | null = null;
    if (opts.button && !opts.locked) {
      const b = opts.button;
      btn = el("button", { class: `btn ${b.cls ?? ""}` });
      btn.addEventListener("click", () => {
        b.onClick();
        this.refreshSlow(true);
      });
      actions.append(btn);
    }
    if (opts.locked && !opts.extraButton) actions.hidden = true;
    this.refreshers.push(() => {
      if (opts.level) lvl.textContent = opts.level();
      if (opts.preview && !opts.locked) {
        const p = opts.preview();
        preview.textContent = p;
        preview.hidden = !p;
      }
      if (opts.status) status.textContent = opts.status();
      if (btn && opts.button) {
        const label = opts.button.label();
        if (btn.textContent !== label) btn.textContent = label;
        btn.disabled = !opts.button.enabled();
      }
    });
    return row;
  }

  private costLabel(cost: number, have: number, verb: string): string {
    return have >= cost ? `${verb} · ${formatNumber(cost)}` : t("ui.need", { n: formatNumber(cost - have) });
  }

  private buildUpgrades(body: HTMLElement): void {
    const g = () => this.game.g;
    const locked: RegionId[] = [];
    for (const def of [...UPGRADES].sort((a, b) => a.sort - b.sort)) {
      if (upgradeLocked(g(), def.id)) {
        if (!locked.includes(def.region)) locked.push(def.region);
        continue;
      }
      body.append(
        this.row({
          icon: upgradeIcon(def.id),
          title: nameOf("upgrade", def.id),
          desc: descOf("upgrade", def.id),
          level: () => t("ui.level", { n: g().upgrades[def.id] ?? 0 }),
          preview: () => this.upgradePreview(def.id),
          button: {
            label: () => {
              const lv = g().upgrades[def.id] ?? 0;
              if (lv >= def.maxLevel) return t("ui.max");
              return this.costLabel(upgradeCost(g(), def.id, this.game.stats), g().coins, t("ui.buy"));
            },
            enabled: () => (g().upgrades[def.id] ?? 0) < def.maxLevel && g().coins >= upgradeCost(g(), def.id, this.game.stats),
            onClick: () => this.game.buyUpgrade(def.id),
          },
        }),
      );
    }
    for (const r of locked) {
      const names = UPGRADES.filter((u) => u.region === r).map((u) => nameOf("upgrade", u.id)).join(", ");
      body.append(el("div", { class: "note", text: `${t("ui.lockedRegion", { ref: nameOf("region", r) })}: ${names}` }));
    }
  }

  private upgradePreview(id: UpgradeId): string {
    const g = this.game.g;
    const def = upgradeById.get(id)!;
    const lv = g.upgrades[id] ?? 0;
    if (lv >= def.maxLevel) return "";
    const after = computeStats({ ...g, upgrades: { ...g.upgrades, [id]: lv + 1 } });
    return statDiff(def.effects, this.game.stats, after);
  }

  private buildHelpers(body: HTMLElement): void {
    const g = () => this.game.g;
    const seats = el("div", { class: "note" });
    this.refreshers.push(() => {
      seats.textContent = t("ui.helperSlots", { a: helpersHired(g()), b: slotsOf(this.game.stats.helperSlots) });
    });
    body.append(seats);
    for (const def of [...HELPERS].sort((a, b) => a.sort - b.sort)) {
      const lockedText = helperLocked(g(), def.id) ? t("ui.lockedRegion", { ref: nameOf("region", def.region) }) : undefined;
      body.append(
        this.row({
          icon: helperIcon(def.id),
          title: nameOf("helper", def.id),
          desc: descOf("helper", def.id),
          locked: lockedText ? `${descOf("helper", def.id)} ${lockedText}.` : undefined,
          level: () => ((g().helpers[def.id] ?? 0) > 0 ? t("ui.level", { n: g().helpers[def.id] ?? 0 }) : "—"),
          preview: () => this.helperPreview(def.id),
          status: () => {
            const lv = g().helpers[def.id] ?? 0;
            return lv === 0 && helpersHired(g()) >= slotsOf(this.game.stats.helperSlots) ? t("ui.slotsFull", { n: slotsOf(this.game.stats.helperSlots) }) : "";
          },
          button: {
            label: () => {
              const lv = g().helpers[def.id] ?? 0;
              if (lv >= def.maxLevel) return t("ui.max");
              return this.costLabel(helperCost(g(), def.id, this.game.stats), g().coins, lv === 0 ? t("ui.hire") : t("ui.buy"));
            },
            enabled: () => {
              const lv = g().helpers[def.id] ?? 0;
              if (lv >= def.maxLevel) return false;
              if (lv === 0 && helpersHired(g()) >= slotsOf(this.game.stats.helperSlots)) return false;
              return g().coins >= helperCost(g(), def.id, this.game.stats);
            },
            onClick: () => this.game.buyHelper(def.id),
            cls: "green",
          },
        }),
      );
    }
  }

  private helperPreview(id: HelperId): string {
    const g = this.game.g;
    const def = helperById.get(id)!;
    const lv = g.helpers[id] ?? 0;
    if (lv >= def.maxLevel) return "";
    const next = { ...g, helpers: { ...g.helpers, [id]: lv + 1 } };
    if (def.action !== "none") {
      const key = def.action === "harvest" ? "stat.pickEvery" : "stat.serveEvery";
      const after = helperInterval(next, id, computeStats(next));
      if (lv === 0) return `${t(key)} ${after.toFixed(1)}s`;
      return `${t(key)} ${helperInterval(g, id, this.game.stats).toFixed(1)}s → ${after.toFixed(1)}s`;
    }
    return statDiff(def.effects, this.game.stats, computeStats(next));
  }

  private buildRecipes(body: HTMLElement): void {
    const g = () => this.game.g;
    for (const def of [...RECIPES].sort((a, b) => a.sort - b.sort)) {
      const owned = g().recipes.includes(def.id);
      const locked = recipeLocked(g(), def.id);
      let lockText: string | undefined;
      if (locked) {
        lockText = g().sunrises < def.sunrises ? t("ui.lockedSunrise", { n: def.sunrises }) : t("ui.lockedRegion", { ref: nameOf("region", def.region) });
        if (owned) lockText = `${lockText} (${t("ui.recipeCards")} ✓)`;
      }
      const active = g().activeRecipe === def.id;
      body.append(
        this.row({
          icon: recipeIcon(def.id),
          title: nameOf("recipe", def.id),
          desc: descOf("recipe", def.id),
          locked: lockText ? `${descOf("recipe", def.id)} ${lockText}` : undefined,
          active,
          preview: () => t("ui.recipeStats", { l: def.lemons, t: def.pressTime, v: formatNumber(def.value) }),
          button: owned
            ? {
                label: () => (g().activeRecipe === def.id ? t("ui.inUse") : t("ui.use")),
                enabled: () => g().activeRecipe !== def.id,
                onClick: () => this.game.useRecipe(def.id as RecipeId),
                cls: "white",
              }
            : {
                label: () => this.costLabel(recipeCost(def.id, this.game.stats), g().coins, t("ui.discover")),
                enabled: () => g().coins >= recipeCost(def.id, this.game.stats),
                onClick: () => this.game.discoverRecipe(def.id),
              },
        }),
      );
    }
  }

  private buildLane(body: HTMLElement): void {
    const g = () => this.game.g;
    const next = nextRegion(g());
    for (const def of [...REGIONS].sort((a, b) => a.sort - b.sort)) {
      const owned = g().regions.includes(def.id);
      const isNext = def.id === next;
      let locked: string | undefined;
      if (!owned && !isNext) locked = `${descOf("region", def.id)}`;
      else if (isNext && regionLocked(g(), def.id)) locked = `${descOf("region", def.id)} ${t("ui.lockedSunrise", { n: def.sunrises })}.`;
      const after = computeStats({ ...g(), regions: [...g().regions, def.id] });
      const preview = owned ? "✓" : statDiff(def.effects, this.game.stats, after);
      body.append(
        this.row({
          icon: regionIcon(def.id),
          title: nameOf("region", def.id),
          desc: descOf("region", def.id),
          locked,
          active: owned,
          preview: () => preview,
          button:
            !owned && isNext
              ? {
                  label: () => this.costLabel(def.cost, g().coins, t("ui.open")),
                  enabled: () => g().coins >= def.cost,
                  onClick: () => this.game.unlockRegion(def.id),
                  cls: "green",
                }
              : undefined,
        }),
      );
    }
  }

  private buildSunrise(body: HTMLElement): void {
    const g = () => this.game.g;
    const info = el("div", { class: "note", text: t("ui.sunriseDesc") });
    const status = el("div", { class: "row-preview" });
    const go = el("button", { class: "btn coral" });
    go.addEventListener("click", () => this.confirmSunrise());
    this.refreshers.push(() => {
      const tokens = sunriseTokens(g(), this.game.stats);
      go.disabled = tokens <= 0;
      go.textContent = tokens > 0 ? t("ui.sunriseReady", { n: tokens }) : t("ui.sunriseGo");
      status.textContent =
        tokens > 0 ? `${t("ui.stats", { n: g().sunrises + 1 })} · ${formatNumber(g().runCoins)} coins` : t("ui.sunriseNotYet", { n: formatNumber(TUNING.sunriseMinCoins) }) + ` (${formatNumber(g().runCoins)} / ${formatNumber(TUNING.sunriseMinCoins)})`;
    });
    body.append(info, status, go, el("h3", { class: "section-title", text: t("ui.perks") }));
    for (const def of [...PERKS].sort((a, b) => a.sort - b.sort)) {
      body.append(
        this.row({
          icon: perkIcon(def.id),
          title: nameOf("perk", def.id),
          desc: descOf("perk", def.id),
          level: () => t("ui.level", { n: g().perks[def.id] ?? 0 }),
          preview: () => this.perkPreview(def.id),
          button: {
            label: () => ((g().perks[def.id] ?? 0) >= def.maxLevel ? t("ui.max") : t("ui.perkCost", { n: perkCost(g(), def.id) })),
            enabled: () => (g().perks[def.id] ?? 0) < def.maxLevel && g().sunnyTokens >= perkCost(g(), def.id),
            onClick: () => this.game.buyPerk(def.id),
          },
        }),
      );
    }
  }

  private perkPreview(id: PerkId): string {
    const g = this.game.g;
    const def = PERKS.find((p) => p.id === id)!;
    const lv = g.perks[id] ?? 0;
    if (lv >= def.maxLevel) return "";
    return statDiff(def.effects, this.game.stats, computeStats({ ...g, perks: { ...g.perks, [id]: lv + 1 } }));
  }

  private buildGoals(body: HTMLElement): void {
    const g = () => this.game.g;
    // Current goal (mirrors the card)
    const text = el("div", { class: "row-desc" });
    const bar = el("i");
    const claim = el("button", { class: "btn green", text: t("ui.claim") });
    claim.addEventListener("click", () => this.game.claimQuest());
    this.refreshers.push(() => {
      const q = this.game.quest();
      text.textContent = `${this.questText(q.kind, q.target, q.ref)} — ${formatNumber(q.progress)} / ${formatNumber(q.target)} · +${formatNumber(q.reward * this.game.stats.rewardMult)}`;
      bar.style.width = `${(100 * q.progress) / q.target}%`;
      claim.disabled = !q.done;
    });
    body.append(el("div", { class: "row" }, [img(starIcon()), el("div", { class: "row-title", text: t("ui.goal") }), text, el("div", { class: "bar" }, [bar]), el("div", { class: "row-actions" }, [claim])]));
    (body.lastElementChild!.firstChild as HTMLElement).className = "row-icon";

    // Daily basket
    const dailyText = el("div", { class: "row-desc" });
    const dailyBtn = el("button", { class: "btn" });
    dailyBtn.addEventListener("click", () => this.game.claimDaily());
    this.refreshers.push(() => {
      const avail = dailyAvailable(g(), Date.now());
      dailyBtn.disabled = !avail;
      const amount = dailyReward(this.game.incomePerSec(), this.game.stats);
      dailyBtn.textContent = avail ? `${t("ui.claim")} · ${formatNumber(amount)}` : "✓";
      dailyText.textContent = avail ? t("ui.dailyDesc") : t("ui.dailyClaimed");
    });
    body.append(el("div", { class: "row" }, [img(upgradeIcon("basket")), el("div", { class: "row-title", text: t("ui.daily") }), dailyText, el("div", { class: "row-actions" }, [dailyBtn])]));
    (body.lastElementChild!.firstChild as HTMLElement).className = "row-icon";

    const lifetime = g().lifetime;
    body.append(
      el("div", {
        class: "note",
        text: `Lifetime: ${formatNumber(lifetime.lemonsHarvested)} lemons picked · ${formatNumber(lifetime.customersServed)} customers served · ${formatNumber(lifetime.coinsEarned)} coins · best combo ×${lifetime.bestCombo}`,
      }),
    );
  }

  questText(kind: string, target: number, ref?: string): string {
    let refName = "";
    if (ref) {
      const fam = upgradeById.has(ref as UpgradeId) ? "upgrade" : helperById.has(ref as HelperId) ? "helper" : regionById.has(ref as RegionId) ? "region" : "recipe";
      refName = nameOf(fam, ref);
    }
    return t(`quest.${kind}`, { n: formatNumber(target), ref: refName });
  }

  private buildStyle(body: HTMLElement): void {
    const g = this.game.g;
    const stars = collectionStars(g);
    body.append(el("div", { class: "note", text: `${t("ui.stars")}: ${stars} / ${CUSTOMERS.length + RECIPES.length + REGIONS.length}` }));

    body.append(el("h3", { class: "section-title", text: t("ui.awnings") }));
    const aw = el("div", { class: "grid" });
    for (const c of [...COSMETICS].sort((a, b) => a.sort - b.sort)) {
      const unlocked = cosmeticUnlocked(g, c.id);
      const worn = g.cosmetic === c.id;
      const swatch = el("div", { class: "awning" });
      swatch.style.background = `repeating-linear-gradient(90deg, ${c.stripes[0]} 0 12px, ${c.stripes[1]} 12px 24px)`;
      const btn = el("button", { class: "btn small white", text: worn ? t("ui.equipped") : unlocked ? t("ui.equip") : t("ui.lockedStars", { n: c.stars }) });
      btn.disabled = worn || !unlocked;
      btn.addEventListener("click", () => this.game.equip(c.id));
      aw.append(el("div", { class: `card${unlocked ? "" : " missing"}` }, [swatch, nameOf("cosmetic", c.id), btn]));
    }
    body.append(aw);

    body.append(el("h3", { class: "section-title", text: t("ui.stickers") }));
    const st = el("div", { class: "grid" });
    for (const c of CUSTOMERS) {
      const have = g.stickers.includes(c.id);
      st.append(el("div", { class: `card${have ? "" : " missing"}`, title: have ? descOf("customer", c.id) : "?" }, [img(customerIcon(c.id), have ? nameOf("customer", c.id) : "?"), have ? nameOf("customer", c.id) : "?"]));
    }
    body.append(st);

    body.append(el("h3", { class: "section-title", text: t("ui.recipeCards") }));
    const rc = el("div", { class: "grid" });
    for (const r of RECIPES) {
      const have = g.recipes.includes(r.id);
      rc.append(el("div", { class: `card${have ? "" : " missing"}` }, [img(recipeIcon(r.id), have ? nameOf("recipe", r.id) : "?"), have ? nameOf("recipe", r.id) : "?"]));
    }
    body.append(rc);

    body.append(el("h3", { class: "section-title", text: t("ui.laneSpots") }));
    const ls = el("div", { class: "grid" });
    for (const r of REGIONS) {
      const have = g.regions.includes(r.id);
      ls.append(el("div", { class: `card${have ? "" : " missing"}` }, [img(regionIcon(r.id)), have ? nameOf("region", r.id) : "?"]));
    }
    body.append(ls);
  }

  // -------------------------------------------------------------------------
  // Refresh

  private refreshFast(): void {
    const g = this.game.g;
    const fmt = formatNumber(g.coins);
    if (this.hudCoins.textContent !== fmt) this.hudCoins.textContent = fmt;
    this.actPick.disabled = !this.game.canPick();
    this.actSqueeze.disabled = !this.game.canSqueeze();
    this.actServe.disabled = !this.game.canServe();
  }

  private refreshSlow(force = false): void {
    const g = this.game.g;
    this.hudRate.textContent = `+${formatNumber(this.game.incomePerSec())}${t("ui.perSec")}`;
    this.hudTokensPill.hidden = g.sunnyTokens <= 0 && g.sunrises === 0;
    this.hudTokens.textContent = formatNumber(g.sunnyTokens);
    this.hudStars.textContent = String(collectionStars(g));
    const boostLeft = Math.ceil((g.boostUntil - Date.now()) / 1000);
    this.hudBoost.hidden = boostLeft <= 0;
    if (boostLeft > 0) this.hudBoost.textContent = t("ui.burstActive", { t: boostLeft });
    this.actRush.hidden = !this.game.platform.adsAvailable;
    this.actRush.disabled = boostLeft > 0;
    if (this.game.user) {
      this.who.hidden = false;
      this.who.textContent = t("ui.player", { n: this.game.user.username });
    }

    // Goal card
    const q = this.game.quest();
    this.goalText.textContent = this.questText(q.kind, q.target, q.ref);
    this.goalBar.style.width = `${Math.min(100, (100 * q.progress) / q.target)}%`;
    this.goalCount.textContent = q.done ? t("ui.goalDone") : `${formatNumber(q.progress)} / ${formatNumber(q.target)} · +${formatNumber(q.reward * this.game.stats.rewardMult)}`;
    this.goalClaim.hidden = !q.done;
    this.goal.classList.toggle("done", q.done);
    const hintKey = `hint.${q.id}`;
    const hint = g.quest.index < QUESTS.length ? t(hintKey) : "";
    this.goalHint.textContent = hint !== hintKey ? hint : "";
    this.goalHint.hidden = !this.goalHint.textContent;

    // Tab dots: something affordable / claimable
    this.setDot("goals", q.done || dailyAvailable(g, Date.now()));
    this.setDot("sunrise", sunriseTokens(g, this.game.stats) > 0 || PERKS.some((p) => (g.perks[p.id] ?? 0) < p.maxLevel && g.sunnyTokens >= perkCost(g, p.id)));
    this.setDot("lane", (() => {
      const nr = nextRegion(g);
      return !!nr && !regionLocked(g, nr) && g.coins >= regionById.get(nr)!.cost;
    })());
    this.setDot("upgrades", UPGRADES.some((u) => !upgradeLocked(g, u.id) && (g.upgrades[u.id] ?? 0) < u.maxLevel && g.coins >= upgradeCost(g, u.id, this.game.stats)));
    this.setDot("helpers", HELPERS.some((h) => {
      const lv = g.helpers[h.id] ?? 0;
      if (helperLocked(g, h.id) || lv >= h.maxLevel) return false;
      if (lv === 0 && helpersHired(g) >= slotsOf(this.game.stats.helperSlots)) return false;
      return g.coins >= helperCost(g, h.id, this.game.stats);
    }));
    this.setDot("recipes", RECIPES.some((r) => !g.recipes.includes(r.id) && !recipeLocked(g, r.id) && g.coins >= recipeCost(r.id, this.game.stats)));

    if (this.openTab) {
      if (force || this.structuralSignature() !== this.signature) {
        if (this.structuralSignature() !== this.signature) this.rebuildPanel();
      }
      for (const r of this.refreshers) r();
    }
  }

  private setDot(tab: TabId, on: boolean): void {
    const d = this.tabDots.get(tab)!;
    d.hidden = !on;
    d.textContent = "!";
  }

  // -------------------------------------------------------------------------
  // Toasts & modals

  toast(text: string, kind: "info" | "good" | "warn" = "info"): void {
    if (!this.toasts) return;
    const node = el("div", { class: `toast ${kind}`, text });
    this.toasts.append(node);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => node.classList.add("out"), 2600);
    setTimeout(() => node.remove(), 3000);
  }

  private modal(title: string, content: (Node | string)[], buttons: { label: (Node | string)[] | string; cls?: string; onClick: () => void | Promise<void> }[], dismissible = true): () => void {
    this.modalOpen++;
    this.game.block(true);
    const prevFocus = document.activeElement as HTMLElement | null;
    const back = el("div", { class: "modal-back" });
    const box = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title }, [el("h2", { text: title }), ...content]);
    const actions = el("div", { class: "modal-actions" });
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      back.remove();
      window.removeEventListener("keydown", onKey, true);
      this.modalOpen--;
      this.game.block(false);
      prevFocus?.focus?.();
    };
    for (const b of buttons) {
      const btn = el("button", { class: `btn ${b.cls ?? ""}` }, typeof b.label === "string" ? [b.label] : b.label);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        await b.onClick();
        close();
      });
      actions.append(btn);
    }
    box.append(actions);
    back.append(box);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    if (dismissible) back.addEventListener("pointerdown", (e) => e.target === back && close());
    document.body.append(back);
    (actions.querySelector("button") as HTMLButtonElement | null)?.focus();
    return close;
  }

  offlineSummary(seconds: number, coins: number, onCollect: (doubled: boolean) => void): void {
    const content: (Node | string)[] = [el("p", { text: t("ui.awayFor", { t: formatDuration(seconds) }) })];
    if (coins > 0) {
      content.push(el("p", { text: t("ui.awayEarned") }));
      content.push(el("p", { class: "big" }, [img(coinIcon()), ` ${formatNumber(coins)}`]));
      (content[content.length - 1] as HTMLElement).querySelector("img")!.style.cssText = "width:34px;height:34px;vertical-align:middle";
    } else {
      content.push(el("p", { text: t("ui.awayNothing") }));
    }
    const buttons: { label: (Node | string)[] | string; cls?: string; onClick: () => void | Promise<void> }[] = [
      { label: t("ui.collect"), cls: "green", onClick: () => onCollect(false) },
    ];
    if (coins > 0 && this.game.platform.adsAvailable) {
      buttons.push({
        label: [el("span", { class: "ad-badge", text: t("ui.adBadge") }), t("ui.collectDouble")],
        cls: "ad",
        onClick: async () => {
          const ok = await this.game.showRewardedAd("offline");
          onCollect(ok);
        },
      });
    }
    this.modal(t("ui.welcomeBack"), content, buttons, false);
  }

  private confirmSunrise(): void {
    const tokens = sunriseTokens(this.game.g, this.game.stats);
    if (tokens <= 0) return;
    this.modal(t("ui.sunriseTitle"), [el("p", { text: t("ui.sunriseConfirm", { n: tokens }) }), el("p", { text: t("ui.sunriseDesc") })], [
      { label: t("ui.cancel"), cls: "white", onClick: () => {} },
      { label: t("ui.sunriseGo"), cls: "coral", onClick: () => void this.game.sunrise() },
    ]);
  }

  sunriseTransition(): void {
    const fx = el("div", { id: "sunrise-fx" });
    document.body.append(fx);
    setTimeout(() => {
      fx.remove();
      void this.game.naturalBreakAd();
    }, 2300);
  }

  private openSettings(): void {
    const g = this.game.g;
    const toggle = (key: "music" | "sfx" | "reducedMotion", label: string) => {
      const b = el("button", { class: "btn small toggle", "aria-pressed": String(g.settings[key]), text: g.settings[key] ? t("ui.on") : t("ui.off") });
      b.addEventListener("click", () => {
        const v = !g.settings[key];
        this.game.setSetting(key, v);
        b.setAttribute("aria-pressed", String(v));
        b.textContent = v ? t("ui.on") : t("ui.off");
        if (key === "reducedMotion") document.body.classList.toggle("reduced-motion", v);
      });
      return el("div", { class: "setting" }, [el("span", { text: label }), b]);
    };
    const erase = el("button", { class: "btn small white", text: t("ui.reset") });
    let closeSettings: () => void = () => {};
    erase.addEventListener("click", () => {
      closeSettings();
      this.modal(t("ui.reset"), [el("p", { text: t("ui.resetConfirm") })], [
        { label: t("ui.cancel"), cls: "white", onClick: () => {} },
        { label: t("ui.resetYes"), cls: "coral", onClick: () => this.game.eraseSave() },
      ]);
    });
    const account = this.game.user ? t("ui.player", { n: this.game.user.username }) : t("ui.guest");
    closeSettings = this.modal(
      t("ui.settings"),
      [
        toggle("music", t("ui.music")),
        toggle("sfx", t("ui.sfx")),
        toggle("reducedMotion", t("ui.reducedMotion")),
        el("div", { class: "setting" }, [el("span", { text: account }), erase]),
        el("p", { class: "keys", text: t("ui.keys") }),
      ],
      [{ label: t("ui.close"), cls: "green", onClick: () => {} }],
    );
  }
}
