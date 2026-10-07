# Matching and morphMap

## Automatic matching

Every rendered grapheme becomes a **text token**; fraction bars, radicals, overlines and other drawn shapes become **structure tokens**. Source tokens are matched to target tokens in this order:

1. **Explicit map**: pairs you pass in `morphMap`.
2. **Exact**: same glyph, same atom class (ordinary, operator, relation, …) and same structural context (inside a fraction, radical, script or sized group).
3. **Structure**: same kind of drawn shape.
4. **Text**: same glyph anywhere.

When several candidates qualify, the nearest one wins (distance between box centers); ties go to the lower index. A target is never matched twice.

## Explicit mapping with morphMap

Use `morphMap` when automatic matching picks the wrong instance of a repeated symbol, or when you want a symbol to turn into a different one.

```ts
await createMorph(container, from, to, {
  katex,
  morphMap: [[0, 0], [3, 6]],   // source token 0 → target token 0, source 3 → target 6
});
```

Three equivalent forms are accepted:

```ts
morphMap: [[0, 0], [3, 6]]
morphMap: { '0': 0, '3': 6 }
morphMap: [{ source: 0, target: 0 }, { source: 3, target: 6 }]
```

Rules:

- If the same source index appears more than once, the last entry wins.
- If several sources claim the same target, the first one wins; the others are skipped.
- Out-of-range indices, non-integer values and text-to-structure pairs are skipped.
- Skipped entries are reported in `morph.diagnostics` (`map/*` codes). Mapping never creates many-to-one matches.

## Token indices

Indices count **text tokens first, in document order, then structure tokens**. To find them, inspect `morph.plan.from.tokens` and `morph.plan.to.tokens`:

```ts
console.table(morph.plan.from?.tokens.map((t) => ({ index: t.index, text: t.text, kind: t.kind })));
```

Keep in mind:

- Indices are **renderer-specific**. KaTeX emits invisible zero-width tokens after fractions, scripts and radicals and orders stacked rows bottom-up; MathJax follows MathML order and skips ink-less characters. A map written for one renderer does not carry over to the other.
- Text indices are stable across the supported KaTeX versions; **structure indices may change** between KaTeX versions. Prefer mapping text tokens (structure mappings produce a `map/structure-index` info diagnostic).
