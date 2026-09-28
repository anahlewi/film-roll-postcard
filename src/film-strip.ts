import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

import type { Roll } from "./types";
import { buildSrcSet, transform, IMG_SIZES } from "./image";
import { playShutter } from "./audio";
import { edgeBottom, edgeTopDecor } from "./edge-print";

gsap.registerPlugin(Draggable, InertiaPlugin);

const VISIBLE = 4; // frames in the gate at once
const PRELOAD = 2; // extra frames to load either side of the gate
const MUTE_KEY = "roll24:muted";

/**
 * The whole piece: builds the strip, owns selection state, runs the transport,
 * and keeps the ARIA surface in sync. Ported from the single-file prototype;
 * the WAAPI keyframe pull is now a GSAP tween + Draggable throw.
 */
export class FilmStrip {
  private readonly roll: Roll;
  private readonly total: number;
  private readonly lastLeft: number;

  private strip!: HTMLElement;
  private flash!: HTMLElement;
  private status!: HTMLElement;
  private hint!: HTMLElement;
  private muteBtn!: HTMLButtonElement;

  private frameEls: HTMLElement[] = [];
  private numberEls: HTMLButtonElement[] = [];
  private readonly loaded = new Set<number>();

  private selected = 1;
  private step = 0;
  private prevX = 0;
  private muted = false;
  private interacted = false;

  private readonly reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
  private drag?: Draggable;
  private resizeRaf = 0;

  constructor(mount: HTMLElement, roll: Roll) {
    this.roll = roll;
    this.total = roll.frames.length;
    this.lastLeft = Math.max(1, this.total - VISIBLE + 1);
    this.muted = safeGet(MUTE_KEY) === "1";

    this.renderShell(mount);
    this.buildFrames();
    this.wireEvents();
    this.setupMotion();

    this.selected = this.clampSel(this.readHash());
    this.measure();
    this.render();
    this.updateLoading();
    this.snapTo(this.targetX());

    if (document.fonts?.ready) void document.fonts.ready.then(() => this.measure());
  }

  /* ------------------------------------------------------------------ DOM */

  private renderShell(mount: HTMLElement): void {
    mount.innerHTML = `
      <h1 class="sr-only">Roll ${this.roll.number} — ${this.roll.title}: ${this.total} exposures</h1>
      <div class="gate">
        <div class="strip" role="group"
             aria-label="Film strip, frame numbers 1 to ${this.total}"></div>
        <div class="flash" aria-hidden="true"></div>
      </div>
      <p class="hint">Click a frame number, drag the strip, or use the arrow keys</p>
      <button class="mute" type="button" aria-pressed="true" aria-label="Shutter sound">
        <svg class="i-on" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>
          <path d="M18.5 5.5a9 9 0 0 1 0 13"/>
        </svg>
        <svg class="i-off" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6"/><path d="m17 9 6 6"/>
        </svg>
      </button>
      <p class="sr-only" role="status" aria-live="polite"></p>
    `;
    this.strip = mount.querySelector<HTMLElement>(".strip")!;
    this.flash = mount.querySelector<HTMLElement>(".flash")!;
    this.hint = mount.querySelector<HTMLElement>(".hint")!;
    this.muteBtn = mount.querySelector<HTMLButtonElement>(".mute")!;
    this.status = mount.querySelector<HTMLElement>('[role="status"]')!;
    this.syncMuteBtn();
  }

  private buildFrames(): void {
    const frag = document.createDocumentFragment();

    this.roll.frames.forEach((f, i) => {
      const n = i + 1;

      const frame = document.createElement("div");
      frame.className = "frame";

      const top = document.createElement("div");
      top.className = "edge edge-top";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num";
      btn.textContent = f.code || String(n);
      btn.dataset.n = String(n);
      btn.setAttribute("aria-label", `Advance the roll to frame ${n} of ${this.total}`);
      btn.tabIndex = n === 1 ? 0 : -1;
      top.append(btn, ...edgeTopDecor(f));

      const win = document.createElement("div");
      win.className = "win";
      if (f.image) {
        if (f.image.lqip) win.style.backgroundImage = `url("${f.image.lqip}")`;
        const img = document.createElement("img");
        img.alt = f.alt;
        img.decoding = "async";
        img.width = f.image.width;
        img.height = f.image.height;
        img.dataset.src = f.image.url;
        win.appendChild(img);
      } else {
        win.setAttribute("aria-hidden", "true"); // blank prototype window
      }

      frame.append(top, win, edgeBottom(f, this.roll));
      frag.appendChild(frame);
      this.frameEls.push(frame);
      this.numberEls.push(btn);
    });

    this.strip.appendChild(frag);
  }

  /* --------------------------------------------------------------- motion */

  private setupMotion(): void {
    this.drag = Draggable.create(this.strip, {
      type: "x",
      inertia: true,
      dragResistance: 0.06,
      edgeResistance: 0.9,
      bounds: { minX: 0, maxX: 0 }, // real bounds set in measure()
      snap: { x: (value: number) => this.snapValue(value) },
      onPress: () => this.dismissHint(),
      onDrag: () => this.trackBlur(),
      onThrowUpdate: () => this.trackBlur(),
      onDragEnd: () => this.settleFromX(),
      onThrowComplete: () => this.settleFromX(),
    })[0];
  }

  /** click a number / press an arrow — animate the pull and fire the shutter */
  private goTo(target: number, opts: { focus?: boolean } = {}): void {
    const next = this.clampSel(target);
    const changed = next !== this.selected;
    this.selected = next;

    this.dismissHint();
    this.playSound();
    this.render();
    this.updateLoading();
    this.syncHash();

    const x = this.targetX();

    if (this.reduceMQ.matches || this.step === 0) {
      this.snapTo(x);
    } else {
      const tl = gsap.timeline({
        onUpdate: () => this.trackBlur(),
        onComplete: () => this.clearBlur(),
      });
      if (changed) tl.to(this.strip, { x, duration: 0.55, ease: "power2.out" }, 0);
      tl.fromTo(this.flash, { opacity: 0 }, { opacity: 0.16, duration: 0.05, ease: "power1.out" }, 0)
        .to(this.flash, { opacity: 0, duration: 0.14, ease: "power1.in" }, 0.05);
    }

    if (opts.focus) this.numberEls[this.selected - 1]?.focus();
  }

  /** after a drag/throw settles, adopt whatever frame is now leftmost */
  private settleFromX(): void {
    const x = (gsap.getProperty(this.strip, "x") as number) || 0;
    const left = gsap.utils.clamp(1, this.lastLeft, Math.round(-x / this.step) + 1);
    if (this.selected < left || this.selected > left + VISIBLE - 1) this.selected = left;
    this.clearBlur();
    this.render();
    this.updateLoading();
    this.syncHash();
  }

  /** motion blur keyed to per-frame travel distance (≈ velocity) */
  private trackBlur(): void {
    if (this.reduceMQ.matches) return;
    const x = (gsap.getProperty(this.strip, "x") as number) || 0;
    const dv = Math.abs(x - this.prevX);
    this.prevX = x;
    const blur = Math.min(6, dv * 0.4);
    this.strip.style.filter = blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : "";
  }

  private clearBlur(): void {
    this.strip.style.filter = "";
  }

  private snapTo(x: number): void {
    gsap.set(this.strip, { x });
    this.prevX = x;
  }

  private snapValue(value: number): number {
    const min = -(this.total - VISIBLE) * this.step;
    return gsap.utils.clamp(min, 0, Math.round(value / this.step) * this.step);
  }

  /* ----------------------------------------------------------- geometry */

  private measure(): void {
    const first = this.frameEls[0];
    if (!first) return;
    const gap = parseFloat(getComputedStyle(this.strip).gap) || 0;
    this.step = first.getBoundingClientRect().width + gap;
    this.drag?.applyBounds({ minX: -(this.total - VISIBLE) * this.step, maxX: 0 });
    this.snapTo(this.targetX());
  }

  private windowLeft(): number {
    return Math.max(1, Math.min(this.selected, this.lastLeft));
  }

  private targetX(sel: number = this.selected): number {
    return -(Math.max(1, Math.min(sel, this.lastLeft)) - 1) * this.step;
  }

  /* ------------------------------------------------------ images / a11y */

  private updateLoading(): void {
    const left = this.windowLeft();
    const lo = Math.max(1, left - PRELOAD);
    const hi = Math.min(this.total, left + VISIBLE - 1 + PRELOAD);

    for (let n = lo; n <= hi; n++) {
      if (this.loaded.has(n)) continue;
      const el = this.frameEls[n - 1];
      const img = el?.querySelector<HTMLImageElement>("img");
      const base = img?.dataset.src;
      if (!img || !base) continue;

      img.srcset = buildSrcSet(base) ?? "";
      img.sizes = IMG_SIZES;
      img.src = transform(base, 640);
      img.addEventListener("load", () => el.querySelector(".win")?.classList.add("is-loaded"), {
        once: true,
      });
      this.loaded.add(n);
    }
  }

  private render(): void {
    const left = this.windowLeft();
    this.numberEls.forEach((b, i) => {
      const on = i + 1 === this.selected;
      b.setAttribute("aria-current", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });

    const f = this.roll.frames[this.selected - 1];
    const note = f?.caption ?? f?.alt ?? "";
    this.status.textContent =
      `Frame ${this.selected} of ${this.total}. ${note} ` +
      `Showing ${left}–${Math.min(this.total, left + VISIBLE - 1)}.`;
  }

  /* -------------------------------------------------------------- events */

  private wireEvents(): void {
    this.strip.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button.num");
      if (b?.dataset.n) this.goTo(Number(b.dataset.n));
    });

    this.strip.addEventListener("keydown", (e) => {
      const moves: Record<string, number> = {
        ArrowRight: this.selected + 1,
        ArrowDown: this.selected + 1,
        ArrowLeft: this.selected - 1,
        ArrowUp: this.selected - 1,
        Home: 1,
        End: this.total,
      };
      if (e.key in moves) {
        e.preventDefault();
        this.goTo(moves[e.key], { focus: true });
      }
    });

    this.muteBtn.addEventListener("click", () => this.toggleMute());

    addEventListener("hashchange", () => {
      const n = this.clampSel(this.readHash());
      if (n !== this.selected) this.goTo(n);
    });

    addEventListener("resize", () => {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => this.measure());
    });

    this.reduceMQ.addEventListener?.("change", () => this.snapTo(this.targetX()));
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    safeSet(MUTE_KEY, this.muted ? "1" : "0");
    this.syncMuteBtn();
    if (!this.muted) playShutter();
  }

  private syncMuteBtn(): void {
    this.muteBtn.setAttribute("aria-pressed", (!this.muted).toString());
    this.muteBtn.setAttribute(
      "aria-label",
      this.muted ? "Shutter sound: off. Activate to unmute." : "Shutter sound: on. Activate to mute.",
    );
  }

  private playSound(): void {
    if (!this.muted) playShutter();
  }

  private dismissHint(): void {
    if (this.interacted) return;
    this.interacted = true;
    this.hint.classList.add("is-gone");
  }

  /* ---------------------------------------------------------- url state */

  private readHash(): number {
    const m = location.hash.match(/(?:^|[#&])f=(\d+)/);
    return m ? Number(m[1]) : 1;
  }

  private syncHash(): void {
    const h = `#f=${this.selected}`;
    // replaceState keeps the URL shareable without flooding history on every click
    if (location.hash !== h) history.replaceState(history.state, "", h);
  }

  private clampSel(n: number): number {
    return Math.max(1, Math.min(this.total, Math.round(n) || 1));
  }
}

/* localStorage can throw (private mode, disabled) — never let it break boot */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
