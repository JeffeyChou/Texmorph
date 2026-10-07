# Web Component

`@texmorph/element` provides a `<tex-morph>` custom element.

```sh
npm install @texmorph/element @texmorph/katex katex
```

```ts
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { katexRenderer } from '@texmorph/katex';
import { defineTexMorph } from '@texmorph/element';

defineTexMorph({ renderer: katexRenderer(katex) });
```

```html
<tex-morph from="a + b" to="b + a" display duration="800" easing="ease-out"></tex-morph>

<script type="module">
  const el = document.querySelector('tex-morph');
  await el.ready;
  el.play();
</script>
```

## Attributes

| Attribute | Description |
|---|---|
| `from`, `to` | LaTeX of the two formulas. Changing either rebuilds the morph. |
| `display` | Render in display mode (boolean attribute). |
| `progress` | Current progress, `0`–`1`. |
| `duration` | Duration in milliseconds used by `play()` (default 800). |
| `easing` | An easing name or CSS-like string (see [Easing](/guide/easing)). |

## Properties and methods

| Member | Description |
|---|---|
| `progress` | Get or set progress; same as `seek(t)`. |
| `morphMap` | Explicit [token mapping](/guide/matching); setting it rebuilds the morph. |
| `morph` | The current `MathMorph`, or `null` while preparing. |
| `ready` | A promise for the current morph. While a preparation is pending it resolves with the newest one. It rejects with an `AbortError` if the element is disconnected first. |
| `seek(t)` | Render progress `t`. |
| `play()` / `pause()` | Animate from the current progress to 1 using the element's own clock. With `prefers-reduced-motion: reduce`, `play()` jumps to the end. |

## Events

| Event | `detail` |
|---|---|
| `texmorph-ready` | `{ plan }` |
| `texmorph-diagnostic` | The morph's diagnostics, when there are any |
| `texmorph-error` | The error that made preparation fail |

## Lifecycle

- The element prepares when it is connected and has both `from` and `to`. It refreshes when it is resized, and disposes of the morph when disconnected, cancelling any pending preparation.
- Preparation is bounded by `prepareTimeoutMs` (default 10 000).

## Options

```ts
defineTexMorph({
  renderer,                  // any renderer, e.g. katexRenderer(katex) or mathjaxRenderer()
  tagName: 'tex-morph',      // custom tag name
  prepareTimeoutMs: 10_000,
  styles: sheet,             // render into a shadow root that adopts these styles
});
```

Without `styles` the element uses light DOM, so the page's KaTeX CSS applies directly. With a shadow root, pass the renderer's CSS as a constructed `CSSStyleSheet` (preferred under a strict CSP) or a string. Fonts must still be declared at document level.
