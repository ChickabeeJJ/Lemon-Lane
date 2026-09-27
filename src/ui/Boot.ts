// Loading screen controller: staged progress, rotating tips and an animated mascot
// drawn with the same art code as the game.
import { recipeById } from "../content/content";
import { t } from "../content/strings";
import { drawCat, drawDrink, drawLemon, ellipse, fillStroke, rrPath, star } from "../render/draw";
import { C } from "../render/palette";

const TIP_COUNT = 6;

export class BootScreen {
  private root = document.getElementById("boot");
  private fill = this.root?.querySelector<HTMLElement>(".boot-bar > i") ?? null;
  private slice = this.root?.querySelector<HTMLElement>(".boot-slice") ?? null;
  private bar = this.root?.querySelector<HTMLElement>(".boot-bar") ?? null;
  private msg = this.root?.querySelector<HTMLElement>(".boot-msg") ?? null;
  private tip = this.root?.querySelector<HTMLElement>(".boot-tip") ?? null;
  private canvas = this.root?.querySelector<HTMLCanvasElement>(".boot-mascot") ?? null;
  private shown = 0.04;
  private target = 0.04;
  /** Progress creeps toward (but never past) this while a stage is in flight. */
  private ceiling = 0.04;
  private raf = 0;
  private tipTimer = 0;
  private start = performance.now();
  private reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  constructor() {
    let i = Math.floor(Math.random() * TIP_COUNT);
    const showTip = () => {
      if (!this.tip) return;
      this.tip.style.opacity = "0";
      setTimeout(() => {
        if (this.tip) {
          this.tip.textContent = t(`ui.tip.${(i % TIP_COUNT) + 1}`);
          this.tip.style.opacity = "1";
        }
        i++;
      }, 250);
    };
    showTip();
    this.tipTimer = window.setInterval(showTip, 2800);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Mark a loading stage: `done` is reached immediately, `upTo` bounds the creep until the next stage. */
  stage(done: number, upTo: number, messageKey: string): void {
    this.target = Math.max(this.target, done);
    this.ceiling = Math.max(this.ceiling, upTo);
    if (this.msg) this.msg.textContent = t(messageKey);
  }

  async finish(): Promise<void> {
    this.stage(1, 1, "ui.boot.ready");
    // Let the bar visibly fill and the mascot wave for a moment.
    const minVisible = this.reduced ? 0 : 900;
    const wait = Math.max(250, minVisible - (performance.now() - this.start));
    await new Promise((r) => setTimeout(r, wait));
    this.root?.classList.add("done");
    await new Promise((r) => setTimeout(r, this.reduced ? 0 : 500));
    cancelAnimationFrame(this.raf);
    clearInterval(this.tipTimer);
    this.root?.remove();
  }

  fail(message: string): void {
    if (this.msg) this.msg.textContent = message;
  }

  private loop = (now: number): void => {
    // Ease toward the target; creep slowly toward the stage ceiling so waiting never looks frozen.
    if (this.target < this.ceiling) this.target = Math.min(this.ceiling, this.target + 0.0015);
    this.shown += (this.target - this.shown) * 0.08;
    const pct = Math.max(4, Math.min(100, this.shown * 100));
    if (this.fill) this.fill.style.width = `${pct}%`;
    if (this.slice) this.slice.style.left = `${pct}%`;
    this.bar?.setAttribute("aria-valuenow", String(Math.round(pct)));
    this.drawMascot((now - this.start) / 1000);
    this.raf = requestAnimationFrame(this.loop);
  };

  private drawMascot(time: number): void {
    const cv = this.canvas;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const motion = !this.reduced;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(2, 0, 0, 2, 0, 0); // canvas is 600×420 → 300×210 logical
    // Little stand counter
    rrPath(ctx, 40, 170, 220, 30, 10);
    fillStroke(ctx, C.wood, 3);
    // Lemons + drinks on the counter
    drawDrink(ctx, 205, 172, recipeById.get("classic")!, 1.4);
    drawDrink(ctx, 238, 172, recipeById.get("mint_sparkle")!, 1.2);
    const bounce = motion ? Math.abs(Math.sin(time * 3)) * 6 : 0;
    drawLemon(ctx, 64, 160 - bounce, 11, C.lemon, -0.3);
    drawLemon(ctx, 90, 162 - (motion ? Math.abs(Math.sin(time * 3 + 1)) * 6 : 0), 11, C.gold, 0.4);
    // The mascot cat, waving
    drawCat(ctx, 148, 172, "delighted", time, false, motion, 1.55, 0);
    // Sparkles
    for (let i = 0; i < 3; i++) {
      const tw = motion ? 0.5 + 0.5 * Math.sin(time * 4 + i * 2) : 1;
      ctx.fillStyle = `rgba(255,253,247,${0.5 + 0.5 * tw})`;
      star(ctx, [40, 262, 230][i], [60, 70, 20][i], 5 + 4 * tw, 4, 0.35);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(90,70,56,0.12)";
    ellipse(ctx, 150, 205, 110, 5);
    ctx.fill();
  }
}
