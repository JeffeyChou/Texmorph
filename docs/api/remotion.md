# @texmorph/remotion

Peer dependencies: `remotion` `^4.0.0`, `react` `>=18`.

```ts
function TexMorph(props: TexMorphProps): ReactElement;

interface TexMorphProps {
  from: LatexState;
  to: LatexState;
  renderer: FormulaRenderer;
  durationInFrames: number;
  startFrame?: number;                          // default 0
  options?: Omit<MathMorphOptions, 'signal'>;
  prepareTimeoutMs?: number;                    // default 10000
  onReady?: (morph: MathMorph) => void;
  className?: string;
  style?: CSSProperties;
}

function progressAt(frame: number, startFrame: number, durationInFrames: number): number;
function dependencyKey(from: LatexState, to: LatexState, renderer: FormulaRenderer, options: object | undefined): string;
```

| Export | Description |
|---|---|
| `TexMorph` | Renders a morph at the current Remotion frame. Preparation is wrapped in `delayRender`; failures call `cancelRender`. |
| `progressAt` | `clamp((frame - startFrame) / durationInFrames, 0, 1)`; non-positive durations jump to 1 at `startFrame`. |
| `dependencyKey` | The key that decides when `TexMorph` rebuilds its morph. Functions and the renderer are keyed by object identity, so the key is only meaningful within one JavaScript realm. |

See [Remotion integration](/integrations/remotion).
