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
};
```

Then use it with `createMorphWith(renderer, container, from, to, options)`, or pass it to any integration.

## Requirements

- **Snapshots.** `render`, `adopt` and `resnapshot` return a `RenderedFormula` whose `snapshot` lists tokens with dense indices: text tokens first in reading order, then structure tokens. Boxes are relative to the formula root, in CSS pixels, and corrected for any CSS transform on ancestors.
- **visualKey.** Two tokens with equal `visualKey` must look identical when one is scaled to the other's box. Include anything that changes the drawing, such as font, weight, variant, or the path of a stretched shape.
- **Failure.** When a formula cannot be measured, return an empty snapshot with an `error` diagnostic and leave the root in place; the driver then crossfades. Do not report an error for a legitimately empty formula.
- **Ghosts.** `createGhost` must look the token up by `token.index` in the renderer's own data; it must not trust the box of the token object it receives.
- **Ghost layer writes.** `GhostLayer.place()` may set a ghost's size and transform origin when they change, which in practice happens once during prepare. Every later call may write only transform, opacity and color. Rendering must never read layout.
- **Stage.** Ghost-layer coordinates are relative to the stage element passed to `createGhostLayer`. For HTML ghosts, `createHtmlGhostLayer` and `placeHtmlGhost` from `@texmorph/dom` implement all of this.

The [`@texmorph/core` API](/api/core) documents the snapshot types.
