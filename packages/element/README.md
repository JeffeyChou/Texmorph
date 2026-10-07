# @texmorph/element

A `<tex-morph>` Web Component for [texmorph](https://github.com/JeffeyChou/Texmorph).

## Install

```sh
npm install @texmorph/element @texmorph/katex katex
```

## Usage

```ts
import katex from 'katex';
import { katexRenderer } from '@texmorph/katex';
import { defineTexMorph } from '@texmorph/element';

defineTexMorph({ renderer: katexRenderer(katex) });
```

```html
<tex-morph from="a + b" to="b + a" display progress="0.5"></tex-morph>
```

## Documentation

- [Web Component](https://jeffeychou.github.io/Texmorph/integrations/web-component)
- [API](https://jeffeychou.github.io/Texmorph/api/element)

## License

MIT
