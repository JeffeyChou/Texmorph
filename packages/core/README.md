# @texmorph/core

Pure planning and sampling for [texmorph](https://github.com/JeffeyChou/Texmorph). No DOM, no clock: runs in browsers, workers and Node.

## Install

```sh
npm install @texmorph/core
```

## Usage

```ts
import { createMorphPlan, sampleMorph } from '@texmorph/core';

const plan = createMorphPlan(fromSnapshot, toSnapshot, { easing: 'easeOutCubic' });
const frame = sampleMorph(plan, 0.42);
```

## Documentation

- [How it works](https://jeffeychou.github.io/Texmorph/guide/how-it-works)
- [API](https://jeffeychou.github.io/Texmorph/api/core)

## License

MIT
