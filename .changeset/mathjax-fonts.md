---
'@texmorph/mathjax': minor
---

Selectable math fonts: `mathjaxRenderer({ font })` takes a font from `@texmorph/mathjax/fonts/<name>`: `newcm` (default), `stix2`, `termes` or `pagella`, each backed by its optional `@mathjax/mathjax-<name>-font` peer. Only imported fonts are bundled; each loads its dynamic ranges lazily, `loadFont` and `preloadFonts` apply to the chosen font, and renderers with different fonts can share a page. The package budget rises to 9.5 KB.
