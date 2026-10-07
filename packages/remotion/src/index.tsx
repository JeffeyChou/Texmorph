import { createMorphWith, type FormulaRenderer, type LatexState, type MathMorph, type MathMorphOptions } from '@texmorph/dom';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { cancelRender, continueRender, delayRender, useCurrentFrame } from 'remotion';

export interface TexMorphProps {
  from: LatexState;
  to: LatexState;
  renderer: FormulaRenderer;
  durationInFrames: number;
  startFrame?: number;
  options?: Omit<MathMorphOptions, 'signal'>;
  prepareTimeoutMs?: number;
  onReady?: (morph: MathMorph) => void;
  className?: string;
  style?: CSSProperties;
}

const ids = new WeakMap<object, number>();
let nextId = 0;

/** Stable identity for objects and functions, so dependency keys change when behavior does. */
function identity(value: object): number {
  let id = ids.get(value);
  if (id === undefined) {
    id = ++nextId;
    ids.set(value, id);
  }
  return id;
}

/** Serializes props for the effect key; functions and the renderer are keyed by identity. Memoize them to avoid rebuilds. */
export function dependencyKey(from: LatexState, to: LatexState, renderer: FormulaRenderer, options: object | undefined): string {
  return JSON.stringify([from, to, identity(renderer), options ?? null], (_k, v: unknown) =>
    typeof v === 'function' ? `fn#${identity(v as object)}` : v,
  );
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function progressAt(frame: number, startFrame: number, durationInFrames: number): number {
  if (!Number.isFinite(durationInFrames) || durationInFrames <= 0) return frame >= startFrame ? 1 : 0;
  const t = (frame - startFrame) / durationInFrames;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

export function TexMorph(props: TexMorphProps): ReactElement {
  const { from, to, renderer, durationInFrames, startFrame = 0, options, onReady, className, style } = props;
  const prepareTimeoutMs = positive(props.prepareTimeoutMs, 10_000);
  const frame = useCurrentFrame();
  const t = progressAt(frame, startFrame, durationInFrames);
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(t);
  const [morph, setMorph] = useState<MathMorph | null>(null);
  latest.current = t;

  const key = dependencyKey(from, to, renderer, options);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    const handle = delayRender(`texmorph: preparing ${from.latex} → ${to.latex}`, { timeoutInMilliseconds: prepareTimeoutMs + 5_000 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('texmorph prepare timed out', 'TimeoutError')), prepareTimeoutMs);
    let live: MathMorph | null = null;
    let released = false;
    const release = (): void => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
    createMorphWith(renderer, el, from, to, { ...options, signal: controller.signal }).then(
      (m) => {
        clearTimeout(timer);
        if (controller.signal.aborted) {
          m.dispose();
          release();
          return;
        }
        live = m;
        m.render(latest.current);
        setMorph(m);
        onReady?.(m);
        release();
      },
      (error: unknown) => {
        clearTimeout(timer);
        if (controller.signal.aborted && !(error instanceof DOMException && error.name === 'TimeoutError')) {
          release();
          return;
        }
        cancelRender(error instanceof Error ? error : new Error(String(error)));
      },
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      live?.dispose();
      el.replaceChildren();
      setMorph(null);
      release();
    };
  }, [key, prepareTimeoutMs]);

  useLayoutEffect(() => {
    if (morph && morph.state !== 'disposed') morph.render(t);
  }, [morph, t]);

  return <div ref={host} className={className} style={{ position: 'relative', ...style }} />;
}
