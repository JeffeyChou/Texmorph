# @texmorph/dom

The renderer-agnostic DOM driver. Applications usually reach it through `@texmorph/katex` or `@texmorph/mathjax`; use it directly with a shared or custom renderer.

## createMorphWith

```ts
function createMorphWith<Opts>(
  renderer: FormulaRenderer<Opts>,
  host: HTMLElement,
  from: FormulaInput,
  to: FormulaInput,
  options?: MathMorphOptions<Opts>,
): Promise<MathMorph>;
```

Prepares a morph with any renderer. The renderer packages' `createMorph` functions are thin wrappers around it.

## renderFormula

```ts
function renderFormula<Opts>(
  renderer: FormulaRenderer<Opts>,
  host: HTMLElement,
  state: LatexState,
  opts?: Opts,
  signal?: AbortSignal,
): Promise<RenderedFormula>;
```

Renders a single formula into `host`, exactly as a morph would. The result can be passed as `from` to a later morph without rendering again.

## MathMorph

```ts
interface MathMorph {
  readonly duration: number;
  readonly plan: MorphPlan;
  readonly diagnostics: readonly MorphDiagnostic[];
  readonly state: 'ready' | 'refreshing' | 'disposed';
  readonly target: RenderedFormula;
  readonly shapes: boolean;
  render(progress: number): void;
  refresh(): Promise<MorphPlan>;
  dispose(options?: { settle?: 'source' | 'target' }): void;
}
```

| Member | Description |
|---|---|
| `render(progress)` | Draws the frame for `progress`. Values are clamped to `[0, 1]`; `NaN` throws `RangeError`. Reads no layout. At exactly 0 and 1 the real formulas are shown. |
| `refresh()` | Re-measures both formulas and rebuilds the plan, then re-renders the last progress. Until it settles, `render` uses the previous plan; a newer `refresh()` cancels an older one. On failure the previous state stays intact. |
| `dispose({ settle })` | Removes the morph and leaves the target (default) or source formula in the container. Idempotent; aborts pending work. |
| `duration` | `options.duration` or 800 ms. Metadata for your clock. |
| `plan` | The current plan (replaced by `refresh`). |
| `diagnostics` | Diagnostics from preparation and planning. |
| `target` | The target `RenderedFormula`, reusable as the next morph's `from`. Throws `TexMorphLifecycleError` after `dispose({ settle: 'source' })`. |
| `shapes` | Whether outlines are being morphed right now ([outline morphing](/guide/how-it-works#outline-morphing)). False when no glyph changes shape, on renderers without outlines, and after a frame-rate fallback. |

## MathMorphOptions

```ts
interface MathMorphOptions<Opts = unknown> extends Omit<PlanOptions, 'origins'> {
  duration?: number;
  strict?: boolean;
  signal?: AbortSignal;
  rendererOptions?: Opts;
  progressMap?: (t: number) => number;
  shapes?: 'auto' | 'always' | 'off';
  minFps?: number;
}
```

| Option | Default | Description |
|---|---|---|
| `easing` | `'easeInOutCubic'` | An [`EasingSpec`](/api/core#easingspec). |
| `morphMap` | none | Explicit token mapping ([guide](/guide/matching)). |
| `arc` | `0.2` | Path curvature of matched tokens. |
| `removed.endScale` | `0.7` | Final scale of removed tokens. |
| `added.startScale`, `added.start` | `0.7`, `0.3` | Initial scale and fade-in start of added tokens. |
| `duration` | `800` | Milliseconds; metadata only. |
| `strict` | `false` | Reject instead of falling back to a crossfade. |
| `signal` | none | Cancels preparation (and waiting for fonts). |
| `rendererOptions` | none | Passed to the renderer for both formulas. |
| `progressMap` | none | Applied to `progress` before sampling; use for custom easing functions. |
| `shapes` | `'auto'` | [Outline morphing](/guide/how-it-works#outline-morphing) for matched glyphs whose shapes differ. `'auto'` falls back to stretch-and-crossfade when playback drops below `minFps`; `'always'` never falls back (use it for video export); `'off'` disables it. |
| `minFps` | `50` | Frame rate below which `shapes: 'auto'` falls back. |

## FormulaInput

```ts
type FormulaInput = LatexState | RenderedFormula | { adopt: Element; fallback?: LatexState };

type LatexState = { latex: string; displayMode?: boolean; className?: string };
```

See [Chaining steps](/guide/chaining-steps#formula-inputs).

## RenderedFormula

```ts
interface RenderedFormula {
  readonly root: HTMLElement | SVGElement;
  readonly snapshot: FormulaSnapshot;
  readonly state: LatexState;
  readonly renderer: { readonly name: string; readonly version: string };
  readonly diagnostics: readonly MorphDiagnostic[];
}
```

## Errors

| Class | Thrown when |
|---|---|
| `MorphPrepareError` | Preparation fails in strict mode, or an input cannot be adopted. Has `diagnostics`. |
| `TexMorphLifecycleError` | `render`, `refresh` or `target` is used after the morph was disposed. |

## FormulaRenderer

```ts
interface FormulaRenderer<Opts = unknown> {
  readonly name: string;
  readonly version: string;
  ready?(signal?: AbortSignal): Promise<void>;
  render(container: HTMLElement, state: LatexState, opts: Opts | undefined, signal?: AbortSignal): Promise<RenderedFormula>;
  adopt?(el: Element, signal?: AbortSignal): Promise<RenderedFormula | null>;
  resnapshot(rendered: RenderedFormula): RenderedFormula;
  maskTokens(rendered: RenderedFormula): () => void;
  createGhostLayer(stage: HTMLElement, bounds: Box): GhostLayer;
  createGhost(token: MathToken, rendered: RenderedFormula): Element;
  stylesheet?(): CSSStyleSheet | string;
  loadShapes?(signal?: AbortSignal): Promise<void>;
  createShapeGhost?(source: Element, target: Element, track: Track): ShapeGhost | null;
  watchFrameRate?(minFps: number, onSlow: (fps: number) => void): FrameRateWatch;
}

interface FrameRateWatch {
  touch(): void;
  stop(): void;
}

interface ShapeGhost {
  readonly el: Element;
  draw(mix: number): void;
}

interface GhostLayer {
  readonly root: HTMLElement | SVGElement;
  add(ghost: Element): void;
  place(ghost: Element, frame: GhostFrame, track: Track): void;
  dispose(): void;
}
```

The contract a renderer implements; see [Writing a renderer](/renderers/custom).

## HTML ghost helpers

```ts
function createHtmlGhostLayer(stage: HTMLElement, bounds: Box): GhostLayer;
function placeHtmlGhost(ghost: HTMLElement, frame: GhostFrame, track: Track): void;
const DEFAULT_DURATION: 800;
```

A ready-made ghost layer for renderers whose ghosts are HTML elements.
