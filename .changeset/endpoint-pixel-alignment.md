---
'@texmorph/dom': patch
'@texmorph/mathjax': patch
---

Fix a sub-pixel jump when the real formula hands over to the ghosts at the start and end of a morph on high-DPI screens. HTML ghosts are now positioned with `left`/`top`; MathJax formula and ghost-layer SVGs are placed on whole pixels.
