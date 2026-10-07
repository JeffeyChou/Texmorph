import type { AtomRole, Box, ContextFrame, FormulaSnapshot, MathToken, MorphDiagnostic, RGBA, ScriptLevel, StructureRole } from '@texmorph/core';
import { ATTR } from './annotate.ts';

export const SVGNS = 'http://www.w3.org/2000/svg';
export const XLINK = 'http://www.w3.org/1999/xlink';

const ROLES: Record<string, AtomRole> = {
  ORD: 'ord', OP: 'op', BIN: 'bin', REL: 'rel', OPEN: 'open', CLOSE: 'close', PUNCT: 'punct', INNER: 'inner',
};
const FRAMES = new Set<ContextFrame>(['frac', 'sqrt', 'script', 'sized']);
const INKLESS = /^[\p{White_Space}\p{Cf}]*$/u;

export class SnapshotError extends Error {
  constructor(
    readonly code: 'layout/zero-box' | 'layout/no-size' | 'render/unknown-structure',
    message: string,
  ) {
    super(message);
  }
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One painted element of a token: a glyph <use>, a code-point range of a <text> run, or a whole aggregated subtree. */
export interface Unit {
  el: SVGGraphicsElement;
  /** Matrix from the element's parent coordinate system to the root <svg> user space. */
  parent: DOMMatrix;
  char?: number;
  len?: number;
  startX?: number;
}

export interface Entry {
  units: Unit[];
  /** Ink box in root <svg> user units. */
  bbox: Rect;
  text: string;
}

export interface Registry {
  svg: SVGSVGElement;
  /** CSS px per root user unit, without ancestor scale. */
  k: number;
  entries: Entry[];
  ids: string[];
}

export const registries: WeakMap<Element, Registry> = new WeakMap();

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function graphemes(text: string): string[] {
  if (!segmenter) throw new Error('Intl.Segmenter is required');
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

function union(rects: readonly Rect[]): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function parseColor(value: string): RGBA {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(value);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number(m[4]);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
}

export function hrefOf(use: Element): string {
  return use.getAttribute('href') ?? use.getAttributeNS(XLINK, 'href') ?? '';
}

export function setHref(use: Element, value: string): void {
  if (use.hasAttribute('href')) use.setAttribute('href', value);
  else use.setAttributeNS(XLINK, 'xlink:href', value);
}

/** Glyph identity without the per-formula cache id and namespace prefix, e.g. `NCM-I-1D465`. */
function glyphKey(use: Element): string {
  return hrefOf(use).replace(/^#/, '').replace(/^(?:tmr\d+-)?MJX-\d+-/, '');
}

/** Ancestor CSS scale, measured with a fixed-size probe (offsetWidth is integer-rounded). */
function ancestorScale(root: HTMLElement): { sx: number; sy: number } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:0;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none;padding:0;border:0;margin:0';
  root.append(probe);
  const p = probe.getBoundingClientRect();
  probe.remove();
  const sx = p.width / 1000;
  const sy = p.height / 1000;
  return { sx: Number.isFinite(sx) && sx > 0 ? sx : 1, sy: Number.isFinite(sy) && sy > 0 ? sy : 1 };
}

/**
 * Moves an SVG root (by less than half a pixel) onto whole screen pixels. Chromium snaps an <svg> box to the
 * pixel grid but not transformed ghosts; on a whole pixel no snapping happens, so both draw at the same place.
 */
export function alignToPixels(svg: SVGSVGElement, scaleOf: HTMLElement): void {
  const { sx, sy } = ancestorScale(scaleOf);
  const style = svg.style;
  if (style.position === '' || style.position === 'static') style.position = 'relative';
  const r = svg.getBoundingClientRect();
  const x = r.left - (Number.parseFloat(style.left) || 0) * sx;
  const y = r.top - (Number.parseFloat(style.top) || 0) * sy;
  style.left = `${(Math.round(x) - x) / sx}px`;
  style.top = `${(Math.round(y) - y) / sy}px`;
}

function screenToRoot(svg: SVGSVGElement): DOMMatrix {
  const m = svg.getScreenCTM();
  if (!m) throw new SnapshotError('layout/no-size', 'formula svg is not rendered');
  return DOMMatrix.fromMatrix(m).inverse();
}

function toRoot(inv: DOMMatrix, el: Element): DOMMatrix {
  const m = (el as SVGGraphicsElement).getScreenCTM?.();
  if (!m) throw new SnapshotError('layout/no-size', 'glyph is not rendered');
  return inv.multiply(DOMMatrix.fromMatrix(m));
}

function mapRect(m: DOMMatrix, r: Rect): Rect {
  const pts = [
    [r.x, r.y],
    [r.x + r.width, r.y],
    [r.x, r.y + r.height],
    [r.x + r.width, r.y + r.height],
  ].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

interface RawUnit {
  el: SVGGraphicsElement;
  char?: number;
  len?: number;
}

/** Splits a token leaf into grapheme parts; null when glyphs do not map 1:1 to code points (stretchy assemblies). */
function leafParts(g: Element, text: string): Array<{ text: string; units: RawUnit[] }> | null {
  const cps = Array.from(text);
  const units: RawUnit[] = [];
  for (const child of g.children) {
    if (child.localName === 'use' && !/scale/.test(child.getAttribute('transform') ?? '')) units.push({ el: child as SVGGraphicsElement });
    else if (child.localName === 'text') {
      let u16 = 0;
      for (const cp of Array.from(child.textContent ?? '')) {
        units.push({ el: child as SVGGraphicsElement, char: u16, len: cp.length });
        u16 += cp.length;
      }
    } else return null;
  }
  if (units.length !== cps.length) return null;
  const out: Array<{ text: string; units: RawUnit[] }> = [];
  let k = 0;
  for (const gr of graphemes(text)) {
    const n = Array.from(gr).length;
    out.push({ text: gr, units: units.slice(k, k + n) });
    k += n;
  }
  return out;
}

export function formulaSvg(root: Element): SVGSVGElement | null {
  return root.querySelector<SVGSVGElement>(':scope > mjx-container > svg');
}

export interface Measured {
  snapshot: FormulaSnapshot;
  diagnostics: MorphDiagnostic[];
}

/** Measures a marked root. Throws SnapshotError for layout or structure problems (ADR 0002 D-3 a). */
export function measure(root: HTMLElement, renderer: { name: string; version: string }): Measured {
  const svg = formulaSvg(root);
  if (!svg || !svg.querySelector('g[data-mml-node]')) throw new SnapshotError('render/unknown-structure', 'not a MathJax SVG root');
  if (!svg.querySelector(`[${ATTR.text}]`) && svg.querySelector('use, text')) {
    throw new SnapshotError('render/unknown-structure', 'root lacks texmorph token annotations');
  }
  const rootRect = root.getBoundingClientRect();
  if (!rootRect.width || !rootRect.height) throw new SnapshotError('layout/zero-box', 'formula root has no size');
  alignToPixels(svg, root);
  const { sx, sy } = ancestorScale(root);
  const inv = screenToRoot(svg);
  const ctm = svg.getScreenCTM() as DOMMatrix;
  const svgRect = svg.getBoundingClientRect();
  // Chromium paints the outer <svg> at a device-pixel-snapped offset; boxes follow the painted position.
  const dpr = devicePixelRatio || 1;
  const snapX = Math.round(svgRect.left * dpr) / dpr - svgRect.left;
  const snapY = Math.round(svgRect.top * dpr) / dpr - svgRect.top;
  const k = ctm.a / sx;
  const em = Number.parseFloat(getComputedStyle(root).fontSize) / sy;
  const toCss = (r: Rect): Box => ({
    x: (ctm.e + snapX + r.x * ctm.a - rootRect.left) / sx,
    y: (ctm.f + snapY + r.y * ctm.d - rootRect.top) / sy,
    width: (r.width * ctm.a) / sx,
    height: (r.height * ctm.d) / sy,
  });
  const fontSizeOf = (el: Element): number => {
    const m = toRoot(inv, el);
    return Math.hypot(m.a, m.b) * k * 1000;
  };
  const colorOf = (el: Element): RGBA => parseColor(getComputedStyle(el).fill);
  const unitOf = (raw: RawUnit): Unit => {
    const unit: Unit = { el: raw.el, parent: toRoot(inv, raw.el.parentNode as Element) };
    if (raw.char !== undefined) {
      unit.char = raw.char;
      unit.len = raw.len ?? 1;
      unit.startX = (raw.el as SVGTextContentElement).getStartPositionOfChar(raw.char).x;
    }
    return unit;
  };
  const unitRect = (u: RawUnit): Rect => {
    if (u.char === undefined) return mapRect(toRoot(inv, u.el), u.el.getBBox());
    const text = u.el as SVGTextContentElement;
    const rects: Rect[] = [];
    for (let i = u.char; i < u.char + (u.len ?? 1); i++) rects.push(text.getExtentOfChar(i));
    return mapRect(toRoot(inv, u.el), union(rects) as Rect);
  };

  const tokens: MathToken[] = [];
  const entries: Entry[] = [];
  const diagnostics: MorphDiagnostic[] = [];

  const leaves = Array.from(svg.querySelectorAll(`g[${ATTR.text}]:not([${ATTR.structure}])`)).sort(
    (a, b) => Number(a.getAttribute(ATTR.id)) - Number(b.getAttribute(ATTR.id)),
  );
  for (const g of leaves) {
    const text = g.getAttribute(ATTR.text) ?? '';
    const variant = g.getAttribute(ATTR.variant) ?? 'normal';
    const role = ROLES[g.getAttribute(ATTR.cls) ?? ''] ?? 'unknown';
    const script = Number(g.getAttribute(ATTR.script)) as ScriptLevel;
    const ctx = g.getAttribute(ATTR.ctx);
    const context = ctx ? (ctx.split(',').filter((f) => FRAMES.has(f as ContextFrame)) as ContextFrame[]) : [];
    let parts = leafParts(g, text);
    let aggregate = false;
    if (!parts) {
      parts = [{ text, units: [{ el: g as SVGGraphicsElement }] }];
      aggregate = true;
      if (graphemes(text).length > 1) diagnostics.push({ code: 'render/unknown-structure', severity: 'info', message: `aggregated multi-grapheme leaf "${text}"` });
    }
    for (const part of parts) {
      if (INKLESS.test(part.text) || !part.units.length) continue;
      const bbox = union(part.units.map(unitRect)) as Rect;
      if (!(bbox.width > 0) && !(bbox.height > 0)) continue;
      const first = part.units[0] as RawUnit;
      const glyphs = aggregate
        ? [`${Array.from(g.querySelectorAll('use'), glyphKey).join('+')}@${Math.round(bbox.width)}x${Math.round(bbox.height)}`]
        : part.units.map((u) =>
            u.el.localName === 'use'
              ? glyphKey(u.el)
              : `text(${u.el.getAttribute('font-family') ?? ''},${u.el.getAttribute('font-weight') ?? ''},${u.el.getAttribute('font-style') ?? ''})`,
          );
      const hasText = part.units.some((u) => u.char !== undefined);
      const paint = first.el.localName === 'g' ? (first.el.querySelector('use, text, rect') ?? first.el) : first.el;
      const index = tokens.length;
      tokens.push({
        id: `m${index}`,
        kind: 'text',
        index,
        text: part.text,
        role,
        script: script >= 0 && script <= 2 ? script : 0,
        context,
        visualKey: `mathjax|${variant}|${glyphs.join('+')}${hasText ? `|${part.text}` : ''}`,
        box: toCss(bbox),
        style: { color: colorOf(paint), fontSize: fontSizeOf(first.el) },
      });
      // A <text> run is cloned once per grapheme, so only its first unit is kept.
      const units = hasText ? [unitOf(first)] : part.units.map(unitOf);
      entries.push({ units, bbox, text: part.text });
    }
  }

  const structure: Array<[SVGGraphicsElement, StructureRole]> = [];
  for (const rect of svg.querySelectorAll<SVGGraphicsElement>('g[data-mml-node="mfrac"] > rect')) structure.push([rect, 'frac-bar']);
  for (const rect of svg.querySelectorAll<SVGGraphicsElement>('g[data-mml-node="msqrt"] > rect, g[data-mml-node="mroot"] > rect')) structure.push([rect, 'sqrt-bar']);
  for (const mo of svg.querySelectorAll<SVGGraphicsElement>(
    `g[data-mml-node="msqrt"] > g[data-mml-node="mo"]:not([${ATTR.id}]), g[data-mml-node="mroot"] > g[data-mml-node="mo"]:not([${ATTR.id}])`,
  )) {
    structure.push([mo, 'sqrt-sign']);
  }
  for (const g of svg.querySelectorAll<SVGGraphicsElement>(`g[${ATTR.structure}]`)) structure.push([g, g.getAttribute(ATTR.structure) as StructureRole]);
  structure.sort(([a], [b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const minPx = 1 / dpr;
  for (const [el, role] of structure) {
    const bbox = mapRect(toRoot(inv, el), el.getBBox());
    const box = toCss(bbox);
    if (box.height < minPx) box.height = minPx;
    if (box.width < minPx) box.width = minPx;
    const shape = el.localName === 'rect' ? 'rule' : `${Array.from(el.querySelectorAll('use'), glyphKey).join('+')}@${Math.round(bbox.width)}x${Math.round(bbox.height)}`;
    const paint = el.localName === 'rect' ? el : (el.querySelector('use') ?? el);
    const owner = el.closest(`[${ATTR.sid}]`) ?? el.closest(`[${ATTR.ctx}]`);
    const ctx = owner?.getAttribute(ATTR.ctx);
    const index = tokens.length;
    tokens.push({
      id: `m${index}`,
      kind: 'structure',
      index,
      text: '',
      role,
      script: (Math.min(2, Number(owner?.getAttribute(ATTR.script)) || 0)) as ScriptLevel,
      context: ctx ? (ctx.split(',').filter((f) => FRAMES.has(f as ContextFrame)) as ContextFrame[]) : [],
      visualKey: `mathjax|${role}|${shape}`,
      box,
      style: { color: colorOf(paint), fontSize: fontSizeOf(el) },
    });
    entries.push({ units: [{ el, parent: toRoot(inv, el.parentNode as Element) }], bbox, text: '' });
  }

  registries.set(root, { svg, k, entries, ids: tokens.map((t) => t.id) });
  return {
    snapshot: { renderer, tokens, bounds: { x: 0, y: 0, width: rootRect.width / sx, height: rootRect.height / sy }, em },
    diagnostics,
  };
}

/** Snapshot-failure convention (ADR 0002 D-3 a): keep the root, return an empty snapshot plus an error diagnostic. */
export function safeMeasure(root: HTMLElement, renderer: { name: string; version: string }): Measured {
  try {
    return measure(root, renderer);
  } catch (error) {
    if (!(error instanceof SnapshotError)) throw error;
    registries.delete(root);
    const r = root.getBoundingClientRect();
    const bounds: Box = { x: 0, y: 0, width: r.width, height: r.height };
    return {
      snapshot: { renderer, tokens: [], bounds, em: 0 },
      diagnostics: [
        { code: error.code, severity: 'error', message: error.message },
        { code: 'fallback/crossfade', severity: 'warn', message: 'snapshot failed; the morph degrades to a crossfade' },
      ],
    };
  }
}
