export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Box = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

export type TokenKind = 'text' | 'structure';
export type AtomRole = 'ord' | 'op' | 'bin' | 'rel' | 'open' | 'close' | 'punct' | 'inner' | 'unknown';
export type StructureRole = 'frac-bar' | 'sqrt-bar' | 'sqrt-sign' | 'overline' | 'underline' | 'svg' | 'rule';
export type ScriptLevel = 0 | 1 | 2;
/** Ancestor structure chain, innermost first, repeats kept. Exact matching compares it as a whole. */
export type ContextFrame = 'frac' | 'sqrt' | 'script' | 'sized';

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface TokenStyle {
  color: RGBA;
  /** Used for ghost creation and diagnostics only; size changes are expressed through scale. */
  fontSize: number;
}

export interface MathToken {
  readonly id: string;
  readonly kind: TokenKind;
  /** Text tokens in document order, then structure tokens. Dense and unique. */
  readonly index: number;
  readonly text: string;
  readonly role: AtomRole | StructureRole;
  readonly script: ScriptLevel;
  readonly context: readonly ContextFrame[];
  /** Opaque renderer-provided appearance signature. */
  readonly visualKey: string;
  /** Relative to the formula root, never the stage. CSS px. */
  readonly box: Box;
  readonly style: TokenStyle;
  readonly key?: string;
}

export interface FormulaSnapshot {
  readonly renderer: { readonly name: string; readonly version: string };
  readonly tokens: readonly MathToken[];
  readonly bounds: Box;
  readonly em: number;
}

export type MorphMap =
  | Readonly<Record<string, number>>
  | ReadonlyArray<readonly [number, number]>
  | ReadonlyArray<{ readonly source: number; readonly target: number }>;

export type EasingName =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic'
  | 'easeInBounce'
  | 'easeOutBounce'
  | 'easeInOutBounce'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'spring';

export type EasingSpec =
  | EasingName
  | { readonly type: 'cubic-bezier'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
  | { readonly type: 'steps'; readonly count: number; readonly position?: 'start' | 'end' }
  | { readonly type: 'spring'; readonly stiffness?: number; readonly damping?: number; readonly mass?: number };

export interface PlanOptions {
  morphMap?: MorphMap;
  easing?: EasingSpec;
  arc?: number;
  removed?: { endScale?: number };
  added?: { startScale?: number; start?: number };
  origins?: { from: Point; to: Point };
}

export type MatchReason = 'explicit' | 'exact' | 'structure' | 'text';

export interface MatchPair {
  readonly source: number;
  readonly target: number;
  readonly reason: MatchReason;
}

export type TrackSubject =
  | { readonly type: 'token'; readonly source?: number; readonly target?: number }
  | { readonly type: 'root'; readonly side: 'source' | 'target' };

export interface Track {
  readonly id: string;
  readonly kind: 'matched' | 'removed' | 'added' | 'root';
  readonly subject: TrackSubject;
  readonly from: { readonly box: Box; readonly style?: TokenStyle };
  readonly to: { readonly box: Box; readonly style?: TokenStyle };
  readonly appearance: 'same' | 'crossfade';
  readonly visualKeys?: { readonly from: string; readonly to: string };
  readonly arc?: Point;
  readonly opacity: {
    readonly from: number;
    readonly to: number;
    readonly window: readonly [number, number];
    readonly param: 'global' | 'local';
  };
  readonly scale?: { readonly from: number; readonly to: number };
  readonly origin: 'top-left' | 'center';
}

export interface MorphPlan {
  readonly version: 1;
  readonly mode: 'tokens' | 'crossfade';
  readonly direction: 'forward' | 'reverse';
  readonly easing: EasingSpec;
  readonly from: FormulaSnapshot | null;
  readonly to: FormulaSnapshot | null;
  readonly origins: { readonly from: Point; readonly to: Point };
  readonly stage: Box;
  readonly matched: readonly MatchPair[];
  readonly removed: readonly number[];
  readonly added: readonly number[];
  readonly tracks: readonly Track[];
  readonly diagnostics: readonly MorphDiagnostic[];
}

export interface GhostFrame {
  trackId: string;
  layer: 'source' | 'target';
  /** Top-left of the unscaled ghost in stage coordinates. Scale is applied around track.origin. */
  tx: number;
  ty: number;
  /** Relative to the ghost's native size (from.box for the source layer, to.box for the target layer). */
  sx: number;
  sy: number;
  opacity: number;
  color?: RGBA;
  /** Eased progress of a matched track whose glyphs differ; may leave [0, 1] with overshooting easings. */
  mix?: number;
}

export interface FrameState {
  t: number;
  eased: number;
  ghosts: readonly GhostFrame[];
  sourceLayerOpacity: number;
  targetLayerOpacity: number;
  rootOpacity?: { source: number; target: number };
  /** Set at the exact endpoints, where hosts should show the real formula instead of ghosts. */
  settled?: 'source' | 'target';
}

export const DIAGNOSTIC_CODES = [
  'map/out-of-range',
  'map/duplicate',
  'map/kind-mismatch',
  'map/invalid',
  'map/structure-index',
  'layout/zero-box',
  'layout/no-size',
  'layout/fonts-not-ready',
  'layout/stage-constrained',
  'render/error',
  'render/unknown-structure',
  'render/adopt-mismatch',
  'render/reuse-mismatch',
  'env/no-segmenter',
  'fallback/crossfade',
  'compat/legacy-deviation',
  'easing/unknown',
  'shape/unavailable',
  'shape/fallback',
] as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];
export type DiagnosticSeverity = 'info' | 'warn' | 'error';

export interface MorphDiagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly detail?: JsonValue;
}
