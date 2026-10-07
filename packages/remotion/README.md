# @texmorph/remotion

[Remotion](https://www.remotion.dev) component for [texmorph](https://github.com/JeffeyChou/Texmorph): frame-accurate formula morphs in videos.

## Install

```sh
npm install @texmorph/remotion @texmorph/katex katex
```

## Usage

```tsx
import katex from 'katex';
import { katexRenderer } from '@texmorph/katex';
import { TexMorph } from '@texmorph/remotion';

const renderer = katexRenderer(katex);

export const Scene = () => (
  <TexMorph renderer={renderer} from={{ latex: 'a+b' }} to={{ latex: 'b+a' }} durationInFrames={30} />
);
```

## Documentation

- [Remotion integration](https://jeffeychou.github.io/Texmorph/integrations/remotion)
- [API](https://jeffeychou.github.io/Texmorph/api/remotion)

## License

MIT
