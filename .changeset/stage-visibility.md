---
'@texmorph/dom': patch
---

The morph stage no longer sets `visibility: visible` once it is ready; it inherits, so a morph inside a hidden ancestor (an inactive slide or scene) stays hidden.
