import { describe, expect, it } from 'vitest';
import { normalizeMorphMap, type FormulaSnapshot, type MathToken } from '../src/index.ts';

function snap(kinds: Array<'text' | 'structure'>): FormulaSnapshot {
  const tokens: MathToken[] = kinds.map((kind, index) => ({
    id: `t${index}`, kind, index, text: kind === 'text' ? 'x' : '', role: kind === 'text' ? 'ord' : 'frac-bar',
    script: 0, context: [], visualKey: 'k', box: { x: index * 10, y: 0, width: 10, height: 10 },
    style: { color: { r: 0, g: 0, b: 0, a: 1 }, fontSize: 16 },
  }));
  return { renderer: { name: 't', version: '0' }, tokens, bounds: { x: 0, y: 0, width: 10 * kinds.length, height: 10 }, em: 16 };
}

const from = snap(['text', 'text', 'text', 'structure']);
const to = snap(['text', 'text', 'text', 'structure']);
const pairs = (r: ReturnType<typeof normalizeMorphMap>) => r.pairs.map((p) => [p.source, p.target]);
const codes = (r: ReturnType<typeof normalizeMorphMap>) => r.diagnostics.map((d) => d.code);

describe('normalizeMorphMap', () => {
  it('accepts all three legacy forms', () => {
    expect(pairs(normalizeMorphMap({ 0: 1, 1: 0 }, from, to))).toEqual([[0, 1], [1, 0]]);
    expect(pairs(normalizeMorphMap([[0, 1], [1, 0]], from, to))).toEqual([[0, 1], [1, 0]]);
    expect(pairs(normalizeMorphMap([{ source: 0, target: 1 }, { source: 1, target: 0 }], from, to))).toEqual([[0, 1], [1, 0]]);
  });

  it('lets a later entry for the same source win, in first-insertion order', () => {
    expect(pairs(normalizeMorphMap([[0, 1], [2, 2], [0, 0]], from, to))).toEqual([[0, 0], [2, 2]]);
  });

  it('keeps the first claimant of a target', () => {
    const r = normalizeMorphMap([[0, 1], [2, 1]], from, to);
    expect(pairs(r)).toEqual([[0, 1]]);
    expect(codes(r)).toEqual(['map/duplicate']);
  });

  it('reports invalid, out-of-range and kind-mismatch entries', () => {
    const r = normalizeMorphMap([[0, 9], [-1, 0], [1.5, 0], [0, 3]] as never, from, to);
    expect(pairs(r)).toEqual([]);
    expect(codes(r)).toEqual(['map/invalid', 'map/invalid', 'map/kind-mismatch']);
    expect(codes(normalizeMorphMap([[7, 0]], from, to))).toEqual(['map/out-of-range']);
  });

  it('flags structure indices', () => {
    const r = normalizeMorphMap([[3, 3]], from, to);
    expect(pairs(r)).toEqual([[3, 3]]);
    expect(codes(r)).toEqual(['map/structure-index']);
  });
});
