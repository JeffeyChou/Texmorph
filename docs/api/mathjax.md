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
  loadFont?: (range: string) => Promise<unknown>;
  preloadFonts?: readonly string[];
}
```

| Option | Description |
|---|---|
| `packages` | TeX packages. Default `['base', 'ams', 'newcommand', 'color', 'cancel', 'boldsymbol']`. Unregistered packages, and `html`, `require` or `autoload`, throw a `TypeError`. |
| `macros` | Macro definitions; `[body, argumentCount]` for macros with arguments. |
| `loadFont` | Loads one dynamic newcm font range by name (e.g. `"latin-b"`). Page-global. |
| `preloadFonts` | Ranges to load in `ready()`. |

The renderer provides `stylesheet()` (the `mjx-container` CSS) for shadow roots and honors `AbortSignal` in `ready()` and `render()`.

## SafeMathJaxOptions

```ts
interface SafeMathJaxOptions {
  containerWidth?: number; // CSS px for percentage widths; default 80ex
}
```

Pass it as `rendererOptions`.
