import type { FormulaSnapshot, MatchPair, MathToken, MorphDiagnostic, MorphMap, Point } from './types.ts';

export interface NormalizeMorphMapResult {
  readonly pairs: readonly MatchPair[];
  readonly diagnostics: readonly MorphDiagnostic[];
}

export interface MatchResult {
  readonly matched: readonly MatchPair[];
  readonly removed: readonly number[];
  readonly added: readonly number[];
  readonly diagnostics: readonly MorphDiagnostic[];
}

const ZERO: Point = { x: 0, y: 0 };

function entries(map: MorphMap): Array<[unknown, unknown]> {
  if (Array.isArray(map)) {
    return map.map((entry: unknown): [unknown, unknown] => {
      if (Array.isArray(entry)) return [entry[0], entry[1]];
      if (entry && typeof entry === 'object') {
        const record = entry as { source?: unknown; target?: unknown };
        return [record.source, record.target];
      }
      return [undefined, undefined];
    });
  }
  return Object.keys(map).map((key) => [key, (map as Record<string, unknown>)[key]]);
}

function toIndex(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}

export function normalizeMorphMap(map: MorphMap | undefined, fromInput: FormulaSnapshot, toInput: FormulaSnapshot): NormalizeMorphMapResult {
  const from = byIndex(fromInput);
  const to = byIndex(toInput);
  const diagnostics: MorphDiagnostic[] = [];
  if (!map) return { pairs: [], diagnostics };

  // Later entries for the same source win, keeping first-insertion order (legacy Map.set semantics).
  const bySource = new Map<number, number>();
  for (const [rawSource, rawTarget] of entries(map)) {
    const source = toIndex(rawSource);
    const target = toIndex(rawTarget);
    if (Number.isNaN(source) || Number.isNaN(target)) {
      diagnostics.push({ code: 'map/invalid', severity: 'warn', message: 'morphMap entry is not a pair of non-negative integers', detail: { source: String(rawSource), target: String(rawTarget) } });
      continue;
    }
    bySource.set(source, target);
  }

  const pairs: MatchPair[] = [];
  const usedTargets = new Set<number>();
  for (const [source, target] of bySource) {
    const a = from.tokens[source];
    const b = to.tokens[target];
    if (!a || !b) {
      diagnostics.push({ code: 'map/out-of-range', severity: 'warn', message: `morphMap ${source}→${target} is out of range`, detail: { source, target } });
      continue;
    }
    if (a.kind !== b.kind) {
      diagnostics.push({ code: 'map/kind-mismatch', severity: 'warn', message: `morphMap ${source}→${target} pairs a ${a.kind} token with a ${b.kind} token`, detail: { source, target } });
      continue;
    }
    if (usedTargets.has(target)) {
      diagnostics.push({ code: 'map/duplicate', severity: 'warn', message: `morphMap target ${target} is already taken; ${source}→${target} skipped`, detail: { source, target } });
      continue;
    }
    if (a.kind === 'structure') {
      diagnostics.push({ code: 'map/structure-index', severity: 'info', message: `morphMap ${source}→${target} addresses structure tokens, whose indices can vary by renderer version`, detail: { source, target } });
    }
    usedTargets.add(target);
    pairs.push({ source, target, reason: 'explicit' });
  }
  return { pairs, diagnostics };
}

function sameContext(a: MathToken, b: MathToken): boolean {
  if (a.context.length !== b.context.length) return false;
  return a.context.every((frame, i) => frame === b.context[i]);
}

function exact(a: MathToken, b: MathToken): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'structure') return a.role === b.role;
  return a.text === b.text && a.role === b.role && sameContext(a, b);
}

function sameText(a: MathToken, b: MathToken): boolean {
  return a.kind === 'text' && b.kind === 'text' && a.text === b.text;
}

function center(token: MathToken, origin: Point): Point {
  return { x: origin.x + token.box.x + token.box.width / 2, y: origin.y + token.box.y + token.box.height / 2 };
}

function byIndex(snapshot: FormulaSnapshot): FormulaSnapshot {
  const sorted = snapshot.tokens.every((t, i) => t.index === i);
  return sorted ? snapshot : { ...snapshot, tokens: [...snapshot.tokens].sort((a, b) => a.index - b.index) };
}

export function matchTokens(
  fromInput: FormulaSnapshot,
  toInput: FormulaSnapshot,
  map?: MorphMap,
  origins: { from: Point; to: Point } = { from: ZERO, to: ZERO },
): MatchResult {
  const from = byIndex(fromInput);
  const to = byIndex(toInput);
  const explicit = normalizeMorphMap(map, from, to);
  const matched: MatchPair[] = [...explicit.pairs];
  const usedSource = new Set(matched.map((p) => p.source));
  const usedTarget = new Set(matched.map((p) => p.target));
  const targetCenters = to.tokens.map((t) => center(t, origins.to));

  const pass = (accept: (a: MathToken, b: MathToken) => boolean, reasonOf: (a: MathToken) => MatchPair['reason'], textOnly: boolean): void => {
    for (const a of from.tokens) {
      if (usedSource.has(a.index) || (textOnly && a.kind !== 'text')) continue;
      const ca = center(a, origins.from);
      let best = -1;
      let bestDist = Infinity;
      for (const b of to.tokens) {
        if (usedTarget.has(b.index) || !accept(a, b)) continue;
        const cb = targetCenters[b.index] as Point;
        const dist = Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = b.index;
        }
      }
      if (best !== -1) {
        matched.push({ source: a.index, target: best, reason: reasonOf(a) });
        usedSource.add(a.index);
        usedTarget.add(best);
      }
    }
  };

  pass(exact, (a) => (a.kind === 'structure' ? 'structure' : 'exact'), false);
  pass(sameText, () => 'text', true);

  return {
    matched,
    removed: from.tokens.filter((t) => !usedSource.has(t.index)).map((t) => t.index),
    added: to.tokens.filter((t) => !usedTarget.has(t.index)).map((t) => t.index),
    diagnostics: explicit.diagnostics,
  };
}
