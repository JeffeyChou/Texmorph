# @texmorph/dom

Renderer-agnostic DOM driver for [texmorph](https://github.com/JeffeyChou/Texmorph). Most applications use it through `@texmorph/katex` or `@texmorph/mathjax`; use it directly with a shared or custom renderer.

## Install

```sh
npm install @texmorph/dom
```

## Usage

```ts
import { createMorphWith } from '@texmorph/dom';

const morph = await createMorphWith(renderer, container, { latex: 'a+b' }, { latex: 'b+a' });
```

## Documentation

- [Writing a renderer](https://jeffeychou.github.io/Texmorph/renderers/custom)
- [API](https://jeffeychou.github.io/Texmorph/api/dom)

## License

MIT
