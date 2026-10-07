# Choosing a renderer

Per-frame cost is the same for both renderers: once prepared, a frame only moves ghosts. The renderers differ in how formulas are prepared and drawn.

| | KaTeX | MathJax 4 (SVG) |
|---|---|---|
| TeX coverage | Common mathematics | Broader (more packages and macros) |
| Prepare time | About a millisecond per formula | Slower; the first use of a font range loads it |
| Bundle | Small | Larger; font ranges load lazily |
| Geometry | Browser layout of HTML and CSS | Computed by MathJax; identical across browsers except for text outside the math font |
| Accessibility | MathML alongside the HTML | MathJax's SVG output with its own accessibility tree |
| Best for | Interactive pages, slide decks, small bundles | Broad TeX coverage, video export, identical output across browsers |

Both produce the same kind of plan, and every integration accepts either renderer. Token indices differ between them, so `morphMap` values are not portable.
