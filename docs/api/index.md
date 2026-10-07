# API reference

| Package | Main exports |
|---|---|
| [`@texmorph/katex`](/api/katex) | `createMorph`, `katexRenderer`, `renderFormula` |
| [`@texmorph/mathjax`](/api/mathjax) | `createMorph`, `mathjaxRenderer`, `renderFormula` |
| [`@texmorph/dom`](/api/dom) | `createMorphWith`, `renderFormula`, `MathMorph`, `FormulaRenderer`, errors |
| [`@texmorph/core`](/api/core) | `createMorphPlan`, `sampleMorph`, `reversePlan`, `matchTokens`, easing, types |
| [`@texmorph/gsap`](/api/gsap) | `morphTween`, `addMorph` |
| [`@texmorph/element`](/api/element) | `defineTexMorph`, `TexMorphElement` |
| [`@texmorph/remotion`](/api/remotion) | `TexMorph`, `progressAt`, `dependencyKey` |

All packages are ESM-only and ship TypeScript declarations. The renderer packages re-export the commonly used types and errors from `@texmorph/dom`, so most applications import from a single package.
