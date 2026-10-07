import { resolveEasing, type EasingFunction } from './easing.ts';
import type { FrameState, GhostFrame, MorphPlan, RGBA, Track } from './types.ts';

const easingCache = new WeakMap<MorphPlan, EasingFunction>();

function easingOf(plan: MorphPlan): EasingFunction {
  let fn = easingCache.get(plan);
  if (!fn) {
    fn = resolveEasing(plan.easing);
    easingCache.set(plan, fn);
  }
  return fn;
}

function clamp(value: number, lo: number, hi: number): number {
  return value <= lo ? lo : value >= hi ? hi : value;
}

const lerp = (a: number, b: number, e: number): number => a + (b - a) * e;

function lerpColor(a: RGBA, b: RGBA, e: number): RGBA {
  return {
    r: clamp(lerp(a.r, b.r, e), 0, 255),
    g: clamp(lerp(a.g, b.g, e), 0, 255),
    b: clamp(lerp(a.b, b.b, e), 0, 255),
    a: clamp(lerp(a.a, b.a, e), 0, 1),
  };
}

function sameColor(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export const MIN_NATIVE_SIZE = 1e-6;

function ratio(size: number, native: number): number {
  return native > MIN_NATIVE_SIZE ? Math.max(size, 0) / native : 1;
}

function easedAt(fn: EasingFunction, tau: number): number {
  if (tau <= 0) return 0;
  if (tau >= 1) return 1;
  return fn(tau);
}

function matchedFrames(track: Track, tau: number, e: number, out: GhostFrame[]): void {
  const { box: f, style: fs } = track.from;
  const { box: g, style: gs } = track.to;
  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (tau <= 0) {
    ({ x, y, width: w, height: h } = f);
  } else if (tau >= 1) {
    ({ x, y, width: w, height: h } = g);
  } else {
    const c = track.arc ?? { x: (f.x + g.x) / 2, y: (f.y + g.y) / 2 };
    const u = 1 - e;
    x = u * u * f.x + 2 * u * e * c.x + e * e * g.x;
    y = u * u * f.y + 2 * u * e * c.y + e * e * g.y;
    w = lerp(f.width, g.width, e);
    h = lerp(f.height, g.height, e);
  }
  const color = fs && gs && !sameColor(fs.color, gs.color) ? lerpColor(fs.color, gs.color, e) : undefined;
  const frame = (layer: 'source' | 'target', opacity: number): GhostFrame => {
    const native = layer === 'source' ? f : g;
    const ghost: GhostFrame = { trackId: track.id, layer, tx: x, ty: y, sx: ratio(w, native.width), sy: ratio(h, native.height), opacity };
    if (color) ghost.color = color;
    return ghost;
  };
  if (track.appearance === 'same') {
    out.push(frame('source', 1));
  } else {
    out.push(frame('source', clamp(1 - e, 0, 1)), frame('target', clamp(e, 0, 1)));
  }
}

function fadeFrame(track: Track, tau: number, e: number, fn: EasingFunction): GhostFrame {
  const [start, end] = track.opacity.window;
  let p: number;
  if (track.opacity.param === 'global') {
    p = e;
  } else if (tau >= 1) {
    p = 1;
  } else {
    p = easedAt(fn, clamp((tau - start) / (end - start), 0, 1));
  }
  const scale = track.scale ? lerp(track.scale.from, track.scale.to, p) : 1;
  const box = track.from.box;
  return {
    trackId: track.id,
    layer: track.kind === 'added' ? 'target' : 'source',
    tx: box.x,
    ty: box.y,
    sx: Math.max(scale, 0),
    sy: Math.max(scale, 0),
    opacity: clamp(lerp(track.opacity.from, track.opacity.to, p), 0, 1),
  };
}

export function sampleMorph(plan: MorphPlan, t: number): FrameState {
  if (Number.isNaN(t)) throw new RangeError('progress must not be NaN');
  const clamped = clamp(t, 0, 1);
  const tau = plan.direction === 'forward' ? clamped : 1 - clamped;
  const fn = easingOf(plan);
  const e = easedAt(fn, tau);
  const ghosts: GhostFrame[] = [];
  for (const track of plan.tracks) {
    if (track.kind === 'matched') matchedFrames(track, tau, e, ghosts);
    else if (track.kind !== 'root') ghosts.push(fadeFrame(track, tau, e, fn));
  }
  const fade = clamp(e, 0, 1);
  const state: FrameState = {
    t: clamped,
    eased: e,
    ghosts,
    sourceLayerOpacity: 1 - fade,
    targetLayerOpacity: fade,
  };
  if (plan.mode === 'crossfade') state.rootOpacity = { source: 1 - fade, target: fade };
  if (tau <= 0) state.settled = 'source';
  else if (tau >= 1) state.settled = 'target';
  return state;
}
