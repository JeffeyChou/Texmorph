# Chaining steps

Derivations usually have several steps: `2x + 3 = 7 → 2x = 4 → x = 2`. Reuse the formula left in the container by one morph as the start of the next, so nothing is rendered twice.

## Forward

```ts
import katex from 'katex';
import { createMorph, katexRenderer, renderFormula, type MathMorph, type RenderedFormula } from '@texmorph/katex';

const steps = ['2x + 3 = 7', '2x = 7 - 3', '2x = 4', 'x = 2'];
const renderer = katexRenderer(katex);

let shown: RenderedFormula = await renderFormula(renderer, container, { latex: steps[0] });
let live: MathMorph | null = null;
let index = 0;

async function next() {
  if (index === steps.length - 1) return;
  if (live) {
    live.dispose({ settle: 'target' });
    shown = live.target;             // the settled target becomes the next source
  }
  index += 1;
  live = await createMorph(container, shown, { latex: steps[index] }, { katex });
  await play(live);                  // your clock, from 0 to 1
}
```

`renderFormula` renders a formula the same way the morph does, so the first step can reuse it directly.

## Backward

Keep the most recent morph alive after it finishes. Stepping back then just plays it in reverse:

```ts
async function previous() {
  if (live) {
    await playReverse(live);         // from 1 to 0
    live.dispose({ settle: 'source' });
    live = null;
    index -= 1;
    return;
  }
  // Further back: morph from the earlier formula to the one on screen, then play it in reverse.
  const onScreen = container.querySelector('.texmorph-katex')!;
  const back = await createMorph(container, { latex: steps[index - 1] }, { adopt: onScreen }, { katex });
  back.render(1);
  await playReverse(back);
  back.dispose({ settle: 'source' });
  index -= 1;
}
```

When you use `morphMap`, pass the map of the transition being undone; it always describes the forward direction.

## Formula inputs

`from` and `to` accept three kinds of input:

| Input | Meaning |
|---|---|
| `{ latex, displayMode?, className? }` | Render this LaTeX. |
| A `RenderedFormula` | Reuse a formula rendered by texmorph, such as `morph.target` or the result of `renderFormula`. If it is detached or came from another renderer, it is re-rendered from its LaTeX (diagnostic `render/reuse-mismatch`). |
| `{ adopt: element, fallback? }` | Take over a formula already on the page, for example server-rendered KaTeX. If the renderer cannot adopt it, `fallback` LaTeX is rendered instead (`render/adopt-mismatch`); without a fallback, `createMorph` rejects. |

`morph.target` is available while the morph is alive and after `dispose({ settle: 'target' })`; after `dispose({ settle: 'source' })` it throws.

## Data-only reversal

If you work with plans directly, `reversePlan(plan)` returns a plan whose frame at `t` equals the original at `1 − t`, including asymmetric easing and arcs.
