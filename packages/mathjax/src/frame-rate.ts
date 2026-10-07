import type { FrameRateWatch } from '@texmorph/dom';

/** Frame intervals averaged before deciding, after skipping the first few frames of each run. */
const SAMPLES = 12;
const WARMUP = 3;
/** A gap longer than this ends a run: playback paused, or the tab was hidden. */
const GAP = 250;

/** Samples display frames with requestAnimationFrame while `touch()` keeps being called. */
export function watchFrameRate(minFps: number, onSlow: (fps: number) => void): FrameRateWatch {
  let frame = 0;
  let touched = 0;
  let prev = 0;
  let skip = WARMUP;
  let stopped = false;
  const intervals: number[] = [];
  const reset = (): void => {
    intervals.length = 0;
    prev = 0;
    skip = WARMUP;
  };
  const tick = (now: number): void => {
    frame = 0;
    if (stopped) return;
    if (now - touched > GAP || document.hidden) return reset();
    if (prev && now - prev < GAP) {
      if (skip > 0) skip--;
      else {
        intervals.push(now - prev);
        if (intervals.length > SAMPLES) intervals.shift();
      }
    }
    prev = now;
    if (intervals.length === SAMPLES) {
      const mean = intervals.reduce((a, b) => a + b, 0) / SAMPLES;
      if (mean > 1000 / minFps) {
        stopped = true;
        return onSlow(1000 / mean);
      }
    }
    frame = requestAnimationFrame(tick);
  };
  return {
    touch() {
      if (stopped || typeof requestAnimationFrame !== 'function') return;
      touched = performance.now();
      if (!frame) frame = requestAnimationFrame(tick);
    },
    stop() {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
