import { describe, expect, it } from 'vitest';
import { createMorphPlan, sampleMorph, type FormulaSnapshot, type MathToken } from '../src/index.ts';

function snap(glyphs: Array<[string, string]>): FormulaSnapshot {
  const tokens: MathToken[] = glyphs.map(([text, visualKey], index) => ({
    id: `t${index}`,
    kind: 'text',
    index,
    text,
    role: 'ord',
    script: 0,
    context: [],
    visualKey,
    box: { x: index * 10, y: 0, width: 10, height: 10 },
    style: { color: { r: 0, g: 0, b: 0, a: 1 }, fontSize: 16 },
  }));
  return { renderer: { name: 't', version: '0' }, tokens, bounds: { x: 0, y: 0, width: 100, height: 10 }, em: 16 };
}

describe('mix on ghost frames', () => {
  const plan = () => createMorphPlan(snap([['x', 'x:it'], ['(', 'paren:small']]), snap([['x', 'x:it'], ['(', 'paren:big']]), { easing: 'linear' });

  it('carries the eased progress on both layers of a pair whose glyphs differ', () => {
    const frame = sampleMorph(plan(), 0.3);
    const changed = frame.ghosts.filter((g) => g.trackId === 'm1-1');
    expect(changed.map((g) => [g.layer, g.mix])).toEqual([['source', 0.3], ['target', 0.3]]);
    expect(changed[0]?.opacity).toBeCloseTo(0.7);
  });

  it('is absent on unchanged glyphs', () => {
    const same = sampleMorph(plan(), 0.3).ghosts.find((g) => g.trackId === 'm0-0');
    expect(same).toBeDefined();
    expect(same && 'mix' in same).toBe(false);
  });

  it('follows the plan direction and reaches the endpoints', () => {
    const p = plan();
    expect(sampleMorph(p, 0).ghosts.find((g) => g.trackId === 'm1-1')?.mix).toBe(0);
    expect(sampleMorph(p, 1).ghosts.find((g) => g.trackId === 'm1-1')?.mix).toBe(1);
    const reversed = { ...p, direction: 'reverse' as const };
    expect(sampleMorph(reversed, 0.25).ghosts.find((g) => g.trackId === 'm1-1')?.mix).toBeCloseTo(0.75);
  });

  it('keeps overshoot that opacity clamps away', () => {
    const elastic = createMorphPlan(snap([['(', 'a']]), snap([['(', 'b']]), { easing: 'easeOutElastic' });
    const mixes = Array.from({ length: 99 }, (_, i) => sampleMorph(elastic, (i + 1) / 100).ghosts[0]?.mix ?? 0);
    expect(Math.max(...mixes)).toBeGreaterThan(1);
    for (const g of sampleMorph(elastic, 0.2).ghosts) expect(g.opacity).toBeLessThanOrEqual(1);
  });
});
