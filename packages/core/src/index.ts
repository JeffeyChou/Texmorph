export type * from './types.ts';
export { DIAGNOSTIC_CODES } from './types.ts';
export { EASING_NAMES, parseEasing, resolveEasing, validateEasing, type EasingFunction } from './easing.ts';
export { matchTokens, normalizeMorphMap, type NormalizeMorphMapResult, type MatchResult } from './match.ts';
export { createCrossfadePlan, createMorphPlan, DEFAULTS, reversePlan, unionBox, validateSnapshot } from './plan.ts';
export { sampleMorph } from './sample.ts';

export function clamp01(value: number): number {
  if (Number.isNaN(value)) throw new RangeError('progress must not be NaN');
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}
