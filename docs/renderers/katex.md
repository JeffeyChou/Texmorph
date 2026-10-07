# KaTeX

`@texmorph/katex` morphs formulas rendered by [KaTeX](https://katex.org).

## Install

```sh
npm install @texmorph/katex katex
```

Supported KaTeX versions: `>=0.16.11 <0.20`.

## Usage

```ts
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { createMorph } from '@texmorph/katex';

const morph = await createMorph(
  container,
  { latex: String.raw`\frac{a}{b} + c`, displayMode: true },
  { latex: String.raw`c + \frac{a}{b}`, displayMode: true },
  { katex },
);
```

<ClientOnly>
  <MorphDemo :steps="['\\frac{a}{b} + c', 'c + \\frac{a}{b}']" :renderers="['katex']" />
</ClientOnly>

Passing `katex` is recommended. If it is omitted, `createMorph` loads it with a dynamic `import('katex')`, which your bundler resolves.

## Reusing a renderer

`createMorph` creates a renderer per call. To share configuration, or to call `renderFormula`, create one with `katexRenderer` and use it with `createMorphWith` from `@texmorph/dom`, or pass it to an integration:

```ts
import { katexRenderer, renderFormula } from '@texmorph/katex';
import { createMorphWith } from '@texmorph/dom';

const renderer = katexRenderer(katex, { macros: { '\\R': '\\mathbb{R}' } });
const shown = await renderFormula(renderer, container, { latex: 'f: \\R \\to \\R' });
const morph = await createMorphWith(renderer, container, shown, { latex: 'f(x) = x^2' });
```

## Options

`katexRenderer(katex, defaults)` and `createMorph(..., { rendererOptions })` accept a safe subset of KaTeX options (`SafeKatexOptions`): `macros`, `strict`, `maxSize`, `maxExpand`, `minRuleThickness`, `colorIsTextColor`, `fleqn`, `leqno`, `errorColor`, `globalGroup`, and `trust`.

- `displayMode` is set per formula (`{ latex, displayMode: true }`).
- `output` is always `htmlAndMathml`, so the MathML stays available to screen readers.
- `trust: true` is rejected. Pass a policy function instead:

```ts
katexRenderer(katex, { trust: ({ command }) => command === '\\htmlClass' });
```

- Parse errors reject the render; the morph then falls back to a crossfade, or rejects when `strict: true`.

## Notes

- Formulas are measured after `document.fonts.ready`. Load the KaTeX CSS before preparing a morph.
- texmorph wraps each grapheme of a rendered KaTeX formula in a `<span>`. The wrapping is kept after `dispose()` so the formula can be reused by the next morph.
- KaTeX inserts invisible zero-width characters after fractions, scripts and radicals. They are tokens too, which affects `morphMap` indices; see [Matching](/guide/matching#token-indices).
