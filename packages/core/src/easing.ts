import type { EasingName, EasingSpec } from './types.ts';

export type EasingFunction = (t: number) => number;

const { PI, sin, cos, pow, sqrt, abs, exp } = Math;

function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

const named: Record<Exclude<EasingName, 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring'>, EasingFunction> = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2),
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - pow(1 - t, 4),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - pow(-2 * t + 2, 4) / 2),
  easeInExpo: (t) => (t === 0 ? 0 : pow(2, 10 * t - 10)),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - pow(2, -10 * t)),
  easeInOutExpo: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? pow(2, 20 * t - 10) / 2 : (2 - pow(2, -20 * t + 10)) / 2;
  },
  easeInElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return -pow(2, 10 * t - 10) * sin((t * 10 - 10.75) * ((2 * PI) / 3));
  },
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return pow(2, -10 * t) * sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1;
  },
  easeInOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? -(pow(2, 20 * t - 10) * sin((20 * t - 11.125) * ((2 * PI) / 4.5))) / 2
      : (pow(2, -20 * t + 10) * sin((20 * t - 11.125) * ((2 * PI) / 4.5))) / 2 + 1;
  },
  easeInBounce: (t) => 1 - easeOutBounce(1 - t),
  easeOutBounce,
  easeInOutBounce: (t) => (t < 0.5 ? (1 - easeOutBounce(1 - 2 * t)) / 2 : (1 + easeOutBounce(2 * t - 1)) / 2),
};

function spring(stiffness = 100, damping = 10, mass = 1): EasingFunction {
  const w0 = sqrt(stiffness / mass);
  const zeta = damping / (2 * sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * sqrt(1 - zeta * zeta);
    return (t) => 1 - exp(-zeta * w0 * t) * (cos(wd * t) + ((zeta * w0) / wd) * sin(wd * t));
  }
  return (t) => 1 - (1 + w0 * t) * exp(-w0 * t);
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  return (t) => {
    if (t === 0 || t === 1) return t;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const xs = ((ax * s + bx) * s + cx) * s - t;
      const dxs = (3 * ax * s + 2 * bx) * s + cx;
      if (abs(dxs) < 1e-7) break;
      s -= xs / dxs;
    }
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    return ((ay * s + by) * s + cy) * s;
  };
}

function steps(count: number, position: 'start' | 'end'): EasingFunction {
  return position === 'start' ? (t) => Math.ceil(t * count) / count : (t) => Math.floor(t * count) / count;
}

export const EASING_NAMES: readonly EasingName[] = [
  ...(Object.keys(named) as EasingName[]),
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'spring',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateEasing(spec: EasingSpec): void {
  if (typeof spec === 'string') {
    if (!EASING_NAMES.includes(spec)) throw new RangeError(`unknown easing "${spec}"`);
    return;
  }
  switch (spec.type) {
    case 'cubic-bezier':
      if (![spec.x1, spec.y1, spec.x2, spec.y2].every(isFiniteNumber)) throw new RangeError('cubic-bezier needs finite numbers');
      if (spec.x1 < 0 || spec.x1 > 1 || spec.x2 < 0 || spec.x2 > 1) throw new RangeError('cubic-bezier x1/x2 must be in [0, 1]');
      return;
    case 'steps':
      if (!Number.isInteger(spec.count) || spec.count < 1) throw new RangeError('steps count must be a positive integer');
      return;
    case 'spring':
      for (const value of [spec.stiffness, spec.damping, spec.mass]) {
        if (value !== undefined && (!isFiniteNumber(value) || value <= 0)) throw new RangeError('spring parameters must be positive');
      }
      return;
    default:
      throw new RangeError('unknown easing spec');
  }
}

export function resolveEasing(spec: EasingSpec = 'easeInOutCubic'): EasingFunction {
  validateEasing(spec);
  if (typeof spec === 'string') {
    switch (spec) {
      case 'ease':
      case 'ease-in-out':
        return named.easeInOutCubic;
      case 'ease-in':
        return named.easeInCubic;
      case 'ease-out':
        return named.easeOutCubic;
      case 'spring':
        return spring();
      default:
        return named[spec];
    }
  }
  switch (spec.type) {
    case 'cubic-bezier':
      return cubicBezier(spec.x1, spec.y1, spec.x2, spec.y2);
    case 'steps':
      return steps(spec.count, spec.position ?? 'end');
    case 'spring':
      return spring(spec.stiffness || 100, spec.damping || 10, spec.mass || 1);
  }
}

const STEPS = /^steps\(\s*(\d+)\s*(?:,\s*(start|end|jump-start|jump-end)\s*)?\)$/;
const BEZIER = /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/;

/** Parses the easing strings accepted by maliang-deck. Throws on unknown input. */
export function parseEasing(css: string): EasingSpec {
  const value = css.trim();
  if ((EASING_NAMES as readonly string[]).includes(value)) return value as EasingName;
  const stepsMatch = STEPS.exec(value);
  if (stepsMatch) {
    const position = stepsMatch[2]?.endsWith('start') ? 'start' : 'end';
    const spec: EasingSpec = { type: 'steps', count: Number(stepsMatch[1]), position };
    validateEasing(spec);
    return spec;
  }
  const bezier = BEZIER.exec(value);
  if (bezier) {
    const spec: EasingSpec = {
      type: 'cubic-bezier',
      x1: Number(bezier[1]),
      y1: Number(bezier[2]),
      x2: Number(bezier[3]),
      y2: Number(bezier[4]),
    };
    validateEasing(spec);
    return spec;
  }
  throw new RangeError(`unknown easing "${css}"`);
}
