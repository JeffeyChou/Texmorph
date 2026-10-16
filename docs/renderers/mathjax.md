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

<ClientOnly>
  <MorphDemo :steps="['\\int_0^1 x\\,dx', '\\left[\\frac{x^2}{2}\\right]_0^1']" :renderers="['mathjax']" />
</ClientOnly>

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
| `font` | Math font: `newcm` (default), `stix2`, `termes` or `pagella`, imported from `@texmorph/mathjax/fonts/<name>`. See [Fonts](#fonts). |
| `textFont` | `'inherit'` draws `\text{}` in the font of the surrounding page instead of the math font. Default `'math'`. |
| `loadFont` | `(range) => Promise` that loads a font range from your own location. It must evaluate the matching `@mathjax/mathjax-<font>-font/js/svg/dynamic/<range>.js` module. |

`createMorph(..., { mathjax: { ... } })` creates a renderer with these options. Without `renderer` or `mathjax`, one shared default renderer is used. Per-render option: `rendererOptions: { containerWidth }` (CSS px used for percentage widths).

## Static formulas

To show a formula without morphing it, render it with `renderFormula`. It renders the same way a morph does, so the result can later start a morph ([Chaining steps](/guide/chaining-steps)).

```ts
import { mathjaxRenderer, renderFormula } from '@texmorph/mathjax';

const renderer = mathjaxRenderer();
const shown = await renderFormula(renderer, container, { latex: String.raw`e^{i\pi} + 1 = 0` });
```

`renderFormula` waits for `renderer.ready()` and appends a new element to `container`. Reuse one renderer for many formulas.

## Fonts

The base font tables load with the renderer. Additional ranges (accented Latin, Greek variants, arrows, …; about 40 for newcm) are imported lazily, each as its own chunk, the first time a formula needs one. `loadFont` is page-global per font: the most recently created renderer that sets it for that font wins.

### Choosing a font

New Computer Modern (`newcm`) is the default and looks like LaTeX. Its thin strokes look light next to most web text, so pick the math font that matches the body text around your formulas:

| Font | Import | Pairs with |
|---|---|---|
| New Computer Modern | built in, or `@texmorph/mathjax/fonts/newcm` | Computer Modern, Latin Modern; documents that should look like LaTeX |
| STIX Two | `@texmorph/mathjax/fonts/stix2` | Times-like and modern serif text: STIX Two Text, Times, Source Serif |
| TeX Gyre Termes | `@texmorph/mathjax/fonts/termes` | Times, Nimbus Roman; a slightly heavier Times |
| TeX Gyre Pagella | `@texmorph/mathjax/fonts/pagella` | Palatino, Book Antiqua, other humanist serifs |

```sh
npm install @mathjax/mathjax-stix2-font
```

```ts
import { createMorph, mathjaxRenderer } from '@texmorph/mathjax';
import { stix2 } from '@texmorph/mathjax/fonts/stix2';

const renderer = mathjaxRenderer({ font: stix2, textFont: 'inherit' });
const morph = await createMorph(container, from, to, { renderer });
```

Only the fonts you import are bundled. Formulas from renderers with different fonts can share a page.

### Text in formulas

`\text{}` is drawn with the math font by default, so words in a formula look different from the sentence around it. `textFont: 'inherit'` draws them as SVG text in the font of the element the formula is rendered into; `\textbf` and `\textit` use its bold and italic faces. The renderer waits for those faces to load before it measures. Inherited text varies with the page font, so pin the font (local files, `@font-face`) when output must be identical across machines.

### Bundlers

MathJax must load as native ESM: with Vite, list `@mathjax/src` and every `@mathjax/mathjax-*-font` package you use in `optimizeDeps.exclude`. Pre-bundling one of them duplicates MathJax's classes and fails with errors such as `Cannot access 'SvgWrapper' before initialization`.

## Notes

- **Size**: MathJax sizes formulas in `ex` units of the host element, so the host font determines formula size. Pin the host font when you need identical output across machines.
- **Text outside the math font** (CJK, emoji) is drawn with a system font, so it varies by platform. All other geometry is computed by MathJax and is identical across browsers.
- **Token order** follows MathML (numerator before denominator, then base, subscript, superscript). Ink-less characters are skipped. `morphMap` indices therefore differ from KaTeX's.
- **Stylesheet**: the `mjx-container` stylesheet is injected into `document.head` on first render. For shadow roots, use `renderer.stylesheet()`.
- **Multiple instances**: element ids are namespaced per formula, so any number of formulas and morphs can share a page.
- **Outline morphing**: matched glyphs whose shapes differ morph their outlines ([details](/guide/how-it-works#outline-morphing)). The renderer imports `flubber` on first use; glyphs drawn with a system font (CJK, emoji) stretch and crossfade instead.
