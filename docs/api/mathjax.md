# @texmorph/mathjax

MathJax 4 (SVG output) renderer and the `createMorph` entry point. Re-exports the same `@texmorph/dom` members as `@texmorph/katex`.

## createMorph

```ts
function createMorph(
  host: HTMLElement,
  from: FormulaInput,
  to: FormulaInput,
  options?: MathMorphOptions<SafeMathJaxOptions> & {
    renderer?: FormulaRenderer<SafeMathJaxOptions>;
    mathjax?: MathJaxRendererOptions;
  },
): Promise<MathMorph>;
```

| Option | Description |
|---|---|
| `renderer` | A renderer from `mathjaxRenderer()`. Takes precedence over `mathjax`. |
| `mathjax` | Options for a new renderer created for this call. |
| (neither) | A shared default renderer is used. |

All other options are [`MathMorphOptions`](/api/dom#mathmorphoptions).

## mathjaxRenderer

```ts
function mathjaxRenderer(options?: MathJaxRendererOptions): FormulaRenderer<SafeMathJaxOptions>;

interface MathJaxRendererOptions {
  packages?: readonly string[];
  macros?: Readonly<Record<string, string | [string, number]>>;
  font?: MathJaxFont;
  textFont?: 'math' | 'inherit';
  loadFont?: (range: string) => Promise<unknown>;
  preloadFonts?: readonly string[];
}
```

| Option | Description |
|---|---|
| `packages` | TeX packages. Default `['base', 'ams', 'newcommand', 'color', 'cancel', 'boldsymbol']`. Unregistered packages, and `html`, `require` or `autoload`, throw a `TypeError`. |
| `macros` | Macro definitions; `[body, argumentCount]` for macros with arguments. |
| `font` | Math font from `@texmorph/mathjax/fonts/<name>`: `newcm` (default), `stix2`, `termes`, `pagella`. |
| `textFont` | `'math'` (default) draws `\text{}` with the math font; `'inherit'` uses the font of the element the formula is rendered into. |
| `loadFont` | Loads one dynamic range of the font by name (e.g. `"latin-b"`). Page-global per font. |
| `preloadFonts` | Ranges to load in `ready()`. |

With a font other than newcm or with `textFont: 'inherit'`, `renderer.version` carries a build suffix (`4.1.3+stix2`, `4.1.3+text`), so formulas rendered with different settings are re-rendered rather than reused in one morph.

The renderer provides `stylesheet()` (the `mjx-container` CSS) for shadow roots and honors `AbortSignal` in `ready()` and `render()`.

## Fonts

```ts
import { stix2 } from '@texmorph/mathjax/fonts/stix2'; // also newcm, termes, pagella

interface MathJaxFont {
  readonly name: string;
  readonly data: unknown; // the font's SVG font-data class
  readonly ranges: Readonly<Record<string, () => Promise<unknown>>>;
}
```

Each font module needs its MathJax package (`@mathjax/mathjax-<name>-font`, same version line as `@mathjax/src`). Only the fonts you import are bundled.

## SafeMathJaxOptions

```ts
interface SafeMathJaxOptions {
  containerWidth?: number; // CSS px for percentage widths; default 80ex
}
```

Pass it as `rendererOptions`.
