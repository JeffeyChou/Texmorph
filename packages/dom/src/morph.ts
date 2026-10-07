import {
  createCrossfadePlan,
  createMorphPlan,
  sampleMorph,
  unionBox,
  type Box,
  type MathToken,
  type MorphDiagnostic,
  type MorphPlan,
  type Point,
  type Track,
} from '@texmorph/core';
import type { FormulaInput, FormulaRenderer, FrameRateWatch, GhostLayer, LatexState, MathMorph, MathMorphOptions, RenderedFormula, ShapeGhost } from './types.ts';

export class TexMorphLifecycleError extends Error {
  override name = 'TexMorphLifecycleError';
}

export class MorphPrepareError extends Error {
  override name = 'MorphPrepareError';
  readonly diagnostics: readonly MorphDiagnostic[];

  constructor(message: string, diagnostics: readonly MorphDiagnostic[]) {
    super(message);
    this.diagnostics = diagnostics;
  }
}

export const DEFAULT_DURATION = 800;
const DEFAULT_MIN_FPS = 50;

/** Set once `shapes: 'auto'` has fallen back on this page; later auto morphs start without outline morphing. */
let slowPage = false;

type Side = 'source' | 'target';

interface Resolved {
  rendered: RenderedFormula;
  owned: boolean;
  failed: boolean;
}

interface Built {
  plan: MorphPlan;
  layer: GhostLayer | null;
  ghosts: Map<string, Element>;
  shapes: Map<string, ShapeGhost>;
  masks: Record<Side, (() => void) | null>;
}

function isRendered(input: FormulaInput): input is RenderedFormula {
  return typeof input === 'object' && 'root' in input && 'snapshot' in input;
}

function isAdopt(input: FormulaInput): input is { adopt: Element; fallback?: LatexState } {
  return typeof input === 'object' && 'adopt' in input;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

/** Settles as soon as the signal aborts, even if the wrapped promise never does. */
function abortable<T>(promise: Promise<T> | T, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return Promise.resolve(promise);
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/** Marks a side as unusable when its root has no layout box at all (for example inside display:none). */
function checkLayout(rendered: RenderedFormula, stage: HTMLElement): RenderedFormula {
  const diagnostics = rendered.diagnostics.filter((d) => d.code !== 'layout/no-size');
  const box = localBox(rendered.root, stage);
  if (box.width > 0 || box.height > 0) return diagnostics.length === rendered.diagnostics.length ? rendered : { ...rendered, diagnostics };
  return { ...rendered, diagnostics: [...diagnostics, { code: 'layout/no-size', severity: 'error', message: 'formula root has no layout box' }] };
}

/** AbortSignal.any is missing on the iOS 16 baseline, so combine two signals by hand. */
function eitherSignal(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const combined = new AbortController();
  const forward = (source: AbortSignal) => () => combined.abort(source.reason);
  a.addEventListener('abort', forward(a), { once: true });
  b.addEventListener('abort', forward(b), { once: true });
  return combined.signal;
}

function hasErrors(rendered: RenderedFormula): boolean {
  return rendered.diagnostics.some((d) => d.severity === 'error');
}

function scaleOf(el: HTMLElement): { sx: number; sy: number } {
  const rect = el.getBoundingClientRect();
  // offsetWidth/offsetHeight are rounded, so a difference below 1px means no ancestor transform.
  let sx = rect.width && el.offsetWidth && Math.abs(rect.width - el.offsetWidth) >= 1 ? rect.width / el.offsetWidth : 1;
  let sy = rect.height && el.offsetHeight && Math.abs(rect.height - el.offsetHeight) >= 1 ? rect.height / el.offsetHeight : sx;
  if (!Number.isFinite(sx) || sx === 0) sx = 1;
  if (!Number.isFinite(sy) || sy === 0) sy = 1;
  return { sx, sy };
}

function localBox(el: Element, stage: HTMLElement): Box {
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const { sx, sy } = scaleOf(stage);
  return { x: (r.left - s.left) / sx, y: (r.top - s.top) / sy, width: r.width / sx, height: r.height / sy };
}

function placeholder(state: LatexState, renderer: FormulaRenderer, container: HTMLElement, error: unknown): RenderedFormula {
  const root = document.createElement('span');
  root.textContent = state.latex;
  container.append(root);
  return {
    root,
    snapshot: { renderer: { name: renderer.name, version: renderer.version }, tokens: [], bounds: { x: 0, y: 0, width: 0, height: 0 }, em: 0 },
    state,
    renderer: { name: renderer.name, version: renderer.version },
    diagnostics: [{ code: 'render/error', severity: 'error', message: error instanceof Error ? error.message : String(error) }],
  };
}

export async function renderFormula<Opts>(
  renderer: FormulaRenderer<Opts>,
  host: HTMLElement,
  state: LatexState,
  opts?: Opts,
  signal?: AbortSignal,
): Promise<RenderedFormula> {
  await abortable(renderer.ready?.(signal), signal);
  const container = document.createElement('div');
  host.append(container);
  try {
    return await abortable(renderer.render(container, state, opts, signal), signal);
  } catch (error) {
    container.remove();
    throw error;
  }
}

class Morph<Opts> implements MathMorph {
  readonly duration: number;
  private _state: MathMorph['state'] = 'ready';
  private built!: Built;
  private progress = 0;
  private refreshGeneration = 0;
  private readonly prepDiagnostics: MorphDiagnostic[] = [];
  private readonly lifetime = new AbortController();
  private refreshing: AbortController | null = null;
  private readonly initialMinHeight: string;
  private readonly initialMinWidth: string;
  private settled: Side | null = null;
  private shapeActive: boolean;
  private watch: FrameRateWatch | null = null;

  constructor(
    private readonly renderer: FormulaRenderer<Opts>,
    private readonly stage: HTMLElement,
    private readonly layers: Record<Side, HTMLElement>,
    private readonly sides: Record<Side, Resolved>,
    private readonly options: MathMorphOptions<Opts>,
    extra: readonly MorphDiagnostic[],
    shapesLoaded: boolean,
  ) {
    this.duration = options.duration ?? DEFAULT_DURATION;
    const mode = options.shapes ?? 'auto';
    this.shapeActive = shapesLoaded && (mode === 'always' || (mode === 'auto' && !slowPage));
    this.prepDiagnostics.push(...extra);
    this.initialMinHeight = stage.style.minHeight;
    this.initialMinWidth = stage.style.minWidth;
  }

  root(side: Side): Element {
    return this.sides[side].rendered.root;
  }

  get state(): MathMorph['state'] {
    return this._state;
  }

  get plan(): MorphPlan {
    return this.built.plan;
  }

  get diagnostics(): readonly MorphDiagnostic[] {
    return [...this.diagnosticsSoFar(), ...this.built.plan.diagnostics];
  }

  get shapes(): boolean {
    return this.built.shapes.size > 0;
  }

  get target(): RenderedFormula {
    if (this._state === 'disposed' && this.settled !== 'target') {
      throw new TexMorphLifecycleError('target is not available after dispose({ settle: "source" })');
    }
    return this.sides.target.rendered;
  }

  init(): void {
    this.built = this.build();
    this.attach(this.built);
    this.sizeStage();
    this.render(0);
  }

  /** Reserves the union height of both formulas so render never changes host geometry. */
  private sizeStage(): void {
    this.stage.style.minHeight = this.initialMinHeight;
    this.stage.style.minWidth = this.initialMinWidth;
    const boxes = (['source', 'target'] as const).map((side) => localBox(this.sides[side].rendered.root, this.stage));
    this.stage.style.minHeight = `${Math.max(0, ...boxes.map((b) => b.y + b.height))}px`;
    this.stage.style.minWidth = `${Math.max(0, ...boxes.map((b) => b.x + b.width))}px`;
    if (this.built.plan.stage.x < 0 || this.built.plan.stage.y < 0) {
      const code = 'layout/stage-constrained';
      if (!this.prepDiagnostics.some((d) => d.code === code)) {
        this.prepDiagnostics.push({ code, severity: 'info', message: 'formula extends beyond the stage origin' });
      }
    }
  }

  private origins(): { from: Point; to: Point } {
    const at = (side: Side): Point => {
      const b = localBox(this.sides[side].rendered.root, this.stage);
      return { x: b.x, y: b.y };
    };
    return { from: at('source'), to: at('target') };
  }

  private build(): Built {
    const src = this.sides.source;
    const tgt = this.sides.target;
    const crossfade = (): Built => ({
      plan: createCrossfadePlan(localBox(src.rendered.root, this.stage), localBox(tgt.rendered.root, this.stage), this.options.easing ? { easing: this.options.easing } : {}),
      layer: null,
      ghosts: new Map(),
      shapes: new Map(),
      masks: { source: null, target: null },
    });
    if (src.failed || tgt.failed || hasErrors(src.rendered) || hasErrors(tgt.rendered)) {
      if (this.options.strict) throw new MorphPrepareError('formula could not be rendered or measured', this.diagnosticsSoFar());
      return crossfade();
    }
    let plan: MorphPlan;
    try {
      const { easing, arc, removed, added, morphMap } = this.options;
      plan = createMorphPlan(src.rendered.snapshot, tgt.rendered.snapshot, {
        ...(easing === undefined ? {} : { easing }),
        ...(arc === undefined ? {} : { arc }),
        ...(removed === undefined ? {} : { removed }),
        ...(added === undefined ? {} : { added }),
        ...(morphMap === undefined ? {} : { morphMap }),
        origins: this.origins(),
      });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      if (this.options.strict) throw new MorphPrepareError(error.message, this.diagnosticsSoFar());
      this.prepDiagnostics.push({ code: 'layout/zero-box', severity: 'warn', message: error.message });
      return crossfade();
    }
    const layer = this.renderer.createGhostLayer(this.stage, plan.stage);
    try {
      const ghosts = this.buildGhosts(plan, layer);
      const shapes = this.shapeActive ? this.buildShapes(plan, layer, ghosts) : new Map<string, ShapeGhost>();
      this.placeAll(plan, layer, ghosts, shapes, sampleMorph(plan, 0.5));
      return { plan, layer, ghosts, shapes, masks: { source: null, target: null } };
    } catch (error) {
      layer.dispose();
      layer.root.remove();
      throw error;
    }
  }

  private buildGhosts(plan: MorphPlan, layer: GhostLayer): Map<string, Element> {
    const ghosts = new Map<string, Element>();
    const tokenOf = (side: Side, index: number | undefined): MathToken =>
      this.sides[side].rendered.snapshot.tokens[index as number] as MathToken;
    const make = (track: Track, side: Side, index: number | undefined): void => {
      const ghost = this.renderer.createGhost(tokenOf(side, index), this.sides[side].rendered);
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('data-texmorph-ghost', `${track.id}:${side}`);
      layer.add(ghost);
      ghosts.set(`${track.id}:${side}`, ghost);
    };
    for (const track of plan.tracks) {
      if (track.subject.type !== 'token') continue;
      if (track.kind === 'matched') {
        make(track, 'source', track.subject.source);
        if (track.appearance === 'crossfade') make(track, 'target', track.subject.target);
      } else if (track.kind === 'removed') {
        make(track, 'source', track.subject.source);
      } else if (track.kind === 'added') {
        make(track, 'target', track.subject.target);
      }
    }
    return ghosts;
  }

  /** Replaces the two crossfading ghosts of each matched track whose glyphs differ with one outline morph. */
  private buildShapes(plan: MorphPlan, layer: GhostLayer, ghosts: Map<string, Element>): Map<string, ShapeGhost> {
    const shapes = new Map<string, ShapeGhost>();
    const create = this.renderer.createShapeGhost?.bind(this.renderer);
    if (!create) return shapes;
    for (const track of plan.tracks) {
      if (track.kind !== 'matched' || track.appearance !== 'crossfade') continue;
      const source = ghosts.get(`${track.id}:source`);
      const target = ghosts.get(`${track.id}:target`);
      const shape = source && target ? create(source, target, track) : null;
      if (!shape || !source || !target) continue;
      shape.el.setAttribute('aria-hidden', 'true');
      shape.el.setAttribute('data-texmorph-shape', track.id);
      layer.add(shape.el);
      setShown(source, false);
      setShown(target, false);
      shapes.set(track.id, shape);
    }
    return shapes;
  }

  private placeAll(
    plan: MorphPlan,
    layer: GhostLayer,
    ghosts: Map<string, Element>,
    shapes: Map<string, ShapeGhost>,
    frame: ReturnType<typeof sampleMorph>,
  ): void {
    const tracks = new Map(plan.tracks.map((tr) => [tr.id, tr]));
    for (const g of frame.ghosts) {
      const track = tracks.get(g.trackId);
      if (!track) continue;
      const shape = shapes.get(g.trackId);
      if (shape) {
        if (g.layer !== 'source') continue;
        shape.draw(g.mix ?? 1 - g.opacity);
        layer.place(shape.el, { ...g, sx: 1, sy: 1, opacity: 1 }, track);
        continue;
      }
      const ghost = ghosts.get(`${g.trackId}:${g.layer}`);
      if (ghost) layer.place(ghost, g, track);
    }
  }

  /** Lets the renderer sample the frame rate while the morph is between its endpoints. */
  private watchFrameRate(): void {
    if (!this.watch) {
      const minFps = this.options.minFps ?? DEFAULT_MIN_FPS;
      this.watch = this.renderer.watchFrameRate?.(minFps, (fps) => {
        if (!this.isDisposed() && this.built.shapes.size) this.fallBackFromShapes(fps);
      }) ?? null;
    }
    this.watch?.touch();
  }

  private fallBackFromShapes(fps: number): void {
    slowPage = true;
    this.shapeActive = false;
    this.watch?.stop();
    this.watch = null;
    const { shapes, ghosts } = this.built;
    for (const [id, shape] of shapes) {
      shape.el.remove();
      for (const side of ['source', 'target'] as const) {
        const ghost = ghosts.get(`${id}:${side}`);
        if (ghost) setShown(ghost, true);
      }
    }
    shapes.clear();
    this.prepDiagnostics.push({
      code: 'shape/fallback',
      severity: 'info',
      message: `playback ran at ${Math.round(fps)} fps; switched to stretch-and-crossfade`,
      detail: { fps: Math.round(fps) },
    });
    this.render(this.progress);
  }

  private diagnosticsSoFar(): MorphDiagnostic[] {
    return [...this.sides.source.rendered.diagnostics, ...this.sides.target.rendered.diagnostics, ...this.prepDiagnostics];
  }

  private attach(built: Built): void {
    if (built.layer && !built.layer.root.isConnected) this.stage.append(built.layer.root);
  }

  private detach(built: Built): void {
    built.layer?.dispose();
    built.layer?.root.remove();
    for (const side of ['source', 'target'] as const) this.setMasked(built, side, false);
  }

  private setMasked(built: Built, side: Side, masked: boolean): void {
    const restore = built.masks[side];
    if (masked && !restore) built.masks[side] = this.renderer.maskTokens(this.sides[side].rendered);
    else if (!masked && restore) {
      restore();
      built.masks[side] = null;
    }
  }

  render(progress: number): void {
    if (this._state === 'disposed') throw new TexMorphLifecycleError('render() called after dispose()');
    const t = this.options.progressMap ? this.options.progressMap(progress) : progress;
    const { plan, layer, ghosts } = this.built;
    const frame = sampleMorph(plan, t);
    this.progress = progress;
    const accessible: Side = frame.settled === 'target' ? 'target' : 'source';
    this.layers[accessible].removeAttribute('aria-hidden');
    this.layers[accessible === 'source' ? 'target' : 'source'].setAttribute('aria-hidden', 'true');
    if (frame.rootOpacity) {
      this.layers.source.style.opacity = String(frame.rootOpacity.source);
      this.layers.target.style.opacity = String(frame.rootOpacity.target);
      return;
    }
    if (frame.settled) {
      const other: Side = frame.settled === 'source' ? 'target' : 'source';
      this.setMasked(this.built, frame.settled, false);
      this.layers[frame.settled].style.opacity = '1';
      this.layers[other].style.opacity = '0';
      if (layer) (layer.root as HTMLElement | SVGElement).style.visibility = 'hidden';
      return;
    }
    this.setMasked(this.built, 'source', true);
    this.setMasked(this.built, 'target', true);
    this.layers.source.style.opacity = String(frame.sourceLayerOpacity);
    this.layers.target.style.opacity = String(frame.targetLayerOpacity);
    if (!layer) return;
    (layer.root as HTMLElement | SVGElement).style.removeProperty('visibility');
    this.placeAll(plan, layer, ghosts, this.built.shapes, frame);
    if (this.built.shapes.size && (this.options.shapes ?? 'auto') === 'auto') this.watchFrameRate();
  }

  async refresh(): Promise<MorphPlan> {
    if (this._state === 'disposed') throw new TexMorphLifecycleError('refresh() called after dispose()');
    this.refreshing?.abort(new DOMException('superseded by a newer refresh', 'AbortError'));
    const controller = new AbortController();
    this.refreshing = controller;
    const signal = eitherSignal(this.lifetime.signal, controller.signal);
    this._state = 'refreshing';
    try {
      try {
        await abortable(this.renderer.ready?.(signal), signal);
      } catch (error) {
        if (signal.aborted) return this.built.plan;
        throw error;
      }
      if (signal.aborted) return this.built.plan;
      this.commit(this.prepareRefresh());
      return this.built.plan;
    } finally {
      if (this.refreshing === controller) {
        this.refreshing = null;
        if (!this.isDisposed()) this._state = 'ready';
      }
    }
  }

  /** Re-measures and builds without touching live state; restores everything it changed if anything throws. */
  private prepareRefresh(): Built {
    const sides = { source: this.sides.source.rendered, target: this.sides.target.rendered };
    const sizes = { minHeight: this.stage.style.minHeight, minWidth: this.stage.style.minWidth };
    try {
      this.stage.style.minHeight = this.initialMinHeight;
      this.stage.style.minWidth = this.initialMinWidth;
      for (const side of ['source', 'target'] as const) {
        const resolved = this.sides[side];
        if (!resolved.failed) resolved.rendered = checkLayout(this.renderer.resnapshot(resolved.rendered), this.stage);
      }
      return this.build();
    } catch (error) {
      this.sides.source.rendered = sides.source;
      this.sides.target.rendered = sides.target;
      this.stage.style.minHeight = sizes.minHeight;
      this.stage.style.minWidth = sizes.minWidth;
      throw error;
    }
  }

  private commit(next: Built): void {
    const previous = this.built;
    this.detach(previous);
    this.built = next;
    this.attach(next);
    this.sizeStage();
    this.render(this.progress);
  }


  private isDisposed(): boolean {
    return this._state === 'disposed';
  }

  dispose(options: { settle?: Side } = {}): void {
    if (this._state === 'disposed') return;
    const settle = options.settle ?? 'target';
    this._state = 'disposed';
    this.refreshGeneration++;
    this.lifetime.abort(new TexMorphLifecycleError('disposed'));
    this.watch?.stop();
    this.watch = null;
    this.settled = settle;
    this.detach(this.built);
    this.stage.style.minHeight = this.initialMinHeight;
    this.stage.style.minWidth = this.initialMinWidth;
    const kept = this.sides[settle].rendered.root;
    kept.style.removeProperty('opacity');
    kept.removeAttribute('aria-hidden');
    this.stage.before(kept);
    const other = this.sides[settle === 'source' ? 'target' : 'source'];
    other.rendered.root.remove();
    this.stage.remove();
  }

}

function setShown(el: Element, shown: boolean): void {
  const style = (el as HTMLElement | SVGElement).style;
  if (shown) style.removeProperty('display');
  else style.display = 'none';
}

function sameRenderer(rendered: RenderedFormula, renderer: FormulaRenderer<never> | FormulaRenderer<unknown>): boolean {
  return rendered.renderer.name === renderer.name && rendered.renderer.version === renderer.version;
}

export async function createMorphWith<Opts>(
  renderer: FormulaRenderer<Opts>,
  host: HTMLElement,
  from: FormulaInput,
  to: FormulaInput,
  options: MathMorphOptions<Opts> = {},
): Promise<MathMorph> {
  const { signal } = options;
  throwIfAborted(signal);
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    throw new MorphPrepareError('Intl.Segmenter is required', [{ code: 'env/no-segmenter', severity: 'error', message: 'Intl.Segmenter is required' }]);
  }
  await abortable(renderer.ready?.(signal), signal);
  const extra: MorphDiagnostic[] = [];
  let shapesLoaded = false;
  if ((options.shapes ?? 'auto') !== 'off' && renderer.loadShapes && renderer.createShapeGhost) {
    try {
      await abortable(renderer.loadShapes(signal), signal);
      shapesLoaded = true;
    } catch (error) {
      throwIfAborted(signal);
      extra.push({ code: 'shape/unavailable', severity: 'warn', message: `outline morphing unavailable: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  const stage = document.createElement('div');
  stage.className = 'texmorph-stage';
  stage.style.cssText = 'position:relative;display:flow-root;visibility:hidden;overflow:visible';
  const layers: Record<Side, HTMLElement> = {
    source: document.createElement('div'),
    target: document.createElement('div'),
  };
  layers.source.className = 'texmorph-source';
  layers.source.style.cssText = 'position:relative;display:flow-root';
  layers.target.className = 'texmorph-target';
  layers.target.style.cssText = 'position:absolute;left:0;top:0;width:100%;display:flow-root';
  stage.append(layers.source, layers.target);

  const anchor = isRendered(from) ? from.root : isAdopt(from) ? from.adopt : null;
  if (anchor?.isConnected && host.contains(anchor)) anchor.before(stage);
  else host.append(stage);

  const created: Element[] = [];
  const moved: Element[] = [];

  const resolve = async (input: FormulaInput, side: Side): Promise<Resolved> => {
    const layer = layers[side];
    const fresh = async (state: LatexState): Promise<Resolved> => {
      const container = document.createElement('div');
      layer.append(container);
      created.push(container);
      try {
        return { rendered: await abortable(renderer.render(container, state, options.rendererOptions, signal), signal), owned: true, failed: false };
      } catch (error) {
        throwIfAborted(signal);
        if (options.strict) throw new MorphPrepareError(error instanceof Error ? error.message : String(error), [{ code: 'render/error', severity: 'error', message: String(error) }]);
        container.remove();
        return { rendered: placeholder(state, renderer, layer, error), owned: true, failed: true };
      }
    };
    if (isRendered(input)) {
      if (input.root.isConnected && sameRenderer(input, renderer)) return { rendered: input, owned: false, failed: false };
      extra.push({ code: 'render/reuse-mismatch', severity: 'warn', message: 'rendered formula cannot be reused; re-rendering from its state' });
      return fresh(input.state);
    }
    if (isAdopt(input)) {
      const adopted = renderer.adopt ? await abortable(renderer.adopt(input.adopt, signal), signal) : null;
      if (adopted) return { rendered: adopted, owned: false, failed: false };
      if (!input.fallback) {
        throw new MorphPrepareError('element cannot be adopted by this renderer', [{ code: 'render/adopt-mismatch', severity: 'error', message: 'element cannot be adopted' }]);
      }
      extra.push({ code: 'render/adopt-mismatch', severity: 'warn', message: 'element cannot be adopted; re-rendering from fallback' });
      return fresh(input.fallback);
    }
    return fresh(input);
  };

  const cleanup = (): void => {
    for (const el of created) el.remove();
    for (const el of moved) {
      if (stage.isConnected) stage.before(el);
      (el as HTMLElement | SVGElement).style.removeProperty('opacity');
      el.removeAttribute('aria-hidden');
    }
    stage.remove();
  };

  try {
    const target = await resolve(to, 'target');
    throwIfAborted(signal);
    const source = await resolve(from, 'source');
    throwIfAborted(signal);

    for (const [side, resolved] of [['source', source], ['target', target]] as const) {
      if (!resolved.owned) {
        moved.push(resolved.rendered.root);
        layers[side].append(resolved.rendered.root);
      }
    }
    for (const side of [source, target]) {
      if (!side.failed) side.rendered = checkLayout(renderer.resnapshot(side.rendered), stage);
    }

    const morph = new Morph(renderer, stage, layers, { source, target }, options, extra, shapesLoaded);
    morph.init();
    stage.style.visibility = 'visible';
    return morph;
  } catch (error) {
    cleanup();
    throw error;
  }
}

export { unionBox };
