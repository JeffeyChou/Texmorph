import { parseEasing, type MorphMap } from '@texmorph/core';
import { createMorphWith, type FormulaRenderer, type MathMorph, type MathMorphOptions } from '@texmorph/dom';

export interface DefineOptions {
  renderer: FormulaRenderer;
  tagName?: string;
  /** Deadline for preparing a morph, in milliseconds. */
  prepareTimeoutMs?: number;
  /** Render into a shadow root that adopts these styles. Without styles the element uses light DOM. */
  styles?: CSSStyleSheet | string;
}

export interface TexMorphElement extends HTMLElement {
  progress: number;
  morphMap: MorphMap | undefined;
  readonly morph: MathMorph | null;
  readonly ready: Promise<MathMorph>;
  seek(t: number): void;
  play(): void;
  pause(): void;
}

const OBSERVED = ['from', 'to', 'progress', 'duration', 'easing', 'display'] as const;

/** One prepare attempt: cancelled by its deadline, by a newer attempt, or by disconnect. */
function attempt(ms: number): { signal: AbortSignal; abort: (reason: unknown) => void; done: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new DOMException('prepare timed out', 'TimeoutError')), ms);
  return {
    signal: controller.signal,
    abort: (reason) => controller.abort(reason),
    done: () => clearTimeout(id),
  };
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function defineTexMorph(options: DefineOptions): void {
  const { renderer, tagName = 'tex-morph', styles } = options;
  const prepareTimeoutMs = positive(options.prepareTimeoutMs, 10_000);
  if (customElements.get(tagName)) return;

  class TexMorph extends HTMLElement implements TexMorphElement {
    static get observedAttributes(): readonly string[] {
      return OBSERVED;
    }

    #morph: MathMorph | null = null;
    #progress = 0;
    #map: MorphMap | undefined;
    #generation = 0;
    #attempt: ReturnType<typeof attempt> | null = null;
    #raf = 0;
    #queued = false;
    #observer: ResizeObserver | null = null;
    #container: HTMLElement;
    #ready!: Promise<MathMorph>;
    #resolveReady!: (m: MathMorph) => void;
    #rejectReady: ((e: unknown) => void) | undefined;

    constructor() {
      super();
      this.#resetReady();
      if (styles) {
        const root = this.attachShadow({ mode: 'open' });
        if (typeof styles === 'string') {
          const style = document.createElement('style');
          style.textContent = styles;
          root.append(style);
        } else {
          root.adoptedStyleSheets = [styles];
        }
        this.#container = document.createElement('div');
        root.append(this.#container);
      } else {
        this.#container = this;
      }
    }

    #pending = false;

    /** Starts a new readiness promise unless one is still pending; a pending one resolves with the newest morph. */
    #resetReady(): void {
      if (this.#pending) return;
      this.#pending = true;
      this.#ready = new Promise((resolve, reject) => {
        this.#resolveReady = (m) => {
          this.#pending = false;
          resolve(m);
        };
        this.#rejectReady = (e) => {
          this.#pending = false;
          reject(e);
        };
      });
      this.#ready.catch(() => {});
    }

    get morph(): MathMorph | null {
      return this.#morph;
    }

    get ready(): Promise<MathMorph> {
      return this.#ready;
    }

    get progress(): number {
      return this.#progress;
    }

    set progress(value: number) {
      this.seek(value);
    }

    get morphMap(): MorphMap | undefined {
      return this.#map;
    }

    set morphMap(value: MorphMap | undefined) {
      this.#map = value;
      this.#schedule();
    }

    connectedCallback(): void {
      this.#observer = new ResizeObserver(() => {
        if (this.#morph?.state === 'ready') void this.#morph.refresh().catch(() => {});
      });
      this.#observer.observe(this);
      this.#schedule();
    }

    disconnectedCallback(): void {
      this.#observer?.disconnect();
      this.#observer = null;
      this.pause();
      this.#generation++;
      this.#attempt?.abort(new DOMException('disconnected', 'AbortError'));
      this.#attempt = null;
      if (this.#pending) this.#rejectReady?.(new DOMException('disconnected', 'AbortError'));
      this.#resetReady();
      this.#morph?.dispose({ settle: this.#progress >= 1 ? 'target' : 'source' });
      this.#morph = null;
    }

    attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
      if (previous === value) return;
      if (name === 'progress') this.seek(Number(value ?? 0));
      else this.#schedule();
    }

    seek(t: number): void {
      this.#progress = Number.isFinite(t) ? Math.min(Math.max(t, 0), 1) : 0;
      if (this.#morph?.state !== 'disposed') this.#morph?.render(this.#progress);
    }

    play(): void {
      this.pause();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.seek(1);
        return;
      }
      const duration = this.#morph?.duration ?? positive(Number(this.getAttribute('duration')), 800);
      if (!(duration > 0)) {
        this.seek(1);
        return;
      }
      const from = this.#progress >= 1 ? 0 : this.#progress;
      const start = performance.now() - from * duration;
      const tick = (now: number) => {
        this.seek((now - start) / duration);
        if (this.#progress < 1) this.#raf = requestAnimationFrame(tick);
        else this.#raf = 0;
      };
      this.#raf = requestAnimationFrame(tick);
    }

    pause(): void {
      if (this.#raf) cancelAnimationFrame(this.#raf);
      this.#raf = 0;
    }

    #schedule(): void {
      if (this.#queued || !this.isConnected) return;
      this.#queued = true;
      queueMicrotask(() => {
        this.#queued = false;
        void this.#prepare();
      });
    }

    #options(signal: AbortSignal): MathMorphOptions {
      const opts: MathMorphOptions = { signal };
      const duration = this.getAttribute('duration');
      if (duration !== null && Number.isFinite(Number(duration)) && Number(duration) > 0) opts.duration = Number(duration);
      const easing = this.getAttribute('easing');
      if (easing) opts.easing = parseEasing(easing);
      if (this.#map) opts.morphMap = this.#map;
      return opts;
    }

    async #prepare(): Promise<void> {
      const from = this.getAttribute('from');
      const to = this.getAttribute('to');
      if (from === null || to === null || !this.isConnected) return;
      const generation = ++this.#generation;
      this.#attempt?.abort(new DOMException('superseded', 'AbortError'));
      this.#resetReady();
      const displayMode = this.hasAttribute('display');
      const previous = this.#morph;
      this.#morph = null;
      previous?.dispose({ settle: 'source' });
      if (this.#container !== this) this.#container.replaceChildren();
      else this.replaceChildren();
      const current = attempt(prepareTimeoutMs);
      this.#attempt = current;
      const { signal } = current;
      try {
        const morph = await createMorphWith(renderer, this.#container, { latex: from, displayMode }, { latex: to, displayMode }, this.#options(signal));
        if (generation !== this.#generation) {
          morph.dispose();
          return;
        }
        this.#morph = morph;
        morph.render(this.#progress);
        this.#resolveReady(morph);
        this.dispatchEvent(new CustomEvent('texmorph-ready', { detail: { plan: morph.plan } }));
        if (morph.diagnostics.length) this.dispatchEvent(new CustomEvent('texmorph-diagnostic', { detail: morph.diagnostics }));
      } catch (error) {
        if (generation !== this.#generation) return;
        this.#rejectReady?.(error);
        this.dispatchEvent(new CustomEvent('texmorph-error', { detail: error }));
      } finally {
        current.done();
        if (this.#attempt === current) this.#attempt = null;
      }
    }
  }

  customElements.define(tagName, TexMorph);
}
