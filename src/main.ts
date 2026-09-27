// Boot: platform first (async SDK init), then save load, then game + UI.
import "./ui/styles.css";
import { t } from "./content/strings";
import { Game } from "./game/Game";
import { createPlatform } from "./platform/PlatformAdapter";
import { SaveManager } from "./save/SaveManager";
import { UI } from "./ui/UI";
import { BootScreen } from "./ui/Boot";

async function boot(): Promise<void> {
  const boot = new BootScreen();
  const appEl = document.getElementById("app")!;

  boot.stage(0.1, 0.6, "ui.boot.sdk");
  const platform = await createPlatform();
  platform.loadingStart();

  boot.stage(0.65, 0.75, "ui.boot.save");
  const saves = new SaveManager(platform.storage);
  const loaded = saves.load(Date.now());
  if (loaded.issues.length) console.info("[save] load notes:", loaded.issues);

  boot.stage(0.8, 0.95, "ui.boot.paint");
  const ui = new UI(appEl);
  const game = new Game(platform, saves, loaded.state, loaded.status);
  game.setHooks(ui);
  ui.attach(game);
  game.attachCanvas(ui.canvasElement);

  const stage = ui.stageElement;
  const fit = () => game.resize(stage.clientWidth, stage.clientHeight, ui.worldInsetBottom());
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  const goalEl = document.getElementById("goal");
  if (goalEl) ro.observe(goalEl);

  appEl.hidden = false;
  fit();
  platform.loadingStop();
  await boot.finish();
  await game.start();

  // QA hook: inspect state/analytics from the console. Contains no personal data.
  (window as unknown as { __lemonLane: unknown }).__lemonLane = { game, analytics: game.analytics };
}

boot().catch((e) => {
  console.error("[boot] failed", e);
  const msg = document.querySelector("#boot .boot-msg");
  if (msg) msg.textContent = t("ui.bootFailed");
});
