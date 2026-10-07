import type { ContextFrame } from '@texmorph/core';

/** The subset of MathJax's MmlNode used here. */
export interface MmlLike {
  readonly kind: string;
  readonly isToken: boolean;
  readonly isInferred: boolean;
  readonly parent: MmlLike | null;
  readonly childNodes: MmlLike[];
  readonly texClass: number;
  readonly attributes: {
    get(name: string): unknown;
    getExplicit(name: string): unknown;
    set(name: string, value: string | number | boolean): void;
  };
  walkTree(fn: (node: MmlLike) => void): void;
  getText?(): string;
}

export const ATTR = {
  id: 'data-tm-id',
  sid: 'data-tm-sid',
  text: 'data-tm-text',
  cls: 'data-tm-class',
  variant: 'data-tm-variant',
  script: 'data-tm-script',
  ctx: 'data-tm-ctx',
  structure: 'data-tm-structure',
} as const;

const TEXCLASS_NAMES = ['ORD', 'OP', 'BIN', 'REL', 'OPEN', 'CLOSE', 'PUNCT', 'INNER', 'VCENTER'];
const TEX_INNER = 7;
const TEX_OPEN = 4;
const STRUCTURED = new Set(['mfrac', 'msqrt', 'mroot']);

type FineFrame = 'frac-num' | 'frac-den' | 'sqrt' | 'sup' | 'sub' | 'accent' | 'array' | 'stack' | 'sized' | 'delim';

/** ADR 0002 D-1.3: projection of the fine MathML frames onto the seed chain. */
const PROJECTION: Record<FineFrame, readonly ContextFrame[]> = {
  'frac-num': ['script', 'frac'],
  'frac-den': ['script', 'frac'],
  sqrt: ['script', 'sqrt'],
  sup: ['script'],
  sub: ['script'],
  accent: ['script'],
  array: ['script'],
  stack: ['script'],
  sized: ['sized'],
  delim: [],
};

export function tagTree(root: MmlLike): void {
  let n = 0;
  let s = 0;
  root.walkTree((node) => {
    if (node.isToken) node.attributes.set(ATTR.id, String(n++));
    else if (STRUCTURED.has(node.kind)) node.attributes.set(ATTR.sid, String(s++));
  });
}

/** Fine frames of a node's ancestors, innermost first, one per qualifying ancestor. */
function fineFrames(node: MmlLike, includeSelf: boolean): FineFrame[] {
  const frames: FineFrame[] = [];
  if (includeSelf && (node.attributes.getExplicit('minsize') || node.attributes.getExplicit('maxsize'))) frames.push('sized');
  for (let c: MmlLike = node, p = node.parent; p; c = p, p = p.parent) {
    const i = p.childNodes.indexOf(c);
    switch (p.kind) {
      case 'mfrac':
        frames.push(i === 0 ? 'frac-num' : 'frac-den');
        break;
      case 'msqrt':
      case 'mroot':
        frames.push('sqrt');
        break;
      case 'msub':
        if (i === 1) frames.push('sub');
        break;
      case 'msup':
        if (i === 1) frames.push('sup');
        break;
      case 'msubsup':
      case 'munderover':
        if (i > 0) frames.push(i === 1 ? 'sub' : 'sup');
        break;
      case 'munder':
        if (i === 1) frames.push(p.attributes.get('accentunder') ? 'accent' : 'sub');
        break;
      case 'mover':
        if (i === 1) frames.push(p.attributes.get('accent') ? 'accent' : 'sup');
        break;
      case 'mtd':
        frames.push('array');
        break;
      case 'mstyle':
        if (p.attributes.getExplicit('mathsize')) frames.push('sized');
        break;
      case 'mrow':
        if (p.texClass === TEX_INNER && p.childNodes[0]?.texClass === TEX_OPEN) frames.push('delim');
        break;
      default:
        break;
    }
  }
  return frames;
}

export function seedContext(node: MmlLike, includeSelf = true): ContextFrame[] {
  return fineFrames(node, includeSelf).flatMap((f) => PROJECTION[f]);
}

function scriptLevel(node: MmlLike): number {
  return Math.min(2, Math.max(0, Number(node.attributes.get('scriptlevel')) || 0));
}

/** Persists renderer-private token facts on the SVG so the registry can be rebuilt from the DOM alone (ADR 0002 D-3 b). */
export function annotate(container: Element, root: MmlLike): void {
  const tokens = new Map<string, Element>();
  const structures = new Map<string, Element>();
  for (const g of container.querySelectorAll(`g[${ATTR.id}]`)) tokens.set(g.getAttribute(ATTR.id) ?? '', g);
  for (const g of container.querySelectorAll(`g[${ATTR.sid}]`)) structures.set(g.getAttribute(ATTR.sid) ?? '', g);
  root.walkTree((node) => {
    if (!node.isToken) {
      if (!STRUCTURED.has(node.kind)) return;
      const g = structures.get(String(node.attributes.get(ATTR.sid)));
      if (!g) return;
      g.setAttribute(ATTR.ctx, seedContext(node, false).join(','));
      g.setAttribute(ATTR.script, String(scriptLevel(node)));
      return;
    }
    const g = tokens.get(String(node.attributes.get(ATTR.id)));
    if (!g) return;
    const parent = node.parent?.isInferred ? node.parent.parent : node.parent;
    const latex = String(parent?.attributes.get('data-latex') ?? '');
    const isLine =
      (parent?.kind === 'mover' || parent?.kind === 'munder') && /^\\(over|under)line/.test(latex) && parent.childNodes.indexOf(node) === 1;
    g.setAttribute(ATTR.text, node.getText?.() ?? '');
    g.setAttribute(ATTR.cls, TEXCLASS_NAMES[node.texClass] ?? 'NONE');
    g.setAttribute(ATTR.variant, String(node.attributes.get('mathvariant') ?? 'normal'));
    g.setAttribute(ATTR.script, String(scriptLevel(node)));
    g.setAttribute(ATTR.ctx, seedContext(node).join(','));
    if (isLine) g.setAttribute(ATTR.structure, latex.startsWith('\\over') ? 'overline' : 'underline');
  });
}
