// Analytics: a local, privacy-safe event log. Payloads carry only aggregate game facts
// (IDs, levels, counts) — never usernames or personal data. There is no remote endpoint
// yet; events are kept in memory for QA (window.__lemonLane.analytics) and dev logs.

export type AnalyticsEvent =
  | "session_start"
  | "gameplay_start"
  | "gameplay_stop"
  | "tutorial_step_complete"
  | "upgrade_purchase"
  | "recipe_unlock"
  | "helper_unlock"
  | "region_unlock"
  | "sunrise_complete"
  | "daily_reward_claim"
  | "ad_offer_shown"
  | "ad_started"
  | "ad_completed"
  | "ad_failed"
  | "save_success"
  | "save_failure"
  | "load_success"
  | "load_conflict"
  | "session_2min"
  | "session_10min"
  | "wheel_spin"
  | "lemons_sold"
  | "zone_visit";

export type Payload = Record<string, string | number | boolean>;

export interface LoggedEvent {
  name: AnalyticsEvent;
  at: number;
  payload: Payload;
}

const MAX_EVENTS = 300;

export class Analytics {
  readonly log: LoggedEvent[] = [];
  private noisy = new Set<AnalyticsEvent>(["save_success"]);

  track(name: AnalyticsEvent, payload: Payload = {}): void {
    this.log.push({ name, at: Date.now(), payload });
    if (this.log.length > MAX_EVENTS) this.log.splice(0, this.log.length - MAX_EVENTS);
    if (import.meta.env?.DEV && !this.noisy.has(name)) console.debug("[analytics]", name, payload);
  }

  count(name: AnalyticsEvent): number {
    return this.log.filter((e) => e.name === name).length;
  }
}
