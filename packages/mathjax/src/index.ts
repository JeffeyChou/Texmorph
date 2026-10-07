import type { MorphDiagnostic, RGBA } from '@texmorph/core';
import {
  createMorphWith,
  type FormulaInput,
  type FormulaRenderer,
  type GhostLayer,
  type LatexState,
  type MathMorph,
  type MathMorphOptions,
  type RenderedFormula,
} from '@texmorph/dom';
import { ATTR } from './annotate.ts';
import { createEngine, loadFontRange, MATHJAX_VERSION, setFontLoader, type Engine } from './engine.ts';
import { alignToPixels, formulaSvg, hrefOf, registries, safeMeasure, setHref, SVGNS, XLINK } from './snapshot.ts';

export interface MathJaxRendererOptions {
  /** TeX packages. Default: base, ams, newcommand, color, cancel, boldsymbol. Others need their configuration module from `@mathjax/src` imported first. */
  packages?: readonly string[];
  macros?: Readonly<Record<string, string | [string, number]>>;
  /**
   * Loads one dynamic range of the newcm font, e.g. `"latin-b"`. The default imports
   * `@mathjax/mathjax-newcm-font/js/svg/dynamic/<range>.js` lazily. The loader is page-global,
   * because MathJax keeps font data in shared module state.
   */
  loadFont?: (range: string) => Promise<unknown>;
  /** Dynamic font ranges to load in `ready()`. */
  preloadFonts?: readonly string[];
}

/** Per-render options. */
export interface SafeMathJaxOptions {
  /** Container width in CSS px for percentage widths. Default: 80 ex. */
  containerWidth?: number;
}

const MARKER = 'data-tm-renderer';
const LATEX = 'data-tm-latex';
const DISPLAY = 'data-tm-display';
const STYLE_MARK = 'data-texmorph-mathjax';
let rootSeq = 0;
let ghostSeq = 0;

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function css(color: RGBA): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
}

function metrics(container: HTMLElement): { em: number; ex: number } {
  const em = Number.parseFloat(getComputedStyle(container).fontSize) || 16;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:1ex;height:0;padding:0;border:0;margin:0';
  container.append(probe);
  const ex = Number.parseFloat(getComputedStyle(probe).width) || em / 2;
  probe.remove();
  return { em, ex };
}

/** Gives every id in a root a per-root prefix, so roots from separate MathJax documents never share ids. */
function namespaceIds(svg: SVGSVGElement, prefix: string): void {
  for (const el of svg.querySelectorAll('[id]')) el.id = prefix + el.id;
  for (const use of svg.querySelectorAll('use')) {
    const href = hrefOf(use);
    if (href.startsWith('#')) setHref(use, `#${prefix}${href.slice(1)}`);
  }
}

function injectStylesheet(container: HTMLElement, text: string): void {
  const rootNode = container.getRootNode();
  if (!(rootNode instanceof Document) || rootNode.head.querySelector(`style[${STYLE_MARK}]`)) return;
  const style = rootNode.createElement('style');
  style.setAttribute(STYLE_MARK, '');
  style.textContent = text;
  rootNode.head.append(style);
}

function svgEl<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVGNS, name);
}

function matrixAttr(m: DOMMatrix): string {
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

function isAdoptable(el: Element, marker: string): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el.getAttribute(MARKER) !== marker) return false;
  const svg = formulaSvg(el);
  if (!svg || !svg.querySelector('g[data-mml-node]')) return false;
  return Boolean(svg.querySelector(`[${ATTR.text}]`)) || !svg.querySelector('use, text');
}

export function mathjaxRenderer(options: MathJaxRendererOptions = {}): FormulaRenderer<SafeMathJaxOptions> {
  setFontLoader(options.loadFont);
  const engine: Engine = createEngine({ packages: options.packages, macros: options.macros });
  const version = MATHJAX_VERSION;
  const info = { name: 'mathjax', version };
  const marker = `mathjax@${version}`;
  const preload = [...(options.preloadFonts ?? [])];

  const result = (root: HTMLElement, state: LatexState, extra: readonly MorphDiagnostic[] = []): RenderedFormula => {
    const { snapshot, diagnostics } = safeMeasure(root, info);
    return { root, state, renderer: info, snapshot, diagnostics: [...extra, ...diagnostics] };
  };

  return {
    name: info.name,
    version,
    async ready(signal) {
      throwIfAborted(signal);
      await abortable(Promise.all(preload.map(loadFontRange)), signal);
      if (typeof document !== 'undefined' && document.fonts) await abortable(document.fonts.ready, signal);
    },
    async render(container, state, opts, signal) {
      throwIfAborted(signal);
      const { em, ex } = metrics(container);
      const node = await abortable(
        engine.convert(state.latex, { display: state.displayMode ?? false, em, ex, containerWidth: opts?.containerWidth ?? 80 * ex }),
        signal,
      );
      injectStylesheet(container, engine.styleSheet());
      container.replaceChildren(node);
      container.classList.add('texmorph-mathjax');
      if (state.className) container.classList.add(...state.className.split(/\s+/).filter(Boolean));
      container.setAttribute(MARKER, marker);
      container.setAttribute(LATEX, state.latex);
      container.setAttribute(DISPLAY, String(state.displayMode ?? false));
      const svg = formulaSvg(container);
      if (svg) namespaceIds(svg, `tmr${++rootSeq}-`);
      if (svg?.querySelector('text') && document.fonts) await abortable(document.fonts.ready, signal);
      return result(container, state);
    },
    async adopt(el, signal) {
      throwIfAborted(signal);
      if (!isAdoptable(el, marker)) return null;
      return result(el, { latex: el.getAttribute(LATEX) ?? '', displayMode: el.getAttribute(DISPLAY) === 'true' });
    },
    resnapshot(rendered) {
      return result(rendered.root as HTMLElement, rendered.state);
    },
    maskTokens(rendered) {
      const reg = registries.get(rendered.root);
      if (!reg) return () => {};
      const els = new Set<Element>();
      for (const entry of reg.entries) for (const u of entry.units) els.add(u.el);
      const saved = Array.from(els, (el) => [el, el.getAttribute('visibility')] as const);
      for (const el of els) el.setAttribute('visibility', 'hidden');
      return () => {
        for (const [el, v] of saved) {
          if (v === null) el.removeAttribute('visibility');
          else el.setAttribute('visibility', v);
        }
      };
    },
    createGhostLayer(stage, bounds): GhostLayer {
      const root = svgEl('svg');
      root.setAttribute('class', 'texmorph-ghosts');
      root.setAttribute('aria-hidden', 'true');
      root.setAttribute('width', String(Math.max(bounds.x + bounds.width, 1)));
      root.setAttribute('height', String(Math.max(bounds.y + bounds.height, 1)));
      root.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
      stage.append(root);
      alignToPixels(root, stage);
      const dx = -Number.parseFloat(root.style.left);
      const dy = -Number.parseFloat(root.style.top);
      return {
        root,
        add(ghost) {
          root.append(ghost);
        },
        place(ghost, frame, track) {
          const native = frame.layer === 'source' ? track.from.box : track.to.box;
          const [ox, oy] = track.origin === 'center' ? [native.width / 2, native.height / 2] : [0, 0];
          ghost.setAttribute('transform', `translate(${frame.tx + ox + dx} ${frame.ty + oy + dy}) scale(${frame.sx} ${frame.sy}) translate(${-ox} ${-oy})`);
          ghost.setAttribute('opacity', String(frame.opacity));
          if (frame.color) {
            const color = css(frame.color);
            ghost.setAttribute('fill', color);
            ghost.setAttribute('stroke', color);
          }
        },
        dispose() {
          root.replaceChildren();
        },
      };
    },
    createGhost(ref, rendered) {
      const token = rendered.snapshot.tokens[ref.index];
      const reg = registries.get(rendered.root);
      const entry = reg?.entries[ref.index];
      if (!token || !reg || !entry || token.id !== ref.id || reg.ids[ref.index] !== ref.id) {
        throw new RangeError(`token ${ref.index} does not belong to this RenderedFormula`);
      }
      const prefix = `tmg${++ghostSeq}-`;
      const ghost = svgEl('g');
      ghost.setAttribute('aria-hidden', 'true');
      const color = css(token.style.color);
      ghost.setAttribute('fill', color);
      ghost.setAttribute('stroke', color);
      ghost.setAttribute('stroke-width', '0');
      const defs = svgEl('defs');
      const body = svgEl('g');
      body.setAttribute('transform', `scale(${reg.k}) translate(${-entry.bbox.x} ${-entry.bbox.y})`);
      for (const u of entry.units) {
        const wrap = svgEl('g');
        wrap.setAttribute('transform', matrixAttr(u.parent));
        const clone = u.el.cloneNode(true) as SVGGraphicsElement;
        for (const el of [clone, ...clone.querySelectorAll('*')]) {
          el.removeAttribute('visibility');
          el.removeAttribute('fill');
          el.removeAttribute('stroke');
          for (const name of el.getAttributeNames()) if (name.startsWith('data-tm-')) el.removeAttribute(name);
        }
        if (u.char !== undefined) {
          clone.textContent = entry.text;
          clone.setAttribute('x', String(u.startX ?? 0));
        }
        wrap.append(clone);
        body.append(wrap);
      }
      const copied = new Set<string>();
      for (const use of body.querySelectorAll('use')) {
        const id = hrefOf(use).slice(1);
        if (!copied.has(id)) {
          const src = reg.svg.querySelector(`[id="${CSS.escape(id)}"]`);
          if (!src) throw new Error(`missing glyph definition ${id}`);
          const def = src.cloneNode(true) as Element;
          def.id = prefix + id;
          defs.append(def);
          copied.add(id);
        }
        use.removeAttribute('href');
        use.setAttributeNS(XLINK, 'xlink:href', `#${prefix}${id}`);
      }
      ghost.append(defs, body);
      return ghost;
    },
    stylesheet() {
      return engine.styleSheet();
    },
  };
}

let shared: FormulaRenderer<SafeMathJaxOptions> | null = null;

export async function createMorph(
  host: HTMLElement,
  from: FormulaInput,
  to: FormulaInput,
  options: MathMorphOptions<SafeMathJaxOptions> & { renderer?: FormulaRenderer<SafeMathJaxOptions>; mathjax?: MathJaxRendererOptions } = {},
): Promise<MathMorph> {
  const { renderer: injected, mathjax, ...rest } = options;
  const renderer = injected ?? (mathjax ? mathjaxRenderer(mathjax) : (shared ??= mathjaxRenderer()));
  return createMorphWith(renderer, host, from, to, rest);
}

export { MorphPrepareError, renderFormula, TexMorphLifecycleError } from '@texmorph/dom';
export type { FormulaInput, FormulaRenderer, GhostLayer, LatexState, MathMorph, MathMorphOptions, RenderedFormula } from '@texmorph/dom';
