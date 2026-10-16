# @texmorph/dom

## 0.2.0

### Minor Changes

- 1f65737: `shapes` now defaults to `'always'`, so `render(t)` depends on `t` alone in every host: live playback, scrubbing and offline frame-by-frame rendering draw the same frame for the same progress. `'auto'`, which measures the display frame rate and falls back to stretch-and-crossfade on slow devices, is now opt-in for live pages. `<TexMorph>` no longer overrides the default.

### Patch Changes

- 1f65737: `FormulaRenderer.render()` takes its options as an optional parameter, so callers no longer pass `undefined` explicitly. The MathJax docs describe static rendering with `renderFormula`.
- 1f65737: The morph stage no longer sets `visibility: visible` once it is ready; it inherits, so a morph inside a hidden ancestor (an inactive slide or scene) stays hidden.

## 0.1.0

### Minor Changes

- 07d2486: Initial release: seekable formula morphing with KaTeX and MathJax renderers, plus GSAP, Web Component and Remotion adapters.
- 17604ef: Outline morphing: with MathJax, a matched glyph whose shape changes (a delimiter growing around a fraction, a lengthening radical, an explicitly mapped `∑` → `∫`) now morphs as one outline instead of two stretched, crossfading copies. New options `shapes: 'auto' | 'always' | 'off'` (default `'auto'`) and `minFps` (default 50): `'auto'` switches to stretch-and-crossfade when playback stays below `minFps`. `<TexMorph>` defaults to `'always'`. Renderers can opt in with `loadShapes()` and `createShapeGhost()`; `GhostFrame` gains `mix`, `MathMorph` gains `shapes`, and the diagnostics `shape/unavailable` and `shape/fallback` are new. `@texmorph/mathjax` loads `flubber` on first use.

### Patch Changes

- c599936: Fix a sub-pixel jump when the real formula hands over to the ghosts at the start and end of a morph on high-DPI screens. HTML ghosts are now positioned with `left`/`top`; MathJax formula and ghost-layer SVGs are placed on whole pixels.
- Updated dependencies [07d2486]
- Updated dependencies [17604ef]
  - @texmorph/core@0.1.0
