---
'@texmorph/mathjax': minor
---

`mathjaxRenderer({ textFont: 'inherit' })` draws `\text{}` in the font of the element the formula is rendered into (MathJax `mtextInheritFont`) instead of the math font, waits for that font's faces before measuring, and gives ghosts the same font. With a non-default font or text font, `renderer.version` carries a build suffix such as `4.1.3+stix2`, so formulas rendered with other settings are re-rendered instead of reused.
