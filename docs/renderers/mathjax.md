# MathJax

`@texmorph/mathjax` morphs formulas rendered by [MathJax 4](https://www.mathjax.org) with SVG output.

## Install

```sh
npm install @texmorph/mathjax @mathjax/src @mathjax/mathjax-newcm-font
```

`@mathjax/src` `^4.1.3` is required. `@mathjax/mathjax-newcm-font` is optional, but strict package managers that do not hoist transitive dependencies (such as pnpm) need it to load font ranges lazily.

## Usage

```ts
import { createMorph } from '@texmorph/mathjax';

const morph = await createMorph(
  container,
  { latex: String.raw`\int_0^1 x\,dx`, displayMode: true },
  { latex: String.raw`\left[\frac{x^2}{2}\right]_0^1`, displayMode: true },
);
```

The renderer imports MathJax modules directly: TeX input, SVG output with a per-formula font cache. It does not use MathJax's component loader, a CDN or a global `MathJax` object.

## Configuring the renderer

```ts
import { createMorph, mathjaxRenderer } from '@texmorph/mathjax';

const renderer = mathjaxRenderer({
  packages: ['base', 'ams', 'newcommand', 'color', 'cancel', 'boldsymbol'],
  macros: { R: '\\mathbb{R}' },
  preloadFonts: ['latin'],
});

const morph = await createMorph(container, from, to, { renderer });
```

| Option | Description |
|---|---|
| `packages` | TeX packages to enable. Default: `base`, `ams`, `newcommand`, `color`, `cancel`, `boldsymbol`. For other packages, import their configuration module from `@mathjax/src/js/input/tex/...` first. `html`, `require` and `autoload` are rejected. |
| `macros` | Macro definitions, e.g. `{ R: '\\mathbb{R}' }` or `{ pair: ['(#1, #2)', 2] }`. |
| `preloadFonts` | Font ranges to load in `ready()`, before the first formula needs them. |
| `loadFont` | `(range) => Promise` that loads a font range from your own location. It must evaluate the matching `@mathjax/mathjax-newcm-font/js/svg/dynamic/<range>.js` module. |

`createMorph(..., { mathjax: { ... } })` creates a renderer with these options. Without `renderer` or `mathjax`, one shared default renderer is used. Per-render option: `rendererOptions: { containerWidth }` (CSS px used for percentage widths).

## Fonts

The base font tables load with the renderer. About 40 additional ranges (accented Latin, Greek variants, arrows, …) are imported lazily, each as its own chunk, the first time a formula needs one. `loadFont` is page-global: the most recently created renderer that sets it wins.

## Notes

- **Size**: MathJax sizes formulas in `ex` units of the host element, so the host font determines formula size. Pin the host font when you need identical output across machines.
- **Text outside the math font** (CJK, emoji) is drawn with a system font, so it varies by platform. All other geometry is computed by MathJax and is identical across browsers.
- **Token order** follows MathML (numerator before denominator, then base, subscript, superscript). Ink-less characters are skipped. `morphMap` indices therefore differ from KaTeX's.
- **Stylesheet**: the `mjx-container` stylesheet is injected into `document.head` on first render. For shadow roots, use `renderer.stylesheet()`.
- **Multiple instances**: element ids are namespaced per formula, so any number of formulas and morphs can share a page.
