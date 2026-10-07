# Script tag

`@texmorph/katex` also ships a self-contained browser build, `dist/texmorph.iife.js`. It defines a global `Texmorph` and bundles core, dom and the KaTeX renderer; KaTeX itself is loaded separately.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css" />
<script src="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@texmorph/katex/dist/texmorph.iife.js"></script>

<div id="formula"></div>
<input id="t" type="range" min="0" max="1" step="0.001" value="0" />

<script>
  Texmorph.createMorph(
    document.getElementById('formula'),
    { latex: 'a^2 + b^2 = c^2', displayMode: true },
    { latex: 'c^2 = a^2 + b^2', displayMode: true },
    { katex: window.katex },
  ).then((morph) => {
    document.getElementById('t').addEventListener('input', (e) => morph.render(e.target.valueAsNumber));
  });
</script>
```

The result:

<ClientOnly>
  <MorphDemo :steps="['a^2 + b^2 = c^2', 'c^2 = a^2 + b^2']" :renderers="['katex']" />
</ClientOnly>

The global exposes `createMorph`, `katexRenderer`, `renderFormula`, `MorphPrepareError`, `TexMorphLifecycleError`, `parseEasing`, `resolveEasing`, `reversePlan` and `sampleMorph`. Pin a version in production URLs.
