# @texmorph/element

```ts
function defineTexMorph(options: DefineOptions): void;

interface DefineOptions {
  renderer: FormulaRenderer;
  tagName?: string;              // default 'tex-morph'
  prepareTimeoutMs?: number;     // default 10000
  styles?: CSSStyleSheet | string;
}

interface TexMorphElement extends HTMLElement {
  progress: number;
  morphMap: MorphMap | undefined;
  readonly morph: MathMorph | null;
  readonly ready: Promise<MathMorph>;
  seek(t: number): void;
  play(): void;
  pause(): void;
}
```

`defineTexMorph` registers the element; calling it again with the same tag name does nothing. Observed attributes: `from`, `to`, `progress`, `duration`, `easing`, `display`. Events: `texmorph-ready`, `texmorph-diagnostic`, `texmorph-error`.

See [Web Component integration](/integrations/web-component) for behavior details.
