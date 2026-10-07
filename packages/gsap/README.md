# @texmorph/gsap

[GSAP](https://gsap.com) integration for [texmorph](https://github.com/JeffeyChou/Texmorph).

## Install

```sh
npm install @texmorph/gsap gsap
```

## Usage

```ts
import { gsap } from 'gsap';
import { addMorph } from '@texmorph/gsap';

const tl = gsap.timeline({ paused: true });
addMorph(tl, morph, 0.5);
tl.seek(1.0); // renders morph.render(0.5)
```

## Documentation

- [GSAP integration](https://jeffeychou.github.io/Texmorph/integrations/gsap)
- [API](https://jeffeychou.github.io/Texmorph/api/gsap)

## License

MIT
