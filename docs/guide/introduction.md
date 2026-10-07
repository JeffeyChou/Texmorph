# What is texmorph?

texmorph animates one rendered formula into another: symbols that appear in both formulas fly to their new positions, symbols that disappear fade out, and new ones fade in.

```
x² + y² = z²   ──▶   x² = z² − y²
```

Unlike most animation libraries, texmorph **does not own a clock**. A morph is prepared once, and after that any frame is produced by calling `render(t)` with a progress value between 0 and 1. The same `t` always gives the same picture, regardless of which frames were rendered before. This makes texmorph a good fit for:

- slide decks and step-by-step derivations, where the host controls timing and navigation;
- scroll- or slider-driven explanations, where users scrub back and forth;
- timeline tools such as GSAP, where a tween drives progress;
- video export, where frames are rendered out of order or in parallel (Remotion, headless browsers).

## Packages

| Package | Use it for |
|---|---|
| [`@texmorph/katex`](/renderers/katex) | Morphing formulas rendered with KaTeX. Includes `createMorph()` and a script-tag build. |
| [`@texmorph/mathjax`](/renderers/mathjax) | Morphing formulas rendered with MathJax 4 (SVG output). |
| [`@texmorph/gsap`](/integrations/gsap) | Driving a morph from GSAP tweens and timelines. |
| [`@texmorph/element`](/integrations/web-component) | A `<tex-morph>` custom element. |
| [`@texmorph/remotion`](/integrations/remotion) | A `<TexMorph>` component for Remotion videos. |
| [`@texmorph/dom`](/api/dom) | The renderer-agnostic DOM driver (used by the packages above; needed when writing your own renderer). |
| [`@texmorph/core`](/api/core) | Pure planning and sampling with no DOM dependency. |

Most applications install exactly one renderer package (`@texmorph/katex` or `@texmorph/mathjax`) and, optionally, one integration.

## Browser support

The current versions of Chrome, Edge, Firefox and Safari (desktop and mobile). `Intl.Segmenter` is required.
