# @texmorph/mathjax

## 0.2.0

### Minor Changes

- 1f65737: Selectable math fonts: `mathjaxRenderer({ font })` takes a font from `@texmorph/mathjax/fonts/<name>`: `newcm` (default), `stix2`, `termes` or `pagella`, each backed by its optional `@mathjax/mathjax-<name>-font` peer. Only imported fonts are bundled; each loads its dynamic ranges lazily, `loadFont` and `preloadFonts` apply to the chosen font, and renderers with different fonts can share a page. The package budget rises to 9.5 KB.
- 1f65737: `mathjaxRenderer({ textFont: 'inherit' })` draws `\text{}` in the font of the element the formula is rendered into (MathJax `mtextInheritFont`) instead of the math font, waits for that font's faces before measuring, and gives ghosts the same font. With a non-default font or text font, `renderer.version` carries a build suffix such as `4.1.3+stix2`, so formulas rendered with other settings are re-rendered instead of reused.

### Patch Changes

- 1f65737: `FormulaRenderer.render()` takes its options as an optional parameter, so callers no longer pass `undefined` explicitly. The MathJax docs describe static rendering with `renderFormula`.
- Updated dependencies [1f65737]
- Updated dependencies [1f65737]
- Updated dependencies [1f65737]
  - @texmorph/dom@0.2.0

## 0.1.0

### Minor Changes

- 07d2486: Initial release: seekable formula morphing with KaTeX and MathJax renderers, plus GSAP, Web Component and Remotion adapters.
- 17604ef: Outline morphing: with MathJax, a matched glyph whose shape changes (a delimiter growing around a fraction, a lengthening radical, an explicitly mapped `∑` → `∫`) now morphs as one outline instead of two stretched, crossfading copies. New options `shapes: 'auto' | 'always' | 'off'` (default `'auto'`) and `minFps` (default 50): `'auto'` switches to stretch-and-crossfade when playback stays below `minFps`. `<TexMorph>` defaults to `'always'`. Renderers can opt in with `loadShapes()` and `createShapeGhost()`; `GhostFrame` gains `mix`, `MathMorph` gains `shapes`, and the diagnostics `shape/unavailable` and `shape/fallback` are new. `@texmorph/mathjax` loads `flubber` on first use.

### Patch Changes

- c599936: Fix a sub-pixel jump when the real formula hands over to the ghosts at the start and end of a morph on high-DPI screens. HTML ghosts are now positioned with `left`/`top`; MathJax formula and ghost-layer SVGs are placed on whole pixels.
- Updated dependencies [c599936]
- Updated dependencies [07d2486]
- Updated dependencies [17604ef]
  - @texmorph/dom@0.1.0
  - @texmorph/core@0.1.0
