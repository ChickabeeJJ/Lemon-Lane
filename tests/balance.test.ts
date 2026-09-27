// Balance simulation: several player profiles run the real economy headlessly.
// Targets come from the bible's "first ten minutes" and pacing guidance.
import { describe, expect, it } from "vitest";
import { runBot } from "./botPlayer";

const fmt = (s?: number) => (s === undefined ? "never" : `${(s / 60).toFixed(1)}m`);

describe("balance", () => {
  it("active player hits the early milestones on time", () => {
    const { log, g } = runBot("active", 20, 7);
    console.info(
      `[active] firstUpgrade ${fmt(log.firstUpgradeAt)} · Pip ${fmt(log.pipAt)} · SunnyLane ${fmt(log.sunnyLaneAt)} · Roo ${fmt(log.rooAt)} · Picnic ${fmt(log.picnicAt)} · Market ${fmt(log.marketAt)} · served ${g.lifetime.customersServed}`,
    );
    expect(log.firstUpgradeAt).toBeLessThan(120);
    expect(log.pipAt).toBeGreaterThan(45);
    expect(log.pipAt).toBeLessThan(5 * 60);
    expect(log.sunnyLaneAt).toBeGreaterThan(3 * 60);
    expect(log.sunnyLaneAt).toBeLessThan(8 * 60);
    expect(log.picnicAt).toBeLessThan(20 * 60);
  });

  it("casual player still progresses", () => {
    const { log } = runBot("casual", 20, 3);
    console.info(`[casual] firstUpgrade ${fmt(log.firstUpgradeAt)} · Pip ${fmt(log.pipAt)} · SunnyLane ${fmt(log.sunnyLaneAt)} · Picnic ${fmt(log.picnicAt)}`);
    expect(log.firstUpgradeAt).toBeLessThan(4 * 60);
    expect(log.sunnyLaneAt).toBeLessThan(15 * 60);
  });

  it("automation-first player reaches Sunrise within a long session", () => {
    const { log, g } = runBot("automation", 150, 11);
    console.info(
      `[automation] Picnic ${fmt(log.picnicAt)} · Market ${fmt(log.marketAt)} · Orchard ${fmt(log.orchardAt)} · sunriseReady ${fmt(log.sunriseReadyAt)} · regions ${g.regions.length}`,
    );
    expect(log.marketAt).toBeDefined();
    expect(log.sunriseReadyAt).toBeDefined();
    expect(log.sunriseReadyAt!).toBeGreaterThan(25 * 60);
  });
});
