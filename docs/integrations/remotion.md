# Remotion

`@texmorph/remotion` renders morphs in [Remotion](https://www.remotion.dev) videos. Every frame is computed from its frame number alone, so concurrent rendering gives exactly the same output as serial rendering.

```sh
npm install @texmorph/remotion @texmorph/katex katex
```

```tsx
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { katexRenderer } from '@texmorph/katex';
import { TexMorph } from '@texmorph/remotion';
import { AbsoluteFill } from 'remotion';

const renderer = katexRenderer(katex);

export const QuadraticFormula = () => (
  <AbsoluteFill style={{ background: 'white', alignItems: 'center', justifyContent: 'center' }}>
    <TexMorph
      renderer={renderer}
      from={{ latex: String.raw`ax^2 + bx + c = 0`, displayMode: true }}
      to={{ latex: String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`, displayMode: true }}
      startFrame={10}
      durationInFrames={45}
      style={{ width: 900, fontSize: 48 }}
    />
  </AbsoluteFill>
);
```

The same transition, scrubbed here instead of by Remotion's frame counter:

<ClientOnly>
  <MorphDemo :steps="['ax^2 + bx + c = 0', 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}']" />
</ClientOnly>

## Props

| Prop | Description |
|---|---|
| `renderer` | Any renderer, e.g. `katexRenderer(katex)` or `mathjaxRenderer()`. Create it once, outside the component. |
| `from`, `to` | `{ latex, displayMode? }` |
| `durationInFrames` | Length of the morph in frames. |
| `startFrame` | First frame of the morph (default `0`). |
| `options` | Morph options such as `easing`, `morphMap`, `arc` (see [`MathMorphOptions`](/api/dom#mathmorphoptions)). `shapes` defaults to `'always'`, so outline morphing never falls back during an offline render. |
| `prepareTimeoutMs` | Bound on preparation (default 10 000). |
| `onReady` | Called with the `MathMorph` once it is prepared. |
| `className`, `style` | Applied to the container element. |

Progress is `clamp((frame - startFrame) / durationInFrames, 0, 1)`; `progressAt(frame, startFrame, durationInFrames)` computes the same value. Preparation runs inside `delayRender()`, so no frame is captured before fonts are loaded and measured.

## Rebuilding

The morph is rebuilt when `from`, `to`, `options` or the renderer change. Functions inside `options` (such as `progressMap`) and the renderer are compared by identity, so define them outside the component or memoize them; otherwise every render rebuilds the morph.

## Fonts

Video output depends on the fonts available in the rendering browser. Bundle the KaTeX CSS and fonts with your project. For MathJax, pin the host font, because MathJax sizes formulas in `ex` units.
