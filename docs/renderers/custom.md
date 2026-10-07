# Writing a renderer

The DOM driver in `@texmorph/dom` works with any object that implements `FormulaRenderer`. The KaTeX and MathJax packages are two such implementations.

```ts
import type { FormulaRenderer } from '@texmorph/dom';

const renderer: FormulaRenderer<MyOptions> = {
  name: 'my-renderer',
  version: '1.0.0',
  async ready(signal) { /* wait for fonts or other resources */ },
  async render(container, state, opts, signal) { /* render state.latex into container and measure it */ },
  async adopt(el, signal) { /* measure existing markup, or return null */ },
  resnapshot(rendered) { /* measure again; used by refresh() */ },
  maskTokens(rendered) { /* hide token elements; return a function that restores them */ },
  createGhostLayer(stage, bounds) { /* an element ghosts are placed in */ },
  createGhost(token, rendered) { /* an unpositioned copy of one token */ },
  stylesheet() { /* optional: CSS for shadow roots */ },
  async loadShapes(signal) { /* optional: load what outline morphing needs */ },
  createShapeGhost(source, target, track) { /* optional: one outline morph between two ghosts, or null */ },
  watchFrameRate(minFps, onSlow) { /* optional: frame-rate probe for shapes: 'auto' */ },
};
```

Then use it with `createMorphWith(renderer, container, from, to, options)`, or pass it to any integration.

## Requirements

- **Snapshots.** `render`, `adopt` and `resnapshot` return a `RenderedFormula` whose `snapshot` lists tokens with dense indices: text tokens first in reading order, then structure tokens. Boxes are relative to the formula root, in CSS pixels, and corrected for any CSS transform on ancestors.
- **visualKey.** Two tokens with equal `visualKey` must look identical when one is scaled to the other's box. Include anything that changes the drawing, such as font, weight, variant, or the path of a stretched shape.
- **Failure.** When a formula cannot be measured, return an empty snapshot with an `error` diagnostic and leave the root in place; the driver then crossfades. Do not report an error for a legitimately empty formula.
- **Ghosts.** `createGhost` must look the token up by `token.index` in the renderer's own data; it must not trust the box of the token object it receives.
- **Ghost layer writes.** `GhostLayer.place()` may set a ghost's size and transform origin when they change, which in practice happens once during prepare. Every later call may write only position (`left`/`top` for HTML ghosts), transform, opacity and color. Rendering must never read layout.
- **Pixel grid.** At `t = 0` and `t = 1` the real formula is shown; just after and before, the ghosts take over. Ghosts must land on exactly the pixels the real tokens occupy, or the formula visibly shifts by a fraction of a pixel on high-DPI screens. The HTML layer positions ghosts with `left`/`top` and drops the transform while a ghost is unscaled, so text follows the same pixel snapping as the real formula. The MathJax layer moves the formula `<svg>` and its ghost-layer `<svg>` onto whole pixels.
- **Outline morphing (optional).** For a matched track whose glyphs differ, the driver adds both ghosts to the layer, then calls `createShapeGhost(source, target, track)`. A returned `ShapeGhost` replaces the two ghosts: the driver hides them, adds `el` to the layer and places it like the source ghost at scale 1, after calling `draw(mix)` with the eased progress (0 = source glyph, 1 = target glyph; it can leave that range with overshooting easings). The outline is drawn in the source ghost's coordinates, so at `mix = 1` it must cover the target glyph as placed at the source ghost's origin. Return null to keep stretch-and-crossfade for that track. `loadShapes` is awaited once per morph before any `createShapeGhost`; if it rejects, the morph reports `shape/unavailable` and crossfades.
- **Frame-rate probe (optional).** Core and dom own no clock, so `shapes: 'auto'` asks the renderer to measure. The driver calls `watch.touch()` on every frame it draws between the endpoints and `watch.stop()` on dispose; the renderer calls `onSlow(fps)` once if playback stays below `minFps`, and the driver then switches to stretch-and-crossfade. Without `watchFrameRate`, `'auto'` behaves like `'always'`.
- **Stage.** Ghost-layer coordinates are relative to the stage element passed to `createGhostLayer`. For HTML ghosts, `createHtmlGhostLayer` and `placeHtmlGhost` from `@texmorph/dom` implement all of this.

The [`@texmorph/core` API](/api/core) documents the snapshot types.
