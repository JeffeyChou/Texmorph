# How it works

A morph has three phases.

## 1. Prepare

`createMorph(container, from, to, options)`:

1. renders both formulas with the renderer (KaTeX or MathJax);
2. waits for fonts and measures every grapheme and every rule (fraction bars, radicals) once;
3. matches source tokens to target tokens ([details](/guide/matching));
4. builds an immutable, JSON-serializable **plan** that describes how every token moves.

All DOM measurement happens here. If something goes wrong, see [Errors and diagnostics](/guide/errors).

## 2. Render

`morph.render(t)` samples the plan at progress `t ∈ [0, 1]` and writes only position, `transform`, `opacity`, `color` and, for [outline morphs](#outline-morphing), path data to lightweight copies of the symbols ("ghosts"). It never reads layout, so:

- any `t` can be rendered at any time, in any order;
- rendering the same `t` twice produces identical pixels;
- many frames per second are cheap, typically well under a millisecond.

During a morph:

| Token | Motion |
|---|---|
| Matched (in both formulas) | Moves along a gentle arc and scales smoothly to its new size. |
| Matched, but its appearance changes (e.g. `x` → `\mathbf{x}`) | Moves the same way while crossfading between the two glyphs. |
| Removed (only in the source) | Fades out and shrinks. |
| Added (only in the target) | Fades in and grows, starting 30% of the way through. |
| Unmatched decorations | The source formula fades out underneath while the target fades in. |

At exactly `t = 0` and `t = 1` the real formulas are displayed instead of ghosts, so both ends are pixel-identical to a plain rendering.

### Outline morphing

With MathJax, a matched glyph whose shape changes is drawn as one outline that morphs from the source glyph into the target glyph, instead of two crossfading copies stretched to each other's size. Delimiters that grow around a fraction, radicals that lengthen and operators that switch between text and display size keep their stroke weight throughout. Explicitly mapped different glyphs (`morphMap` pairing `∑` with `∫`) melt into each other.

<ClientOnly>
  <MorphDemo :steps="['(x+y)', '\\left(\\frac{x}{y}\\right)', '\\left(\\frac{\\frac{x}{y}}{z}\\right)']" :renderers="['mathjax']" :duration="1200" />
</ClientOnly>

```ts
const morph = await createMorph(container, from, to, {
  shapes: 'auto',   // default; 'always' for video export, 'off' to stretch and crossfade
  minFps: 50,       // 'auto' only
});
```

With `'auto'`, the driver watches the display frame rate while the morph plays. If it stays below `minFps`, the morph switches to stretch-and-crossfade on the spot, reports a `shape/fallback` diagnostic, and later `'auto'` morphs on the page start without outline morphing. The [Remotion component](/integrations/remotion) uses `'always'`, since its frames are rendered offline.

Outline morphing loads [flubber](https://github.com/veltman/flubber) (about 20 KB gzipped) the first time it is needed. KaTeX draws glyphs with fonts rather than paths, so it always stretches and crossfades.

## 3. Dispose

`morph.dispose({ settle })` removes the ghosts and leaves one real formula in the container: the target by default, or the source with `settle: 'source'`. The settled formula can be reused as the start of the next morph ([Chaining steps](/guide/chaining-steps)).

## Resizing

Measurements are taken once. If the container size or fonts change, call `morph.refresh()`. It re-measures, rebuilds the plan and re-renders the last progress; until it finishes, `render()` keeps using the previous plan.

## Using plans directly

The planning layer is available without the DOM:

```ts
import { createMorphPlan, sampleMorph, reversePlan } from '@texmorph/core';

const plan = createMorphPlan(fromSnapshot, toSnapshot, { easing: 'easeOutCubic' });
const frame = sampleMorph(plan, 0.42);   // { ghosts, sourceLayerOpacity, targetLayerOpacity, ... }
const back = reversePlan(plan);          // sampleMorph(back, t) equals sampleMorph(plan, 1 - t)
```

`morph.plan` exposes the plan of a prepared morph. Plans are plain JSON and can be stored and sampled anywhere, including in Node.
