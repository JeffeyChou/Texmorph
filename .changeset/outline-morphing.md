---
'@texmorph/core': minor
'@texmorph/dom': minor
'@texmorph/mathjax': minor
'@texmorph/remotion': minor
---

Outline morphing: with MathJax, a matched glyph whose shape changes (a delimiter growing around a fraction, a lengthening radical, an explicitly mapped `∑` → `∫`) now morphs as one outline instead of two stretched, crossfading copies. New options `shapes: 'auto' | 'always' | 'off'` (default `'auto'`) and `minFps` (default 50): `'auto'` switches to stretch-and-crossfade when playback stays below `minFps`. `<TexMorph>` defaults to `'always'`. Renderers can opt in with `loadShapes()` and `createShapeGhost()`; `GhostFrame` gains `mix`, `MathMorph` gains `shapes`, and the diagnostics `shape/unavailable` and `shape/fallback` are new. `@texmorph/mathjax` loads `flubber` on first use.
