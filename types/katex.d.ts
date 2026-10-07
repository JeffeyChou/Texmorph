// Version-independent typing for the KaTeX peer: 0.16.x ships no declarations, later versions do.
declare const katex: {
  readonly version: string;
  render(latex: string, element: HTMLElement, options?: Record<string, unknown>): void;
  renderToString(latex: string, options?: Record<string, unknown>): string;
};
export default katex;
