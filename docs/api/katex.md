# @texmorph/katex

KaTeX renderer and the `createMorph` entry point. Re-exports `renderFormula`, `MorphPrepareError`, `TexMorphLifecycleError` and the types `FormulaInput`, `FormulaRenderer`, `GhostLayer`, `LatexState`, `MathMorph`, `MathMorphOptions` and `RenderedFormula` from [`@texmorph/dom`](/api/dom).

## createMorph

```ts
function createMorph(
  host: HTMLElement,
  from: FormulaInput,
  to: FormulaInput,
  options?: MathMorphOptions<SafeKatexOptions> & { katex?: KatexLike },
): Promise<MathMorph>;
```

Renders and measures both formulas inside `host` and resolves with a prepared [`MathMorph`](/api/dom#mathmorph).

| Parameter | Description |
|---|---|
| `host` | Container element. The morph renders inside it. |
| `from`, `to` | A [`FormulaInput`](/api/dom#formulainput): `{ latex, displayMode? }`, a `RenderedFormula`, or `{ adopt, fallback? }`. |
| `options.katex` | The KaTeX module. If omitted, it is loaded with `import('katex')`. |
| `options` | All [`MathMorphOptions`](/api/dom#mathmorphoptions); `rendererOptions` takes `SafeKatexOptions`. |

Rejects with `MorphPrepareError` in strict mode or when an input cannot be adopted, and with `signal.reason` when aborted.

## katexRenderer

```ts
function katexRenderer(katex: KatexLike, defaults?: SafeKatexOptions): FormulaRenderer<SafeKatexOptions>;
```

Creates a reusable renderer for [`createMorphWith`](/api/dom#createmorphwith), [`renderFormula`](/api/dom#renderformula) and the integrations. `renderer.version` is `katex.version`. Rendering uses `output: 'htmlAndMathml'` and throws on parse errors.

## SafeKatexOptions

The subset of KaTeX options texmorph accepts:

```ts
interface SafeKatexOptions {
  trust?: (ctx: KatexTrustContext) => boolean;
  macros?: Record<string, string>;
  strict?: boolean | 'ignore' | 'warn' | 'error';
  maxSize?: number;
  maxExpand?: number;
  minRuleThickness?: number;
  colorIsTextColor?: boolean;
  fleqn?: boolean;
  leqno?: boolean;
  errorColor?: string;
  globalGroup?: boolean;
}

interface KatexTrustContext {
  command: string;
  url?: string;
  protocol?: string;
}
```

`trust` must be a function; `trust: true` throws a `TypeError`. `displayMode` is set per formula through `LatexState`, and `output` is fixed.

## KatexLike

```ts
interface KatexLike {
  readonly version: string;
  render(latex: string, element: HTMLElement, options?: Record<string, unknown>): void;
}
```

The minimal shape of the KaTeX module texmorph needs. The default export of the `katex` package satisfies it.
