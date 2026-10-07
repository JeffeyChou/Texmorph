# @texmorph/core

Pure TypeScript: token matching, plans and frame sampling. No DOM and no clock, so it also runs in Node and workers.

## Plans

```ts
function createMorphPlan(from: FormulaSnapshot, to: FormulaSnapshot, options?: PlanOptions): MorphPlan;
function createCrossfadePlan(fromBounds: Box, toBounds: Box, options?: Pick<PlanOptions, 'easing'>): MorphPlan;
function reversePlan(plan: MorphPlan): MorphPlan;
function sampleMorph(plan: MorphPlan, t: number): FrameState;
```

| Function | Description |
|---|---|
| `createMorphPlan` | Validates and copies both snapshots, matches tokens and builds an immutable, JSON-serializable plan. Throws `RangeError` for invalid geometry or options. |
| `createCrossfadePlan` | A plan that crossfades two whole formulas; used as the fallback. |
| `reversePlan` | A plan whose frame at `t` equals the original's at `1 − t`. |
| `sampleMorph` | Pure: the frame at progress `t` (clamped to `[0, 1]`; `NaN` throws). |

```ts
interface PlanOptions {
  morphMap?: MorphMap;
  easing?: EasingSpec;
  arc?: number;
  removed?: { endScale?: number };
  added?: { startScale?: number; start?: number };
  origins?: { from: Point; to: Point };   // offsets of the two formula roots
}

interface FrameState {
  t: number;
  eased: number;
  ghosts: readonly GhostFrame[];
  sourceLayerOpacity: number;
  targetLayerOpacity: number;
  rootOpacity?: { source: number; target: number };   // crossfade plans
  settled?: 'source' | 'target';                      // exactly at an endpoint
}

interface GhostFrame {
  trackId: string;
  layer: 'source' | 'target';
  tx: number; ty: number;   // top-left of the unscaled ghost
  sx: number; sy: number;   // scale relative to the ghost's own size
  opacity: number;
  color?: RGBA;
}
```

`MorphPlan` contains `version`, `mode` (`'tokens' | 'crossfade'`), `direction`, `easing`, the `from`/`to` snapshots, `origins`, `stage`, `matched`/`removed`/`added`, `tracks` and `diagnostics`. A `Track` describes one moving element: its subject, start and end boxes and styles, arc control point, opacity schedule, scale and transform origin.

## Matching

```ts
function matchTokens(from: FormulaSnapshot, to: FormulaSnapshot, map?: MorphMap, origins?: { from: Point; to: Point }): MatchResult;
function normalizeMorphMap(map: MorphMap | undefined, from: FormulaSnapshot, to: FormulaSnapshot): NormalizeMorphMapResult;

type MorphMap =
  | Readonly<Record<string, number>>
  | ReadonlyArray<readonly [number, number]>
  | ReadonlyArray<{ readonly source: number; readonly target: number }>;

interface MatchResult {
  readonly matched: readonly MatchPair[];
  readonly removed: readonly number[];
  readonly added: readonly number[];
  readonly diagnostics: readonly MorphDiagnostic[];
}

interface MatchPair { readonly source: number; readonly target: number; readonly reason: 'explicit' | 'exact' | 'structure' | 'text' }
interface NormalizeMorphMapResult { readonly pairs: readonly MatchPair[]; readonly diagnostics: readonly MorphDiagnostic[] }
```

Results do not depend on the order of the token arrays. See [Matching and morphMap](/guide/matching) for the rules.

## Easing

```ts
function resolveEasing(spec?: EasingSpec): EasingFunction;   // throws RangeError for invalid specs
function parseEasing(css: string): EasingSpec;              // 'ease-out', 'steps(4)', 'cubic-bezier(…)', …
function validateEasing(spec: EasingSpec): void;
const EASING_NAMES: readonly EasingName[];
type EasingFunction = (t: number) => number;
```

### EasingSpec

```ts
type EasingSpec =
  | EasingName
  | { type: 'cubic-bezier'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'steps'; count: number; position?: 'start' | 'end' }
  | { type: 'spring'; stiffness?: number; damping?: number; mass?: number };
```

`EasingName` is one of `linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`, `easeInElastic`, `easeOutElastic`, `easeInOutElastic`, `easeInBounce`, `easeOutBounce`, `easeInOutBounce`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `spring`.

## Snapshots and tokens

A renderer describes a measured formula as a `FormulaSnapshot`:

```ts
interface FormulaSnapshot {
  readonly renderer: { readonly name: string; readonly version: string };
  readonly tokens: readonly MathToken[];
  readonly bounds: Box;
  readonly em: number;
}

interface MathToken {
  readonly id: string;
  readonly kind: 'text' | 'structure';
  readonly index: number;            // text tokens first, then structure tokens; dense
  readonly text: string;             // one grapheme; '' for structure tokens
  readonly role: AtomRole | StructureRole;
  readonly script: 0 | 1 | 2;
  readonly context: readonly ContextFrame[];   // enclosing 'frac' | 'sqrt' | 'script' | 'sized', innermost first
  readonly visualKey: string;        // equal keys draw identically when scaled
  readonly box: Box;                 // relative to the formula root, CSS px
  readonly style: TokenStyle;        // { color: RGBA; fontSize: number }
  readonly key?: string;
}

type AtomRole = 'ord' | 'op' | 'bin' | 'rel' | 'open' | 'close' | 'punct' | 'inner' | 'unknown';
type StructureRole = 'frac-bar' | 'sqrt-bar' | 'sqrt-sign' | 'overline' | 'underline' | 'svg' | 'rule';
type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
```

`validateSnapshot(snapshot, name)` throws `RangeError` for non-finite or negative geometry and for indices that are not dense and unique.

## Diagnostics

```ts
interface MorphDiagnostic {
  readonly code: DiagnosticCode;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly detail?: JsonValue;
}

const DIAGNOSTIC_CODES: readonly DiagnosticCode[];
```

See [Errors and diagnostics](/guide/errors) for the meaning of each code.

## Utilities

| Export | Description |
|---|---|
| `clamp01(value)` | Clamps to `[0, 1]`; `NaN` throws. |
| `unionBox(a, b)` | The smallest box containing both boxes. |
| `DEFAULTS` | `{ easing: 'easeInOutCubic', arc: 0.2, removedEndScale: 0.7, addedStartScale: 0.7, addedStart: 0.3 }` |
