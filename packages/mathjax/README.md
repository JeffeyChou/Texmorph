# @texmorph/mathjax

MathJax 4 (SVG output) renderer for [texmorph](https://github.com/JeffeyChou/Texmorph): seekable formula morphing.

## Install

```sh
npm install @texmorph/mathjax @mathjax/src @mathjax/mathjax-newcm-font
```

## Usage

```ts
import { createMorph } from '@texmorph/mathjax';

const morph = await createMorph(
  container,
  { latex: String.raw`\int_0^1 x\,dx`, displayMode: true },
  { latex: String.raw`\left[\frac{x^2}{2}\right]_0^1`, displayMode: true },
);

morph.render(0.5);
```

Requires `@mathjax/src` `^4.1.3`. Font ranges load lazily as formulas need them.

Other math fonts (`stix2`, `termes`, `pagella`) come from `@texmorph/mathjax/fonts/<name>` with their `@mathjax/mathjax-<name>-font` package: `mathjaxRenderer({ font: stix2 })`. `textFont: 'inherit'` draws `\text{}` in the page font.

## Documentation

- [MathJax renderer](https://jeffeychou.github.io/Texmorph/renderers/mathjax)
- [API](https://jeffeychou.github.io/Texmorph/api/mathjax)

## License

MIT
