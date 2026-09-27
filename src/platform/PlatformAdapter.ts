// PlatformAdapter: the only module that talks to the CrazyGames SDK.
// SDK methods used here (HTML5 SDK v3): SDK.init, SDK.environment, SDK.game.{loadingStart,
// loadingStop, gameplayStart, gameplayStop, happytime, settings, addSettingsChangeListener},
// SDK.ad.requestAd, SDK.data.{getItem,setItem,removeItem}, SDK.user.getUser.
// Re-check them against the official docs before every submission.
import type { KeyValueStore } from "../save/SaveManager";

export type AdType = "rewarded" | "midgame";
export type AdOutcome = "finished" | "error";

export interface PlatformUser {
  username: string;
}

export interface PlatformAdapter {
  readonly name: "crazygames" | "local";
  readonly storage: KeyValueStore;
  /** True only when real platform ads can be requested. */
  readonly adsAvailable: boolean;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  requestAd(type: AdType, onStarted: () => void): Promise<AdOutcome>;
  getUser(): Promise<PlatformUser | null>;
  platformMuted(): boolean;
  onSettingsChange(cb: () => void): void;
}

// ---------------------------------------------------------------------------

interface CrazySdk {
  init(): Promise<void>;
  environment?: string;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(cb: () => void): void;
  };
  ad: {
    requestAd(type: AdType, callbacks: { adStarted(): void; adFinished(): void; adError(error: unknown): void }): void;
  };
  data?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  user?: { getUser(): Promise<{ username: string } | null> };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazySdk };
  }
}

const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
const SDK_LOAD_TIMEOUT_MS = 6000;
const AD_TIMEOUT_MS = 120_000;

/** localStorage with an in-memory fallback (private mode, blocked storage). */
export class LocalStore implements KeyValueStore {
  private memory = new Map<string, string>();
  private ls: Storage | null;
  constructor() {
    let ls: Storage | null = null;
    try {
      ls = window.localStorage;
      ls.setItem("lemonlane_probe", "1");
      ls.removeItem("lemonlane_probe");
    } catch {
      ls = null;
    }
    this.ls = ls;
  }
  getItem(key: string): string | null {
    if (this.ls) return this.ls.getItem(key);
    return this.memory.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.ls) this.ls.setItem(key, value);
    else this.memory.set(key, value);
  }
  removeItem(key: string): void {
    if (this.ls) this.ls.removeItem(key);
    else this.memory.delete(key);
  }
}

/** Used outside CrazyGames (local dev, other hosts). No ads, no accounts: nothing is faked. */
export class LocalAdapter implements PlatformAdapter {
  readonly name = "local" as const;
  readonly storage = new LocalStore();
  readonly adsAvailable = false;
  loadingStart(): void {}
  loadingStop(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  happytime(): void {}
  async requestAd(): Promise<AdOutcome> {
    return "error";
  }
  async getUser(): Promise<PlatformUser | null> {
    return null;
  }
  platformMuted(): boolean {
    return false;
  }
  onSettingsChange(): void {}
}

class CrazyGamesAdapter implements PlatformAdapter {
  readonly name = "crazygames" as const;
  readonly storage: KeyValueStore;
  readonly adsAvailable = true;
  private inGameplay = false;
  private adInFlight = false;

  constructor(private sdk: CrazySdk) {
    const data = sdk.data;
    let usable = false;
    if (data) {
      try {
        data.getItem("lemonlane_probe");
        usable = true;
      } catch {
        usable = false;
      }
    }
    this.storage = usable && data ? data : new LocalStore();
  }

  private call(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.warn("[platform] SDK call failed", e);
    }
  }

  loadingStart(): void {
    this.call(() => this.sdk.game.loadingStart());
  }
  loadingStop(): void {
    this.call(() => this.sdk.game.loadingStop());
  }
  gameplayStart(): void {
    if (this.inGameplay) return;
    this.inGameplay = true;
    this.call(() => this.sdk.game.gameplayStart());
  }
  gameplayStop(): void {
    if (!this.inGameplay) return;
    this.inGameplay = false;
    this.call(() => this.sdk.game.gameplayStop());
  }
  happytime(): void {
    this.call(() => this.sdk.game.happytime());
  }

  requestAd(type: AdType, onStarted: () => void): Promise<AdOutcome> {
    if (this.adInFlight) return Promise.resolve("error");
    this.adInFlight = true;
    return new Promise<AdOutcome>((resolve) => {
      let settled = false;
      const finish = (o: AdOutcome) => {
        if (settled) return;
        settled = true;
        this.adInFlight = false;
        clearTimeout(timer);
        resolve(o);
      };
      const timer = setTimeout(() => finish("error"), AD_TIMEOUT_MS);
      try {
        this.sdk.ad.requestAd(type, {
          adStarted: () => onStarted(),
          adFinished: () => finish("finished"),
          adError: (err) => {
            console.info("[platform] ad error", err);
            finish("error");
          },
        });
      } catch (e) {
        console.warn("[platform] requestAd threw", e);
        finish("error");
      }
    });
  }

  async getUser(): Promise<PlatformUser | null> {
    try {
      const u = await this.sdk.user?.getUser();
      return u && typeof u.username === "string" ? { username: u.username } : null;
    } catch {
      return null;
    }
  }

  platformMuted(): boolean {
    return !!this.sdk.game.settings?.muteAudio;
  }

  onSettingsChange(cb: () => void): void {
    this.call(() => this.sdk.game.addSettingsChangeListener?.(cb));
  }
}

function loadScript(src: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement("script");
    const timer = setTimeout(() => resolve(false), timeoutMs);
    el.src = src;
    el.async = true;
    el.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    el.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(el);
  });
}

/**
 * Initialize the platform before gameplay. Falls back to LocalAdapter if the SDK cannot be
 * loaded or reports a disabled environment, so the game always boots.
 */
export async function createPlatform(): Promise<PlatformAdapter> {
  const params = new URLSearchParams(location.search);
  if (params.has("nosdk")) return new LocalAdapter();
  const loaded = window.CrazyGames?.SDK ? true : await loadScript(SDK_URL, SDK_LOAD_TIMEOUT_MS);
  const sdk = window.CrazyGames?.SDK;
  if (!loaded || !sdk) return new LocalAdapter();
  try {
    await sdk.init();
  } catch (e) {
    console.warn("[platform] SDK init failed; continuing locally", e);
    return new LocalAdapter();
  }
  if (sdk.environment === "disabled") return new LocalAdapter();
  return new CrazyGamesAdapter(sdk);
}
