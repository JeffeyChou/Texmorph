# @texmorph/katex

KaTeX renderer for [texmorph](https://github.com/JeffeyChou/Texmorph): seekable formula morphing.

## Install

```sh
npm install @texmorph/katex katex
```

## Usage

```ts
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { createMorph } from '@texmorph/katex';

const morph = await createMorph(
  container,
  { latex: String.raw`x^2 + y^2 = z^2`, displayMode: true },
  { latex: String.raw`x^2 = z^2 - y^2`, displayMode: true },
  { katex },
);

morph.render(0.5);
```

Supports KaTeX `>=0.16.11 <0.20`. Also ships `dist/texmorph.iife.js`, a script-tag build that defines a global `Texmorph`.

## Documentation

- [Getting started](https://jeffeychou.github.io/Texmorph/guide/getting-started)
- [KaTeX renderer](https://jeffeychou.github.io/Texmorph/renderers/katex)
- [API](https://jeffeychou.github.io/Texmorph/api/katex)

## License

MIT
