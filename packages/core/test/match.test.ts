import { describe, expect, it } from 'vitest';
import { matchTokens, type ContextFrame, type FormulaSnapshot, type MathToken } from '../src/index.ts';

interface Spec {
  text?: string;
  kind?: 'text' | 'structure';
  role?: MathToken['role'];
  context?: ContextFrame[];
  x: number;
  y?: number;
}

function snap(specs: Spec[]): FormulaSnapshot {
  const tokens: MathToken[] = specs.map((s, index) => ({
    id: `t${index}`,
    kind: s.kind ?? 'text',
    index,
    text: s.kind === 'structure' ? '' : (s.text ?? 'x'),
    role: s.role ?? (s.kind === 'structure' ? 'frac-bar' : 'ord'),
    script: 0,
    context: s.context ?? [],
    visualKey: s.kind === 'structure' ? 'bar' : (s.text ?? 'x'),
    box: { x: s.x, y: s.y ?? 0, width: 10, height: 10 },
    style: { color: { r: 0, g: 0, b: 0, a: 1 }, fontSize: 16 },
  }));
  return { renderer: { name: 't', version: '0' }, tokens, bounds: { x: 0, y: 0, width: 200, height: 20 }, em: 16 };
}

const pairs = (r: ReturnType<typeof matchTokens>) => r.matched.map((p) => [p.source, p.target, p.reason]);

describe('matchTokens priority', () => {
  it('prefers an explicit pair over an exact match', () => {
    const from = snap([{ text: 'a', x: 0 }]);
    const to = snap([{ text: 'a', x: 0 }, { text: 'b', x: 50 }]);
    expect(pairs(matchTokens(from, to, [[0, 1]]))).toEqual([[0, 1, 'explicit']]);
  });

  it('prefers an exact match (same role and context) over a nearer same-glyph token', () => {
    const from = snap([{ text: 'x', role: 'ord', context: ['frac'], x: 0 }]);
    const to = snap([
      { text: 'x', role: 'ord', context: [], x: 0 },
      { text: 'x', role: 'ord', context: ['frac'], x: 100 },
    ]);
    expect(pairs(matchTokens(from, to))).toEqual([[0, 1, 'exact']]);
  });

  it('falls back to the same glyph in another context', () => {
    const from = snap([{ text: 'x', role: 'ord', context: ['script'], x: 0 }]);
    const to = snap([{ text: 'x', role: 'ord', context: [], x: 40 }]);
    expect(pairs(matchTokens(from, to))).toEqual([[0, 0, 'text']]);
  });

  it('matches structure tokens by role only, never by text fallback', () => {
    const from = snap([{ kind: 'structure', role: 'frac-bar', x: 0 }, { kind: 'structure', role: 'sqrt-sign', x: 20 }]);
    const to = snap([{ kind: 'structure', role: 'sqrt-sign', x: 0 }]);
    const r = matchTokens(from, to);
    expect(pairs(r)).toEqual([[1, 0, 'structure']]);
    expect(r.removed).toEqual([0]);
  });

  it('picks the nearest candidate, and the lower index on a tie', () => {
    const from = snap([{ text: 'a', x: 50 }]);
    expect(pairs(matchTokens(from, snap([{ text: 'a', x: 0 }, { text: 'a', x: 45 }])))).toEqual([[0, 1, 'exact']]);
    expect(pairs(matchTokens(from, snap([{ text: 'a', x: 40 }, { text: 'a', x: 60 }])))).toEqual([[0, 0, 'exact']]);
  });

  it('measures distance between stage positions using the origins', () => {
    const from = snap([{ text: 'a', x: 0 }]);
    const to = snap([{ text: 'a', x: 0 }, { text: 'a', x: 100 }]);
    const r = matchTokens(from, to, undefined, { from: { x: 100, y: 0 }, to: { x: 0, y: 0 } });
    expect(pairs(r)).toEqual([[0, 1, 'exact']]);
  });

  it('never matches a target twice and reports the leftovers', () => {
    const from = snap([{ text: 'a', x: 0 }, { text: 'a', x: 10 }, { text: 'b', x: 20 }]);
    const to = snap([{ text: 'a', x: 0 }, { text: 'c', x: 10 }]);
    const r = matchTokens(from, to);
    expect(pairs(r)).toEqual([[0, 0, 'exact']]);
    expect(r.removed).toEqual([1, 2]);
    expect(r.added).toEqual([1]);
  });

  it('does not let automatic matching take a target already claimed by the map', () => {
    const from = snap([{ text: 'a', x: 0 }, { text: 'b', x: 10 }]);
    const to = snap([{ text: 'a', x: 0 }]);
    const r = matchTokens(from, to, [[1, 0]]);
    expect(pairs(r)).toEqual([[1, 0, 'explicit']]);
    expect(r.removed).toEqual([0]);
  });
});
