# GSAP

`@texmorph/gsap` connects a morph to [GSAP](https://gsap.com) tweens and timelines.

```sh
npm install @texmorph/gsap gsap
```

```ts
import { gsap } from 'gsap';
import { addMorph, morphTween } from '@texmorph/gsap';

// A standalone tween.
morphTween(morph).play();

// Inside a timeline: starts at 0.5 s and lasts morph.duration.
const tl = gsap.timeline({ paused: true });
tl.to('.title', { opacity: 1 });
addMorph(tl, morph, 0.5);

tl.seek(1.0); // renders exactly morph.render(0.5)
```

- `morphTween(morph, vars?)` returns a `gsap.core.Tween` that drives progress from 0 to 1 over `morph.duration`. `vars` accepts any tween variables except `ease`: duration, delay, repeat, yoyo, callbacks and so on.
- `addMorph(timeline, morph, position?)` adds such a tween to a timeline and returns the timeline.
- The tween's ease is always `none`; easing belongs to the morph, so it is never applied twice. Passing `ease` throws a `TypeError`.
- Seeking, reversing and scrubbing render the matching frame even when GSAP suppresses callbacks, because progress is written through a property setter.
- Disposing of a morph while a tween still references it is safe; further updates are ignored.
