import type { AtomRole, ContextFrame, MathToken, MorphDiagnostic, RGBA, ScriptLevel, StructureRole } from '@texmorph/core';
import {
  createHtmlGhostLayer,
  createMorphWith,
  type FormulaInput,
  type FormulaRenderer,
  type GhostLayer,
  type LatexState,
  type MathMorph,
  type MathMorphOptions,
  type RenderedFormula,
} from '@texmorph/dom';

export interface KatexTrustContext {
  command: string;
  url?: string;
  protocol?: string;
}

export interface SafeKatexOptions {
  trust?: (ctx: KatexTrustContext) => boolean;
  macros?: Record<string, string>;
  strict?: boolean | 'ignore' | 'warn' | 'error';
  maxSize?: number;
  maxExpand?: number;
  minRuleThickness?: number;
  colorIsTextColor?: boolean;
  fleqn?: boolean;
  leqno?: boolean;
  errorColor?: string;
  globalGroup?: boolean;
}

export interface KatexLike {
  readonly version: string;
  render(latex: string, element: HTMLElement, options?: Record<string, unknown>): void;
}

const TOKEN = 'data-texmorph-token';
const PREFIXED = new Set([
  'base', 'strut', 'sizing', 'accent', 'overlay', 'overline', 'underline', 'root', 'rule', 'hline', 'hdashline',
  'stretchy', 'fix', 'inner', 'vbox', 'thinbox', 'tag', 'smash', 'sout', 'newline',
]);
const ATOMS: Record<string, AtomRole> = {
  mord: 'ord', mop: 'op', mbin: 'bin', mrel: 'rel', mopen: 'open', mclose: 'close', mpunct: 'punct', minner: 'inner',
};
const FONT_CLASSES = [
  'mathnormal', 'mathit', 'mathbf', 'boldsymbol', 'mathrm', 'textrm', 'mathsf', 'textsf', 'mathtt', 'texttt', 'mathcal',
  'mathscr', 'mathfrak', 'mathbb', 'mathboldsf', 'mathitsf', 'textbf', 'textit', 'amsrm', 'mainrm', 'cjk_fallback',
];

function has(el: Element, name: string): boolean {
  return el.classList.contains(name) || (PREFIXED.has(name) && el.classList.contains(`katex-${name}`));
}

function classes(el: Element): string[] {
  return [...el.classList];
}

interface Registry {
  texts: HTMLElement[];
  structures: Element[];
}

const registries = new WeakMap<Element, Registry>();
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function graphemes(text: string): string[] {
  if (!segmenter) throw new Error('Intl.Segmenter is required');
  return [...segmenter.segment(text)].map((s) => s.segment);
}

function htmlRoot(root: Element): Element {
  return root.querySelector('.katex-html') ?? root.querySelector('.katex') ?? root;
}

function wrapTokens(root: Element): void {
  const html = htmlRoot(root);
  if (html.querySelector(`[${TOKEN}]`)) return;
  const walker = document.createTreeWalker(html, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!node.nodeValue || !parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`math, annotation, script, style, [${TOKEN}]`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    for (const part of graphemes(node.nodeValue ?? '')) {
      const span = document.createElement('span');
      span.textContent = part;
      span.setAttribute(TOKEN, '');
      span.style.display = 'inline';
      fragment.append(span);
    }
    node.replaceWith(fragment);
  }
}

function contextOf(el: Element, stop: Element): ContextFrame[] {
  const chain: ContextFrame[] = [];
  for (let n = el.parentElement; n && n !== stop; n = n.parentElement) {
    const list = classes(n);
    if (list.includes('mfrac')) chain.push('frac');
    if (list.includes('sqrt') || list.includes('msqrt')) chain.push('sqrt');
    if (list.includes('vlist-r') || list.includes('pstrut')) chain.push('script');
    if (has(n, 'sizing') || list.some((c) => /^(katex-)?(reset-size|size)/.test(c))) chain.push('sized');
  }
  return chain;
}

function atomOf(el: Element, stop: Element): AtomRole {
  for (let n = el.parentElement; n && n !== stop; n = n.parentElement) {
    for (const c of n.classList) {
      const role = ATOMS[c];
      if (role) return role;
    }
  }
  return 'unknown';
}

function scriptOf(el: Element, stop: Element): ScriptLevel {
  for (let n = el.parentElement; n && n !== stop; n = n.parentElement) {
    if (!has(n, 'sizing')) continue;
    const size = classes(n).map((c) => /^size(\d+)$/.exec(c)).find(Boolean);
    if (!size) continue;
    const level = Number(size[1]);
    return level >= 6 ? 0 : level >= 3 ? 1 : 2;
  }
  return 0;
}

function fontClassOf(el: Element, stop: Element): string {
  for (let n = el.parentElement; n && n !== stop; n = n.parentElement) {
    const hit = FONT_CLASSES.find((c) => n.classList.contains(c));
    if (hit) return hit;
  }
  return '';
}

function parseColor(value: string): RGBA {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(value);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number(m[4]);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
}

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function shapeKey(el: Element, role: StructureRole): string {
  const svgs = el instanceof SVGSVGElement ? [el] : [...el.querySelectorAll('svg')];
  if (!svgs.length) return role;
  const shape = svgs
    .map((svg) => [svg.getAttribute('viewBox'), svg.getAttribute('preserveAspectRatio'), ...[...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'))].join(';'))
    .join('|');
  return `${role}:${hash(shape)}`;
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

function hasPaint(el: Element): boolean {
  const cs = getComputedStyle(el);
  const border = ['Top', 'Right', 'Bottom', 'Left'].some(
    (side) => Number.parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none',
  );
  const bg = cs.backgroundColor !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor);
  return border || bg;
}

function structureElements(html: Element): Array<{ el: Element; role: StructureRole }> {
  const found: Array<{ el: Element; role: StructureRole }> = [];
  const claimed = new Set<Element>();
  const take = (els: Iterable<Element>, role: StructureRole): void => {
    for (const el of els) {
      if (claimed.has(el) || !visible(el)) continue;
      claimed.add(el);
      found.push({ el, role });
    }
  };
  take(html.querySelectorAll('.frac-line'), 'frac-bar');
  take(html.querySelectorAll('.sqrt .hide-tail'), 'sqrt-sign');
  take(html.querySelectorAll('.overline-line'), 'overline');
  take(html.querySelectorAll('.underline-line'), 'underline');
  const clipped = (svg: Element): Element => {
    let el: Element = svg;
    while (el.parentElement && el.parentElement !== html && !el.parentElement.querySelector(`[${TOKEN}]`) && getComputedStyle(el.parentElement).overflow === 'hidden') {
      el = el.parentElement;
    }
    return el;
  };
  take([...html.querySelectorAll('svg')].filter((svg) => ![...claimed].some((c) => c.contains(svg))).map(clipped), 'svg');
  const rules = [...html.querySelectorAll('span')].filter(
    (el) => !el.hasAttribute(TOKEN) && !el.querySelector(`[${TOKEN}]`) && ![...claimed].some((c) => c === el || c.contains(el) || el.contains(c)) && hasPaint(el),
  );
  take(rules, 'rule');
  return found;
}

function paintedBorder(cs: CSSStyleDeclaration): string | null {
  for (const side of ['top', 'right', 'bottom', 'left']) {
    if (Number.parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 && cs.getPropertyValue(`border-${side}-style`) !== 'none') {
      return cs.getPropertyValue(`border-${side}-color`);
    }
  }
  return null;
}

/** The single color a structure paints with; ghosts paint with currentColor so it can be interpolated. */
function paintColor(el: Element, role: StructureRole): string {
  const cs = getComputedStyle(el);
  if (role === 'svg' || role === 'sqrt-sign') return cs.color;
  return paintedBorder(cs) ?? (cs.backgroundColor !== 'transparent' ? cs.backgroundColor : cs.color);
}

function scaleOf(root: Element): { sx: number; sy: number } {
  const el = root as HTMLElement;
  const rect = el.getBoundingClientRect();
  // offsetWidth/offsetHeight are rounded, so a difference below 1px means no ancestor transform.
  let sx = rect.width && el.offsetWidth && Math.abs(rect.width - el.offsetWidth) >= 1 ? rect.width / el.offsetWidth : 1;
  let sy = rect.height && el.offsetHeight && Math.abs(rect.height - el.offsetHeight) >= 1 ? rect.height / el.offsetHeight : sx;
  if (!Number.isFinite(sx) || sx === 0) sx = 1;
  if (!Number.isFinite(sy) || sy === 0) sy = 1;
  return { sx, sy };
}

function measure(root: Element, state: LatexState, version: string, diagnostics: MorphDiagnostic[]): RenderedFormula {
  wrapTokens(root);
  const html = htmlRoot(root);
  const base = root.getBoundingClientRect();
  const { sx, sy } = scaleOf(root);
  const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - base.left) / sx, y: (r.top - base.top) / sy, width: r.width / sx, height: r.height / sy };
  };
  const texts = [...html.querySelectorAll<HTMLElement>(`[${TOKEN}]`)];
  const tokens: MathToken[] = texts.map((el, index) => {
    const cs = getComputedStyle(el);
    const text = el.textContent ?? '';
    return {
      id: `k${index}`,
      kind: 'text',
      index,
      text,
      role: atomOf(el, root),
      script: scriptOf(el, root),
      context: contextOf(el, root),
      visualKey: [text, fontClassOf(el, root), cs.fontFamily, cs.fontWeight, cs.fontStyle].join('|'),
      box: box(el),
      style: { color: parseColor(cs.color), fontSize: Number.parseFloat(cs.fontSize) / sy },
    };
  });
  const structures = structureElements(html);
  for (const { el, role } of structures) {
    const index = tokens.length;
    const cs = getComputedStyle(el);
    tokens.push({
      id: `k${index}`,
      kind: 'structure',
      index,
      text: '',
      role,
      script: scriptOf(el, root),
      context: contextOf(el, root),
      visualKey: shapeKey(el, role),
      box: box(el),
      style: { color: parseColor(paintColor(el, role)), fontSize: Number.parseFloat(cs.fontSize) / sy },
    });
  }
  registries.set(root, { texts, structures: structures.map((s) => s.el) });
  return {
    root: root as HTMLElement,
    state,
    renderer: { name: 'katex', version },
    snapshot: {
      renderer: { name: 'katex', version },
      tokens,
      bounds: { x: 0, y: 0, width: base.width / sx, height: base.height / sy },
      em: tokens.find((t) => t.kind === 'text')?.style.fontSize ?? Number.parseFloat(getComputedStyle(root).fontSize),
    },
    diagnostics,
  };
}

function registry(rendered: RenderedFormula): Registry {
  const reg = registries.get(rendered.root);
  if (!reg) throw new Error('formula was not measured by the KaTeX renderer');
  return reg;
}

function family(root: Element): 'pre-0.18' | 'post-0.18' | 'unknown' {
  if (root.querySelector('.katex-base')) return 'post-0.18';
  if (root.querySelector('.base')) return 'pre-0.18';
  return 'unknown';
}

function versionFamily(version: string): 'pre-0.18' | 'post-0.18' {
  const [major, minor] = version.split('.').map(Number);
  return (major ?? 0) > 0 || (minor ?? 0) >= 18 ? 'post-0.18' : 'pre-0.18';
}

function textGhost(el: HTMLElement, token: MathToken, fontClass: string): HTMLElement {
  const cs = getComputedStyle(el);
  const ghost = document.createElement('span');
  ghost.textContent = token.text;
  if (fontClass) ghost.className = fontClass;
  const style = ghost.style;
  style.display = 'inline-block';
  style.whiteSpace = 'pre';
  style.fontFamily = cs.fontFamily;
  style.fontSize = cs.fontSize;
  style.fontWeight = cs.fontWeight;
  style.fontStyle = cs.fontStyle;
  style.letterSpacing = cs.letterSpacing;
  style.lineHeight = `${token.box.height}px`;
  style.color = cs.color;
  return ghost;
}

function structureGhost(el: Element, token: MathToken): Element {
  if (el instanceof SVGElement || token.role === 'svg' || token.role === 'sqrt-sign') {
    const cs = getComputedStyle(el);
    const clone = el.cloneNode(true) as HTMLElement | SVGElement;
    clone.style.removeProperty('visibility');
    clone.style.position = 'absolute';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.minWidth = '0';
    clone.style.margin = '0';
    const wrap = document.createElement('span');
    wrap.style.display = 'block';
    wrap.style.overflow = 'hidden';
    wrap.style.fontSize = cs.fontSize;
    wrap.style.color = cs.color;
    wrap.append(clone);
    return wrap;
  }
  const cs = getComputedStyle(el);
  const ghost = document.createElement('span');
  const style = ghost.style;
  style.display = 'block';
  style.boxSizing = 'border-box';
  const border = paintedBorder(cs);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const width = cs.getPropertyValue(`border-${side}-width`);
    const kind = cs.getPropertyValue(`border-${side}-style`);
    style.setProperty(`border-${side}`, `${width} ${kind} currentColor`);
  }
  style.background = border || cs.backgroundColor === 'transparent' ? 'transparent' : 'currentColor';
  style.color = paintColor(el, token.role as StructureRole);
  return ghost;
}

export function katexRenderer(katex: KatexLike, defaults: SafeKatexOptions = {}): FormulaRenderer<SafeKatexOptions> {
  const version = katex.version;
  return {
    name: 'katex',
    version,
    async ready() {
      if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready;
    },
    async render(container, state, opts) {
      const merged: SafeKatexOptions = { ...defaults, ...opts };
      if ((merged as { trust?: unknown }).trust === true) throw new TypeError('trust: true is not allowed; pass a policy function');
      const root = container;
      root.classList.add('texmorph-katex');
      if (state.className) root.classList.add(...state.className.split(/\s+/).filter(Boolean));
      katex.render(state.latex, root, {
        ...merged,
        trust: merged.trust ?? false,
        displayMode: state.displayMode ?? false,
        output: 'htmlAndMathml',
        throwOnError: true,
      });
      if (document.fonts) await document.fonts.ready;
      return measure(root, state, version, []);
    },
    async adopt(el) {
      const html = el.querySelector('.katex > .katex-html');
      if (!html || el.querySelector('.katex-error')) return null;
      const fam = family(el);
      if (fam !== 'unknown' && fam !== versionFamily(version)) return null;
      const latex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? '';
      return measure(el, { latex, displayMode: Boolean(el.querySelector('.katex-display')) }, version, []);
    },
    resnapshot(rendered) {
      return measure(rendered.root, rendered.state, version, [...rendered.diagnostics]);
    },
    maskTokens(rendered) {
      const reg = registry(rendered);
      const els = [...reg.texts, ...reg.structures] as Array<HTMLElement | SVGElement>;
      const previous = els.map((el) => el.style.visibility);
      els.forEach((el) => (el.style.visibility = 'hidden'));
      return () => els.forEach((el, i) => (el.style.visibility = previous[i] ?? ''));
    },
    createGhostLayer(stage, bounds): GhostLayer {
      const layer = createHtmlGhostLayer(stage, bounds);
      layer.root.classList.add('katex');
      (layer.root as HTMLElement).style.fontSize = '1em';
      return layer;
    },
    createGhost(token, rendered) {
      const reg = registry(rendered);
      if (token.kind === 'text') {
        const el = reg.texts[token.index];
        if (!el) throw new RangeError(`no text token ${token.index}`);
        return textGhost(el, token, fontClassOf(el, rendered.root));
      }
      const textCount = reg.texts.length;
      const el = reg.structures[token.index - textCount];
      if (!el) throw new RangeError(`no structure token ${token.index}`);
      return structureGhost(el, token);
    },
  };
}

export async function createMorph(
  host: HTMLElement,
  from: FormulaInput,
  to: FormulaInput,
  options: MathMorphOptions<SafeKatexOptions> & { katex?: KatexLike } = {},
): Promise<MathMorph> {
  const { katex: injected, ...rest } = options;
  const katex = injected ?? ((await import('katex')) as unknown as { default: KatexLike }).default;
  return createMorphWith(katexRenderer(katex), host, from, to, rest);
}

export { MorphPrepareError, renderFormula, TexMorphLifecycleError } from '@texmorph/dom';
export type { FormulaInput, FormulaRenderer, GhostLayer, LatexState, MathMorph, MathMorphOptions, RenderedFormula } from '@texmorph/dom';
