# Versioning and stability

texmorph follows [Semantic Versioning](https://semver.org/). All packages are versioned independently and released with changelogs.

- **Public API**: everything exported from a package's entry point. Internal markup, class names and CSS are not part of the API.
- **Additive unions**: `DiagnosticCode`, `StructureRole`, `ContextFrame`, `AtomRole`, `EasingName` and `TrackSubject` may gain members in minor releases. Code that switches over them should keep a `default` branch.
- **Plans** carry `version: 1`. A plan created by a 1.x release samples identically in later 1.x releases.
- **Defaults** (`DEFAULTS` in `@texmorph/core`: easing, arc, scales, fade start) change only in major releases.
- **Renderer contract**: custom renderers rely on `FormulaRenderer` and `GhostLayer` from `@texmorph/dom`; these follow the same rules as the rest of the API.
- **Peer dependencies**: supported KaTeX, MathJax, GSAP, Remotion and React ranges are listed in each package; widening a range is a minor change, narrowing it is a major change.
