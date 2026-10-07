# Getting started

## Install

::: code-group
```sh [npm]
npm install @texmorph/katex katex
```
```sh [pnpm]
pnpm add @texmorph/katex katex
```
```sh [yarn]
yarn add @texmorph/katex katex
```
:::

KaTeX is a peer dependency; versions `>=0.16.11 <0.20` are supported. To use MathJax instead, see [MathJax](/renderers/mathjax).

## Your first morph

```ts
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { createMorph } from '@texmorph/katex';

const container = document.querySelector<HTMLElement>('#formula')!;

const morph = await createMorph(
  container,
  { latex: String.raw`x^2 + y^2 = z^2`, displayMode: true },
  { latex: String.raw`x^2 = z^2 - y^2`, displayMode: true },
  { katex, duration: 800 },
);

morph.render(0);    // shows the source formula
morph.render(0.5);  // halfway
morph.render(1);    // shows the target formula
```

`createMorph` renders both formulas, measures them, matches their symbols and returns a `MathMorph`. Nothing moves until you call `render(t)`.

## Play it

texmorph has no built-in clock; drive `render` from whatever owns time in your app. A minimal player:

```ts
function play(morph: MathMorph): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min((now - start) / morph.duration, 1);
      morph.render(t);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

await play(morph);
```

Or connect it to a slider:

```ts
slider.addEventListener('input', () => morph.render(slider.valueAsNumber));
```

`morph.duration` is metadata for your clock (default 800 ms). Easing is applied inside the morph, so pass linear progress.

## Clean up

```ts
morph.dispose();                      // keep the target formula in the container
morph.dispose({ settle: 'source' });  // or keep the source formula
```

After `dispose()` the container holds a plain, accessible formula again. Calling `render()` after `dispose()` throws `TexMorphLifecycleError`.

## Next steps

- [How it works](/guide/how-it-works): prepare, render and dispose in detail.
- [Matching and morphMap](/guide/matching): control which symbols move where.
- [Chaining steps](/guide/chaining-steps): multi-step derivations with forward and backward navigation.
