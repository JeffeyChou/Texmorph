# Production checklist

## Styles and fonts

- **KaTeX**: load `katex/dist/katex.min.css`. `createMorph` waits for `document.fonts.ready` before measuring.
- **MathJax**: the renderer injects its stylesheet into `document.head` on first use. For shadow roots, adopt `renderer.stylesheet()`.

## Server-side rendering

Morphing needs real layout, so it runs in the browser only. Render static formulas on the server, then hand them to texmorph on the client with `{ adopt: element }` (see [Chaining steps](/guide/chaining-steps#formula-inputs)).

## Resizing

Call `morph.refresh()` when the container's width or the fonts change. The [Web Component](/integrations/web-component) does this automatically.

## Accessibility

- Exactly one formula is exposed to assistive technology at any time: the source until the morph completes, then the target. Ghosts are `aria-hidden`.
- texmorph does not check `prefers-reduced-motion` itself, because it does not own playback. Respect it in your player, for example by rendering `t = 1` directly. The Web Component does this for `play()`.

## Content Security Policy

texmorph writes styles through the CSSOM and never uses `innerHTML` or `eval`, so it works under a strict `style-src` and `script-src`. When passing styles to the Web Component under CSP, prefer a constructed `CSSStyleSheet` over a string.

## Security

KaTeX's `trust: true` is rejected; pass a function that allows specific commands instead. The MathJax renderer refuses the `html`, `require` and `autoload` TeX packages. See [SECURITY.md](https://github.com/JeffeyChou/Texmorph/blob/main/SECURITY.md).

## Performance

- Prepare costs about one render plus measurement per formula. Prepare the next step while the current one is still on screen if latency matters.
- `render(t)` only writes `transform`, `opacity` and `color`; it does not trigger layout.
- Each morph adds one absolutely positioned element per symbol while it is alive. Dispose of morphs you no longer need.
