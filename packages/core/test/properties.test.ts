import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createCrossfadePlan, createMorphPlan, EASING_NAMES, matchTokens, reversePlan, sampleMorph,
  type FormulaSnapshot, type FrameState, type MathToken,
} from '../src/index.ts';

const glyph = fc.constantFrom('x', 'y', '2', '+', '=', 'a');
const tokenArb = fc.record({
  text: glyph,
  x: fc.double({ min: -50, max: 400, noNaN: true }),
  y: fc.double({ min: -50, max: 100, noNaN: true }),
  w: fc.double({ min: 0, max: 40, noNaN: true }),
  h: fc.double({ min: 0, max: 40, noNaN: true }),
  ctx: fc.constantFrom<MathToken['context']>([], ['script'], ['frac', 'script'], ['sqrt']),
  bold: fc.boolean(),
  red: fc.boolean(),
});

const snapshotArb = fc.array(tokenArb, { maxLength: 12 }).map((list): FormulaSnapshot => ({
  renderer: { name: 'prop', version: '0' },
  tokens: list.map((t, index) => ({
    id: `t${index}`, kind: 'text', index, text: t.text, role: 'ord', script: 0, context: t.ctx,
    visualKey: `${t.text}${t.bold ? ':bf' : ''}`, box: { x: t.x, y: t.y, width: t.w, height: t.h },
    style: { color: t.red ? { r: 255, g: 0, b: 0, a: 1 } : { r: 0, g: 0, b: 0, a: 1 }, fontSize: 16 },
  })),
  bounds: { x: -50, y: -50, width: 500, height: 200 },
  em: 16,
}));

const easingArb = fc.constantFrom(...EASING_NAMES);
const tArb = fc.double({ min: -2, max: 3, noNaN: true });
const visual = (f: FrameState) => ({ ghosts: f.ghosts, s: f.sourceLayerOpacity, tl: f.targetLayerOpacity, r: f.rootOpacity });

describe('core properties', () => {
  it('sampling is pure and independent of call order', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, easingArb, fc.array(tArb, { minLength: 1, maxLength: 6 }), (a, b, easing, ts) => {
      const plan = createMorphPlan(a, b, { easing });
      const first = ts.map((t) => sampleMorph(plan, t));
      const again = [...ts].reverse().map((t) => sampleMorph(plan, t)).reverse();
      expect(again).toEqual(first);
    }));
  });

  it('repeats 0 → .7 → .2 → .7 exactly', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, (a, b) => {
      const plan = createMorphPlan(a, b);
      const seq = [0, 0.7, 0.2, 0.7].map((t) => sampleMorph(plan, t));
      expect(seq[3]).toEqual(seq[1]);
    }));
  });

  it('clamps infinities and rejects NaN', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, (a, b) => {
      const plan = createMorphPlan(a, b);
      expect(sampleMorph(plan, -Infinity)).toEqual(sampleMorph(plan, 0));
      expect(sampleMorph(plan, Infinity)).toEqual(sampleMorph(plan, 1));
      expect(() => sampleMorph(plan, Number.NaN)).toThrow(RangeError);
    }));
  });

  it('never matches many-to-one and is independent of input object identity', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, (a, b) => {
      const r = matchTokens(a, b);
      expect(new Set(r.matched.map((p) => p.target)).size).toBe(r.matched.length);
      expect(new Set(r.matched.map((p) => p.source)).size).toBe(r.matched.length);
      expect(r.matched.length + r.removed.length).toBe(a.tokens.length);
      expect(r.matched.length + r.added.length).toBe(b.tokens.length);
      expect(matchTokens(structuredClone(a), structuredClone(b))).toEqual(r);
    }));
  });

  it('hits endpoints exactly, including overshooting easings', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, easingArb, (a, b, easing) => {
      const plan = createMorphPlan(a, b, { easing });
      for (const [t, side] of [[0, 'from'], [1, 'to']] as const) {
        const frame = sampleMorph(plan, t);
        for (const g of frame.ghosts) {
          const track = plan.tracks.find((tr) => tr.id === g.trackId);
          if (track?.kind !== 'matched') continue;
          const box = track[side].box;
          expect(g.tx).toBe(box.x);
          expect(g.ty).toBe(box.y);
          const native = g.layer === 'source' ? track.from.box : track.to.box;
          if (native.width > 1e-6) expect(g.sx * native.width).toBeCloseTo(box.width, 9);
        }
        for (const g of frame.ghosts) {
          const kind = plan.tracks.find((tr) => tr.id === g.trackId)?.kind;
          if (kind === 'removed') expect(g.opacity).toBe(t === 0 ? 1 : 0);
          if (kind === 'added') expect(g.opacity).toBe(t === 0 ? 0 : 1);
        }
      }
    }));
  });

  it('keeps opacity in [0, 1] for every easing', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, easingArb, tArb, (a, b, easing, t) => {
      const frame = sampleMorph(createMorphPlan(a, b, { easing }), t);
      for (const g of frame.ghosts) {
        expect(g.opacity).toBeGreaterThanOrEqual(0);
        expect(g.opacity).toBeLessThanOrEqual(1);
        expect(g.sx).toBeGreaterThanOrEqual(0);
      }
    }));
  });

  it('survives a JSON round trip', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, easingArb, tArb, (a, b, easing, t) => {
      const plan = createMorphPlan(a, b, { easing });
      const copy = JSON.parse(JSON.stringify(plan));
      expect(sampleMorph(copy, t)).toEqual(sampleMorph(plan, t));
    }));
  });

  it('is not affected by later mutation of its inputs', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, tArb, (a, b, t) => {
      const input = structuredClone(a);
      const plan = createMorphPlan(input, b);
      const before = sampleMorph(plan, t);
      for (const tok of input.tokens) (tok.box as { x: number }).x += 1000;
      expect(sampleMorph(plan, t)).toEqual(before);
    }));
  });

  it('reverse plans retrace the forward path', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, fc.constantFrom('easeOutCubic', 'easeInExpo', 'spring'), fc.double({ min: -1, max: 1, noNaN: true }), tArb, (a, b, easing, arc, t) => {
      const plan = createMorphPlan(a, b, { easing: easing as never, arc });
      expect(visual(sampleMorph(reversePlan(plan), t))).toEqual(visual(sampleMorph(plan, 1 - Math.min(Math.max(t, 0), 1))));
    }));
    const fade = createCrossfadePlan({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 20, height: 10 }, { easing: 'easeInExpo' });
    expect(visual(sampleMorph(reversePlan(fade), 0.3))).toEqual(visual(sampleMorph(fade, 0.7)));
  });

  it('crossfades matched pairs whose visual keys differ', () => {
    const base: FormulaSnapshot = {
      renderer: { name: 'p', version: '0' },
      tokens: [{ id: 'a', kind: 'text', index: 0, text: 'x', role: 'ord', script: 0, context: [], visualKey: 'x', box: { x: 0, y: 0, width: 10, height: 10 }, style: { color: { r: 0, g: 0, b: 0, a: 1 }, fontSize: 16 } }],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      em: 16,
    };
    const bold: FormulaSnapshot = { ...base, tokens: [{ ...base.tokens[0] as MathToken, visualKey: 'x:bf', box: { x: 0, y: 0, width: 20, height: 10 } }] };
    const plan = createMorphPlan(base, bold, { easing: 'linear' });
    expect(plan.tracks[0]?.appearance).toBe('crossfade');
    const mid = sampleMorph(plan, 0.5);
    expect(mid.ghosts.map((g) => [g.layer, g.sx, g.opacity])).toEqual([['source', 1.5, 0.5], ['target', 0.75, 0.5]]);
  });

  it('places stage-relative boxes using origins and validates parameters', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, (a, b) => {
      const origins = { from: { x: 13, y: -7 }, to: { x: 40, y: 5 } };
      const plan = createMorphPlan(a, b, { origins });
      for (const tr of plan.tracks) {
        if (tr.kind !== 'matched' || tr.subject.type !== 'token') continue;
        const src = a.tokens[tr.subject.source as number] as MathToken;
        expect(tr.from.box.x).toBe(src.box.x + 13);
        expect(tr.from.box.y).toBe(src.box.y - 7);
      }
      expect(plan.from?.tokens[0]?.box).toEqual(JSON.parse(JSON.stringify(a.tokens[0]?.box ?? null)) ?? undefined);
    }));
    const s = { renderer: { name: 'p', version: '0' }, tokens: [], bounds: { x: 0, y: 0, width: 0, height: 0 }, em: 16 };
    expect(() => createMorphPlan(s, s, { arc: Number.NaN })).toThrow(RangeError);
    expect(() => createMorphPlan(s, s, { removed: { endScale: 0 } })).toThrow(RangeError);
    expect(() => createMorphPlan(s, s, { added: { start: 1 } })).toThrow(RangeError);
    expect(() => createMorphPlan(s, s, { easing: 'nope' as never })).toThrow(RangeError);
  });
});

describe('input canonicalization and validation', () => {
  it('matches and plans identically when token arrays are shuffled', () => {
    fc.assert(fc.property(snapshotArb, snapshotArb, fc.integer(), tArb, (a, b, seed, t) => {
      const shuffle = <T,>(list: readonly T[]): T[] => {
        const out = [...list];
        let s = seed >>> 0;
        for (let i = out.length - 1; i > 0; i--) {
          s = (Math.imul(s, 1103515245) + 12345) >>> 0;
          const j = s % (i + 1);
          [out[i], out[j]] = [out[j] as T, out[i] as T];
        }
        return out;
      };
      const a2 = { ...a, tokens: shuffle(a.tokens) };
      const b2 = { ...b, tokens: shuffle(b.tokens) };
      expect(matchTokens(a2, b2)).toEqual(matchTokens(a, b));
      expect(sampleMorph(createMorphPlan(a2, b2), t)).toEqual(sampleMorph(createMorphPlan(a, b), t));
    }));
  });

  it('rejects non-finite or negative geometry and non-dense indices', () => {
    const base: FormulaSnapshot = {
      renderer: { name: 'p', version: '0' },
      tokens: [{ id: 'a', kind: 'text', index: 0, text: 'x', role: 'ord', script: 0, context: [], visualKey: 'x', box: { x: 0, y: 0, width: 10, height: 10 }, style: { color: { r: 0, g: 0, b: 0, a: 1 }, fontSize: 16 } }],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      em: 16,
    };
    const withBox = (box: Partial<MathToken['box']>): FormulaSnapshot => ({ ...base, tokens: [{ ...(base.tokens[0] as MathToken), box: { ...(base.tokens[0] as MathToken).box, ...box } }] });
    for (const bad of [withBox({ width: Number.NaN }), withBox({ x: Infinity }), withBox({ width: -1 }), { ...base, tokens: [{ ...(base.tokens[0] as MathToken), index: 3 }] }]) {
      expect(() => createMorphPlan(bad, base)).toThrow(RangeError);
    }
    expect(() => createMorphPlan(withBox({ width: 0, height: 0 }), base)).not.toThrow();
  });
});
