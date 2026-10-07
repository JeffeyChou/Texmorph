import type { Box, FormulaSnapshot, GhostFrame, MathToken, MorphDiagnostic, MorphPlan, PlanOptions, Track } from '@texmorph/core';

export type LatexState = { latex: string; displayMode?: boolean; className?: string };

export interface RenderedFormula {
  readonly root: HTMLElement | SVGElement;
  readonly snapshot: FormulaSnapshot;
  readonly state: LatexState;
  readonly renderer: { readonly name: string; readonly version: string };
  readonly diagnostics: readonly MorphDiagnostic[];
}

export interface GhostLayer {
  readonly root: HTMLElement | SVGElement;
  add(ghost: Element): void;
  place(ghost: Element, frame: GhostFrame, track: Track): void;
  dispose(): void;
}

export interface FormulaRenderer<Opts = unknown> {
  readonly name: string;
  readonly version: string;
  ready?(signal?: AbortSignal): Promise<void>;
  render(container: HTMLElement, state: LatexState, opts: Opts | undefined, signal?: AbortSignal): Promise<RenderedFormula>;
  adopt?(el: Element, signal?: AbortSignal): Promise<RenderedFormula | null>;
  resnapshot(rendered: RenderedFormula): RenderedFormula;
  /** Hides the token elements of a rendered formula; the returned function restores them. */
  maskTokens(rendered: RenderedFormula): () => void;
  createGhostLayer(stage: HTMLElement, bounds: Box): GhostLayer;
  createGhost(token: MathToken, rendered: RenderedFormula): Element;
  stylesheet?(): CSSStyleSheet | string;
}

export type FormulaInput = LatexState | RenderedFormula | { adopt: Element; fallback?: LatexState };

export interface MathMorphOptions<Opts = unknown> extends Omit<PlanOptions, 'origins'> {
  duration?: number;
  strict?: boolean;
  signal?: AbortSignal;
  rendererOptions?: Opts;
  progressMap?: (t: number) => number;
}

export interface MathMorph {
  readonly duration: number;
  readonly plan: MorphPlan;
  readonly diagnostics: readonly MorphDiagnostic[];
  readonly state: 'ready' | 'refreshing' | 'disposed';
  readonly target: RenderedFormula;
  render(progress: number): void;
  refresh(): Promise<MorphPlan>;
  dispose(options?: { settle?: 'source' | 'target' }): void;
}
