import type { Box } from '@texmorph/core';
import type { ShapeGhost } from '@texmorph/dom';
import { hrefOf, SVGNS } from './snapshot.ts';

type Pt = [number, number];
type Align = (from: Pt[], to: Pt[]) => [Pt[], Pt[]];

interface Ring {
  points: Pt[];
  area: number;
  centroid: Pt;
}

/** One ring of the morph: point i moves from `from[i]` to `to[i]`. */
interface RingPair {
  from: Pt[];
  to: Pt[];
}

/** Outline sampling step in CSS px. */
const STEP = 0.5;
const MAX_POINTS = 600;

let loading: Promise<void> | null = null;
let aligner: Align | null = null;

/** Loads flubber on first use; it only aligns rings (resampling and rotation), the per-frame lerp is ours. */
export function loadShapes(): Promise<void> {
  loading ??= import('flubber').then((m) => {
    // The ESM entry has named exports; the UMD build that Node resolves arrives as `default`.
    type Flubber = { interpolate?: typeof m.interpolate };
    const mod = m as unknown as Flubber & { default?: Flubber };
    const interpolate = mod.interpolate ?? mod.default?.interpolate;
    if (typeof interpolate !== 'function') throw new Error('flubber.interpolate is missing');
    aligner = (from, to) => {
      const f = interpolate(from, to, { string: false, maxSegmentLength: STEP * 2 }) as unknown as (t: number) => Pt[];
      return [f(0), f(1)];
    };
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

function signedArea(points: Pt[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i] as Pt;
    const [x1, y1] = points[(i + 1) % points.length] as Pt;
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function centroid(points: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
}

/** Samples each subpath of `d` into a polygon, mapped through `m`. */
function sample(d: string, m: DOMMatrix, scratch: SVGPathElement): Ring[] {
  const rings: Ring[] = [];
  const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  for (const sub of d.split(/(?=M)/)) {
    if (!sub.trim()) continue;
    scratch.setAttribute('d', sub);
    const length = scratch.getTotalLength();
    if (!(length > 0)) continue;
    const n = Math.min(MAX_POINTS, Math.max(12, Math.ceil((length * scale) / STEP)));
    const points: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const p = scratch.getPointAtLength((length * i) / n);
      const q = m.transformPoint(new DOMPoint(p.x, p.y));
      points.push([q.x, q.y]);
    }
    const area = signedArea(points);
    if (Math.abs(area) > 1e-3) rings.push({ points, area, centroid: centroid(points) });
  }
  return rings;
}

/** The ghost's outline in its own coordinates (CSS px from the token box's top-left), or null when it holds text. */
function outline(ghost: SVGGraphicsElement, scratch: SVGPathElement): Ring[] | null {
  const own = ghost.getCTM();
  if (!own) return null;
  const inv = DOMMatrix.fromMatrix(own).inverse();
  const rings: Ring[] = [];
  for (const el of ghost.querySelectorAll<SVGGraphicsElement>('use, path, rect, text, image, foreignObject')) {
    if (el.closest('defs')) continue;
    if (el.localName === 'text' || el.localName === 'image' || el.localName === 'foreignObject') return null;
    const ctm = el.getCTM();
    if (!ctm) return null;
    const m = inv.multiply(DOMMatrix.fromMatrix(ctm));
    if (el.localName === 'rect') {
      const r = el as SVGRectElement;
      const [x, y, w, h] = [r.x.baseVal.value, r.y.baseVal.value, r.width.baseVal.value, r.height.baseVal.value];
      rings.push(...sample(`M${x} ${y}H${x + w}V${y + h}H${x}Z`, m, scratch));
    } else if (el.localName === 'path') {
      const d = el.getAttribute('d') ?? '';
      if (/[a-z]/.test(d)) return null;
      rings.push(...sample(d, m, scratch));
    } else {
      const def = ghost.querySelector(`[id="${CSS.escape(hrefOf(el).slice(1))}"]`);
      if (def?.localName !== 'path' || /[a-z]/.test(def.getAttribute('d') ?? '')) return null;
      const x = Number(el.getAttribute('x') ?? 0);
      const y = Number(el.getAttribute('y') ?? 0);
      rings.push(...sample(def.getAttribute('d') ?? '', m.translate(x, y), scratch));
    }
  }
  return rings.length ? rings : null;
}

function collapse(points: Pt[], at: Pt): RingPair {
  return { from: points, to: points.map(() => [at[0], at[1]] as Pt) };
}

/**
 * Pairs outer rings with outer rings and holes with holes, nearest centroid first (relative to each box).
 * Rings left over shrink to, or grow from, the matching point of the other box.
 */
function pairRings(a: Ring[], b: Ring[], boxA: Box, boxB: Box, alignRings: Align): Array<RingPair & { sign: number }> {
  const largest = [...a].sort((p, q) => Math.abs(q.area) - Math.abs(p.area))[0] as Ring;
  const outer = Math.sign(largest.area);
  const rel = (c: Pt, box: Box): Pt => [c[0] / (box.width || 1), c[1] / (box.height || 1)];
  const pairs: Array<RingPair & { sign: number }> = [];
  for (const hole of [false, true]) {
    const sign = hole ? -outer : outer;
    const pick = (rings: Ring[]) => rings.filter((r) => (Math.sign(r.area) !== outer) === hole).sort((p, q) => Math.abs(q.area) - Math.abs(p.area));
    const right = pick(b);
    const used = new Set<Ring>();
    for (const r of pick(a)) {
      const [ax, ay] = rel(r.centroid, boxA);
      let best: Ring | undefined;
      let dist = Infinity;
      for (const s of right) {
        if (used.has(s)) continue;
        const [bx, by] = rel(s.centroid, boxB);
        const d = Math.hypot(ax - bx, ay - by);
        if (d < dist) [best, dist] = [s, d];
      }
      if (best) {
        used.add(best);
        const [from, to] = alignRings(r.points, best.points);
        pairs.push({ from, to, sign });
      } else {
        pairs.push({ ...collapse(r.points, [ax * boxB.width, ay * boxB.height]), sign });
      }
    }
    for (const s of right) {
      if (used.has(s)) continue;
      const [bx, by] = rel(s.centroid, boxB);
      const { from, to } = collapse(s.points, [bx * boxA.width, by * boxA.height]);
      pairs.push({ from: to, to: from, sign });
    }
  }
  // flubber makes every ring clockwise; restore each ring's winding so holes stay holes under nonzero fill.
  for (const p of pairs) {
    const reference = signedArea(p.from) || signedArea(p.to);
    if (Math.sign(reference) !== p.sign) {
      p.from.reverse();
      p.to.reverse();
    }
  }
  return pairs;
}

function pathAt(pairs: RingPair[], mix: number): string {
  let d = '';
  for (const { from, to } of pairs) {
    d += 'M';
    for (let i = 0; i < from.length; i++) {
      const [x0, y0] = from[i] as Pt;
      const [x1, y1] = to[i] as Pt;
      if (i) d += 'L';
      d += `${(x0 + (x1 - x0) * mix).toFixed(2)} ${(y0 + (y1 - y0) * mix).toFixed(2)}`;
    }
    d += 'Z';
  }
  return d;
}

/** Morphs the outline of `source` into `target`; null when either ghost has no pure path outline or flubber is not loaded. */
export function createShapeGhost(source: Element, target: Element, boxes: { from: Box; to: Box }): ShapeGhost | null {
  if (!aligner || !(source instanceof SVGGraphicsElement) || !(target instanceof SVGGraphicsElement)) return null;
  const host = source.ownerSVGElement;
  if (!host) return null;
  const scratch = document.createElementNS(SVGNS, 'path');
  scratch.setAttribute('visibility', 'hidden');
  host.append(scratch);
  let a: Ring[] | null;
  let b: Ring[] | null;
  try {
    a = outline(source, scratch);
    b = outline(target, scratch);
  } finally {
    scratch.remove();
  }
  if (!a || !b) return null;
  const pairs = pairRings(a, b, boxes.from, boxes.to, aligner);
  const el = document.createElementNS(SVGNS, 'g');
  el.setAttribute('fill', source.getAttribute('fill') ?? 'currentColor');
  const path = document.createElementNS(SVGNS, 'path');
  el.append(path);
  let last = Number.NaN;
  return {
    el,
    draw(mix) {
      if (mix === last) return;
      last = mix;
      path.setAttribute('d', pathAt(pairs, mix));
    },
  };
}
