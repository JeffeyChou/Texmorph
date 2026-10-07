# Errors and diagnostics

## Failure behavior

By default a morph degrades gracefully: if something cannot be measured, the morph falls back to a whole-formula crossfade and records why. Pass `strict: true` to reject instead.

| Situation | Default | `strict: true` |
|---|---|---|
| A formula fails to render (for example a LaTeX syntax error) | The raw LaTeX is shown as text and the morph crossfades. Diagnostic `render/error`. | Rejects with `MorphPrepareError` |
| The container has no layout (for example inside `display: none`) | Crossfade, `layout/no-size`. Call `refresh()` once it is visible. | Rejects |
| An element passed as `{ adopt }` cannot be adopted and no fallback is given | Rejects with `MorphPrepareError` | Rejects |
| Fonts never finish loading | Waits; pass `signal` to bound the wait | Same |
| `options.signal` aborts | Rejects with `signal.reason`; partial DOM is removed and adopted elements are put back | Same |
| `Intl.Segmenter` is unavailable | Rejects (`env/no-segmenter`) | Same |

```ts
try {
  const morph = await createMorph(container, from, to, { katex, strict: true, signal: AbortSignal.timeout(10_000) });
} catch (error) {
  if (error instanceof MorphPrepareError) console.warn(error.diagnostics);
}
```

texmorph has no timers of its own: to bound waiting for fonts, pass a deadline signal such as `AbortSignal.timeout(ms)`. A signal cannot interrupt a TeX parse that is already running; limit expensive input with the renderer's own options (KaTeX `maxSize`/`maxExpand`).

## Diagnostics

`morph.diagnostics` lists everything noteworthy found while preparing, including informational items:

```ts
for (const d of morph.diagnostics) console.log(d.severity, d.code, d.message);
```

| Code | Severity | Meaning |
|---|---|---|
| `map/out-of-range`, `map/invalid`, `map/kind-mismatch`, `map/duplicate` | warn | A `morphMap` entry was skipped. |
| `map/structure-index` | info | A `morphMap` entry targets structure tokens, whose indices may change between renderer versions. |
| `layout/zero-box` | info | A token has no size (for example KaTeX's invisible spacing characters); it does not scale on that axis. |
| `layout/no-size` | error | The formula has no layout box. |
| `layout/stage-constrained` | info | The formula extends beyond its container's origin; ghosts may overflow. |
| `render/error` | error | The renderer failed. |
| `render/unknown-structure` | info/error | The renderer met markup it does not understand. |
| `render/adopt-mismatch`, `render/reuse-mismatch` | warn | An input could not be reused and was re-rendered. |
| `env/no-segmenter` | error | `Intl.Segmenter` is missing. |
| `fallback/crossfade` | warn | The morph uses a whole-formula crossfade. |
| `shape/unavailable` | warn | Outline morphing could not load; changed glyphs stretch and crossfade. |
| `shape/fallback` | info | Playback fell below `minFps` with `shapes: 'auto'`; the morph switched to stretch-and-crossfade. `detail.fps` is the measured rate. |

`layout/fonts-not-ready`, `easing/unknown` and `compat/legacy-deviation` are reserved for integrations and are not emitted by the texmorph packages. The full list is exported at runtime as `DIAGNOSTIC_CODES` from `@texmorph/core`.

## Lifecycle errors

- `render()`, `refresh()` after `dispose()` throw `TexMorphLifecycleError`. `dispose()` itself is idempotent.
- Invalid numbers in options (`NaN` progress, a negative `endScale`, `added.start ≥ 1`, …) throw `RangeError`.
