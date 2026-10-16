---
'@texmorph/dom': patch
'@texmorph/mathjax': patch
---

`FormulaRenderer.render()` takes its options as an optional parameter, so callers no longer pass `undefined` explicitly. The MathJax docs describe static rendering with `renderFormula`.
