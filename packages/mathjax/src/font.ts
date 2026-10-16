/**
 * A MathJax 4 SVG font for `mathjaxRenderer({ font })`. Import one from
 * `@texmorph/mathjax/fonts/<name>` (`newcm`, `stix2`, `termes`, `pagella`); only the fonts you
 * import are bundled.
 */
export interface MathJaxFont {
  /** Short name, e.g. `'stix2'`. */
  readonly name: string;
  /** The font's SVG font-data class, e.g. `MathJaxStix2Font` from `@mathjax/mathjax-stix2-font/js/svg.js`. */
  readonly data: unknown;
  /** Lazy imports of the font's dynamic ranges (`latin`, `greek`, …), loaded when a formula needs them. */
  readonly ranges: Readonly<Record<string, () => Promise<unknown>>>;
}

/** The prefix MathJax puts in front of a dynamic range when it asks for it. */
export function dynamicPrefix(font: MathJaxFont): string {
  const prefix = (font.data as { OPTIONS?: { dynamicPrefix?: unknown } } | null)?.OPTIONS?.dynamicPrefix;
  if (typeof prefix !== 'string' || !prefix) throw new TypeError(`MathJax font "${font.name}" has no dynamicPrefix`);
  return prefix;
}
