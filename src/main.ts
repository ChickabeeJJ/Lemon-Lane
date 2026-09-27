// Boot: platform first (async SDK init), then save load, then game + UI.
import "./ui/styles.css";
import { t } from "./content/strings";
import { Game } from "./game/Game";
import { createPlatform } from "./platform/PlatformAdapter";
import { SaveManager } from "./save/SaveManager";
import { UI } from "./ui/UI";

async function boot(): Promise<void> {
  const bootEl = document.getElementById("boot")!;
  const appEl = document.getElementById("app")!;
  const msg = bootEl.querySelector(".boot-msg");
  if (msg) msg.textContent = t("ui.loading");

  const platform = await createPlatform();
  platform.loadingStart();

  const saves = new SaveManager(platform.storage);
  const loaded = saves.load(Date.now());
  if (loaded.issues.length) console.info("[save] load notes:", loaded.issues);

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
  bootEl.remove();
  fit();
  platform.loadingStop();
  await game.start();

  // QA hook: inspect state/analytics from the console. Contains no personal data.
  (window as unknown as { __lemonLane: unknown }).__lemonLane = { game, analytics: game.analytics };
}

boot().catch((e) => {
  console.error("[boot] failed", e);
  const msg = document.querySelector("#boot .boot-msg");
  if (msg) msg.textContent = "Something went wrong while loading. Please refresh the page.";
});
