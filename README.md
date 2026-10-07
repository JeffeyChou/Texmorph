# texmorph

**Seekable formula morphing for the web.** texmorph animates one LaTeX formula into another: shared symbols fly to their new places, removed ones fade out and new ones fade in. Every frame is a pure function of progress `t`, so you can drive it from a slider, a timeline or a video renderer, in any order.

```ts
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { createMorph } from '@texmorph/katex';

const morph = await createMorph(
  document.querySelector('#formula')!,
  { latex: String.raw`x^2 + y^2 = z^2`, displayMode: true },
  { latex: String.raw`x^2 = z^2 - y^2`, displayMode: true },
  { katex },
);

morph.render(0.5); // any frame, in any order
morph.dispose();   // keeps the target formula in place
```

## Features

- **No clock.** `render(t)` never reads layout and never depends on previous frames: scrubbing, reversing and frame-by-frame video export just work.
- **Exact endpoints.** At `t = 0` and `t = 1` the real formulas are shown, pixel-identical to a plain rendering.
- **Automatic matching.** Symbols are paired by glyph, role and position. `morphMap` overrides individual pairs.
- **KaTeX and MathJax.** Use KaTeX for speed and small bundles, or MathJax 4 (SVG) for broad TeX coverage and identical geometry across browsers.
- **Integrations** for GSAP, Web Components and Remotion, plus a script-tag build.
- **Accessible and safe.** One formula is exposed to assistive technology at a time; no `innerHTML`, strict-CSP friendly.

## Packages

| Package | Description |
|---|---|
| [`@texmorph/katex`](packages/katex) | KaTeX renderer and `createMorph()` |
| [`@texmorph/mathjax`](packages/mathjax) | MathJax 4 (SVG) renderer and `createMorph()` |
| [`@texmorph/gsap`](packages/gsap) | GSAP tween and timeline integration |
| [`@texmorph/element`](packages/element) | `<tex-morph>` Web Component |
| [`@texmorph/remotion`](packages/remotion) | `<TexMorph>` for Remotion videos |
| [`@texmorph/dom`](packages/dom) | Renderer-agnostic DOM driver |
| [`@texmorph/core`](packages/core) | Pure planning and sampling |

## Documentation

**https://jeffeychou.github.io/Texmorph/**

The sources are in [`docs/`](docs); to run the site locally:

```sh
pnpm install
pnpm docs:dev
```

Good places to start: [Getting started](docs/guide/getting-started.md), [How it works](docs/guide/how-it-works.md), [API reference](docs/api/index.md).

## Browser support

The current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile. `Intl.Segmenter` is required.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Development happens on the `dev` branch.

## License

[MIT](LICENSE) © Jiefeng Zhou
