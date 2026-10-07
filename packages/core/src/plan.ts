import { validateEasing } from './easing.ts';
import { matchTokens } from './match.ts';
import { MIN_NATIVE_SIZE } from './sample.ts';
import type {
  Box,
  EasingSpec,
  FormulaSnapshot,
  MathToken,
  MorphDiagnostic,
  MorphPlan,
  PlanOptions,
  Point,
  Track,
} from './types.ts';

export const DEFAULTS = {
  easing: 'easeInOutCubic',
  arc: 0.2,
  removedEndScale: 0.7,
  addedStartScale: 0.7,
  addedStart: 0.3,
} as const;

const ZERO: Point = { x: 0, y: 0 };

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
  return value;
}

function positive(value: number, name: string): number {
  if (finite(value, name) <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}

function checkPoint(p: Point, name: string): Point {
  return { x: finite(p.x, `${name}.x`), y: finite(p.y, `${name}.y`) };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function checkBox(box: Box, name: string): void {
  for (const key of ['x', 'y', 'width', 'height'] as const) finite(box[key], `${name}.${key}`);
  if (box.width < 0 || box.height < 0) throw new RangeError(`${name} has a negative size`);
}

/** Rejects snapshots that cannot be planned: non-finite or negative geometry, or indices that are not dense and unique. */
export function validateSnapshot(snapshot: FormulaSnapshot, name: string): void {
  checkBox(snapshot.bounds, `${name}.bounds`);
  const seen = new Set<number>();
  for (const token of snapshot.tokens) {
    if (!Number.isInteger(token.index) || token.index < 0 || token.index >= snapshot.tokens.length || seen.has(token.index)) {
      throw new RangeError(`${name} token indices must be dense and unique`);
    }
    seen.add(token.index);
    checkBox(token.box, `${name}.tokens[${token.index}].box`);
    finite(token.style.fontSize, `${name}.tokens[${token.index}].style.fontSize`);
    for (const c of ['r', 'g', 'b', 'a'] as const) finite(token.style.color[c], `${name}.tokens[${token.index}].style.color.${c}`);
  }
}

/** Orders tokens by index so results never depend on array order. */
function canonical(snapshot: FormulaSnapshot): FormulaSnapshot {
  return { ...snapshot, tokens: [...snapshot.tokens].sort((a, b) => a.index - b.index) };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function offset(box: Box, origin: Point): Box {
  return { x: box.x + origin.x, y: box.y + origin.y, width: box.width, height: box.height };
}

export function unionBox(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function arcControl(from: Box, to: Box, arc: number): Point {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { x: mx - dy * arc, y: my + dx * arc };
}

function zeroBoxDiagnostics(snapshot: FormulaSnapshot, side: 'source' | 'target'): MorphDiagnostic[] {
  return snapshot.tokens
    .filter((t: MathToken) => t.box.width <= MIN_NATIVE_SIZE || t.box.height <= MIN_NATIVE_SIZE)
    .map((t) => ({
      code: 'layout/zero-box' as const,
      severity: 'info' as const,
      message: `${side} token ${t.index} has a zero-size box; its scale on that axis stays 1`,
      detail: { side, index: t.index },
    }));
}

export function createMorphPlan(fromInput: FormulaSnapshot, toInput: FormulaSnapshot, options: PlanOptions = {}): MorphPlan {
  const easing: EasingSpec = options.easing ?? DEFAULTS.easing;
  validateEasing(easing);
  const arc = finite(options.arc ?? DEFAULTS.arc, 'arc');
  const endScale = positive(options.removed?.endScale ?? DEFAULTS.removedEndScale, 'removed.endScale');
  const startScale = positive(options.added?.startScale ?? DEFAULTS.addedStartScale, 'added.startScale');
  const start = finite(options.added?.start ?? DEFAULTS.addedStart, 'added.start');
  if (start < 0 || start >= 1) throw new RangeError('added.start must be in [0, 1)');
  const origins = {
    from: checkPoint(options.origins?.from ?? ZERO, 'origins.from'),
    to: checkPoint(options.origins?.to ?? ZERO, 'origins.to'),
  };

  validateSnapshot(fromInput, 'from');
  validateSnapshot(toInput, 'to');
  const from = canonical(clone(fromInput));
  const to = canonical(clone(toInput));
  const { matched, removed, added, diagnostics } = matchTokens(from, to, options.morphMap, origins);

  const tracks: Track[] = [];
  for (const pair of matched) {
    const a = from.tokens[pair.source] as MathToken;
    const b = to.tokens[pair.target] as MathToken;
    const fromBox = offset(a.box, origins.from);
    const toBox = offset(b.box, origins.to);
    const same = a.visualKey === b.visualKey;
    tracks.push({
      id: `m${pair.source}-${pair.target}`,
      kind: 'matched',
      subject: { type: 'token', source: pair.source, target: pair.target },
      from: { box: fromBox, style: a.style },
      to: { box: toBox, style: b.style },
      appearance: same ? 'same' : 'crossfade',
      visualKeys: { from: a.visualKey, to: b.visualKey },
      arc: arcControl(fromBox, toBox, arc),
      opacity: same ? { from: 1, to: 1, window: [0, 1], param: 'global' } : { from: 1, to: 0, window: [0, 1], param: 'global' },
      origin: 'top-left',
    });
  }
  for (const index of removed) {
    const a = from.tokens[index] as MathToken;
    const box = offset(a.box, origins.from);
    tracks.push({
      id: `r${index}`,
      kind: 'removed',
      subject: { type: 'token', source: index },
      from: { box, style: a.style },
      to: { box, style: a.style },
      appearance: 'same',
      opacity: { from: 1, to: 0, window: [0, 1], param: 'global' },
      scale: { from: 1, to: endScale },
      origin: 'center',
    });
  }
  for (const index of added) {
    const b = to.tokens[index] as MathToken;
    const box = offset(b.box, origins.to);
    tracks.push({
      id: `a${index}`,
      kind: 'added',
      subject: { type: 'token', target: index },
      from: { box, style: b.style },
      to: { box, style: b.style },
      appearance: 'same',
      opacity: { from: 0, to: 1, window: [start, 1], param: 'local' },
      scale: { from: startScale, to: 1 },
      origin: 'center',
    });
  }

  return deepFreeze({
    version: 1,
    mode: 'tokens',
    direction: 'forward',
    easing,
    from,
    to,
    origins,
    stage: unionBox(offset(from.bounds, origins.from), offset(to.bounds, origins.to)),
    matched,
    removed,
    added,
    tracks,
    diagnostics: [...diagnostics, ...zeroBoxDiagnostics(from, 'source'), ...zeroBoxDiagnostics(to, 'target')],
  } satisfies MorphPlan);
}

export function createCrossfadePlan(fromBounds: Box, toBounds: Box, options: Pick<PlanOptions, 'easing'> = {}): MorphPlan {
  const easing: EasingSpec = options.easing ?? DEFAULTS.easing;
  validateEasing(easing);
  for (const [box, name] of [[fromBounds, 'fromBounds'], [toBounds, 'toBounds']] as const) {
    finite(box.x, `${name}.x`);
    finite(box.y, `${name}.y`);
    finite(box.width, `${name}.width`);
    finite(box.height, `${name}.height`);
  }
  const root = (side: 'source' | 'target', box: Box): Track => ({
    id: `root-${side}`,
    kind: 'root',
    subject: { type: 'root', side },
    from: { box },
    to: { box },
    appearance: 'same',
    opacity: side === 'source' ? { from: 1, to: 0, window: [0, 1], param: 'global' } : { from: 0, to: 1, window: [0, 1], param: 'global' },
    origin: 'top-left',
  });
  return deepFreeze({
    version: 1,
    mode: 'crossfade',
    direction: 'forward',
    easing,
    from: null,
    to: null,
    origins: { from: ZERO, to: ZERO },
    stage: unionBox(fromBounds, toBounds),
    matched: [],
    removed: [],
    added: [],
    tracks: [root('source', clone(fromBounds)), root('target', clone(toBounds))],
    diagnostics: [{ code: 'fallback/crossfade', severity: 'warn', message: 'whole-formula crossfade' }],
  } satisfies MorphPlan);
}

export function reversePlan(plan: MorphPlan): MorphPlan {
  return deepFreeze({ ...clone(plan), direction: plan.direction === 'forward' ? 'reverse' : 'forward' });
}
