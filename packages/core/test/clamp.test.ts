import { describe, expect, it } from 'vitest';
import { clamp01 } from '../src/index.ts';

describe('clamp01', () => {
  it('clamps to [0, 1]', () => {
    expect(clamp01(-Infinity)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(Infinity)).toBe(1);
  });

  it('rejects NaN', () => {
    expect(() => clamp01(Number.NaN)).toThrow(RangeError);
  });
});
