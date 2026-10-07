# Easing and motion

## Easing

Pass `easing` to `createMorph` (or `createMorphPlan`). The easing is stored in the plan, so `render(t)` should receive linear progress.

```ts
await createMorph(container, from, to, { katex, easing: 'easeOutCubic' });
```

Accepted values (`EasingSpec`):

- Named easings: `linear`, `easeIn/Out/InOut` × `Quad`, `Cubic`, `Quart`, `Expo`, `Elastic`, `Bounce` (for example `easeInOutCubic`, the default).
- CSS-style aliases: `ease`, `ease-in`, `ease-out`, `ease-in-out`, and `spring`.
- Objects: `{ type: 'cubic-bezier', x1, y1, x2, y2 }`, `{ type: 'steps', count, position? }`, `{ type: 'spring', stiffness?, damping?, mass? }`.

Compare a few of them:

<ClientOnly>
  <MorphDemo :steps="['ax^2 + bx + c = 0', 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}']" :easings="['easeInOutCubic', 'linear', 'easeOutCubic', 'easeInOutExpo', 'easeOutElastic', 'easeOutBounce', 'spring', 'ease-in-out']" />
</ClientOnly>

To accept CSS-like strings from configuration, use `parseEasing`:

```ts
import { parseEasing } from '@texmorph/core';

parseEasing('cubic-bezier(0.25, 0.1, 0.25, 1)'); // { type: 'cubic-bezier', ... }
parseEasing('steps(4)');                          // { type: 'steps', count: 4, position: 'end' }
```

Unknown strings throw a `RangeError`.

### Custom easing functions

Plans must stay serializable, so they cannot hold functions. To apply an arbitrary function, remap progress with `progressMap`:

```ts
await createMorph(container, from, to, { katex, easing: 'linear', progressMap: (t) => t * t * (3 - 2 * t) });
```

Overshooting easings (elastic, bounce, spring) may move tokens past their targets in the middle of the animation; endpoints are always exact and opacity always stays within [0, 1].

## Motion options

| Option | Default | Effect |
|---|---|---|
| `arc` | `0.2` | Curvature of the path matched tokens travel. `0` moves in straight lines; negative values bend the other way. |
| `removed.endScale` | `0.7` | Final scale of tokens that disappear. |
| `added.startScale` | `0.7` | Initial scale of tokens that appear. |
| `added.start` | `0.3` | Progress at which new tokens start fading in (`0 ≤ start < 1`). |

```ts
await createMorph(container, from, to, { katex, arc: 0, added: { start: 0.5 } });
```
