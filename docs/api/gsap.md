# @texmorph/gsap

Peer dependency: `gsap` `^3.13.0`.

```ts
function morphTween(morph: MathMorph, vars?: MorphTweenVars): gsap.core.Tween;
function addMorph(timeline: gsap.core.Timeline, morph: MathMorph, position?: gsap.Position): gsap.core.Timeline;

type MorphTweenVars = Omit<gsap.TweenVars, 'ease'>;
```

| Function | Description |
|---|---|
| `morphTween` | A tween that drives the morph's progress from 0 to 1. Duration defaults to `morph.duration / 1000` seconds; `vars` may override it and add delay, repeat, yoyo, callbacks and so on. Passing `ease` throws `TypeError`. |
| `addMorph` | Adds `morphTween(morph)` to `timeline` at `position` and returns the timeline. |

See [GSAP integration](/integrations/gsap).
