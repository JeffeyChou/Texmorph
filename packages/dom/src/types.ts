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

/** One element that draws a matched pair of differing glyphs as a single interpolated outline. */
export interface ShapeGhost {
  /** Added to the ghost layer and placed like a ghost of the source token at scale 1. */
  readonly el: Element;
  /** Draws the outline at `mix` (0 = source glyph, 1 = target glyph) in the source ghost's coordinates. */
  draw(mix: number): void;
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
  /** Loads what shape morphing needs. Called once per morph before `createShapeGhost`. */
  loadShapes?(signal?: AbortSignal): Promise<void>;
  /**
   * Builds an outline morph between two ghosts already added to the layer, or null to keep
   * stretch-and-crossfade for this track.
   */
  createShapeGhost?(source: Element, target: Element, track: Track): ShapeGhost | null;
  /**
   * Measures the display frame rate for `shapes: 'auto'`; core and dom own no clock, so the renderer does.
   * The driver calls `touch()` on every frame drawn between the endpoints and `stop()` when done.
   * `onSlow` fires at most once, when playback stays below `minFps`.
   */
  watchFrameRate?(minFps: number, onSlow: (fps: number) => void): FrameRateWatch;
}

export interface FrameRateWatch {
  touch(): void;
  stop(): void;
}

/**
 * `'auto'` morphs outlines and switches to stretch-and-crossfade once playback falls below
 * `minFps`; `'always'` never switches (use it for video export); `'off'` never morphs outlines.
 */
export type ShapeMode = 'auto' | 'always' | 'off';

export type FormulaInput = LatexState | RenderedFormula | { adopt: Element; fallback?: LatexState };

export interface MathMorphOptions<Opts = unknown> extends Omit<PlanOptions, 'origins'> {
  duration?: number;
  strict?: boolean;
  signal?: AbortSignal;
  rendererOptions?: Opts;
  progressMap?: (t: number) => number;
  /** Outline morphing for matched glyphs whose shapes differ, on renderers that support it. Default `'auto'`. */
  shapes?: ShapeMode;
  /** Frame rate below which `shapes: 'auto'` falls back. Default 50. */
  minFps?: number;
}

export interface MathMorph {
  readonly duration: number;
  readonly plan: MorphPlan;
  readonly diagnostics: readonly MorphDiagnostic[];
  readonly state: 'ready' | 'refreshing' | 'disposed';
  readonly target: RenderedFormula;
  /** Whether outlines are being morphed right now; false before any shape track exists or after an auto fallback. */
  readonly shapes: boolean;
  render(progress: number): void;
  refresh(): Promise<MorphPlan>;
  dispose(options?: { settle?: 'source' | 'target' }): void;
}
