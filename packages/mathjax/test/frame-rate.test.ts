import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchFrameRate } from '../src/frame-rate.ts';

/** Drives requestAnimationFrame by hand at a fixed frame interval. Runs in Node and in the browser. */
function fakeFrames() {
  let now = 1000;
  let queue: FrameRequestCallback[] = [];
  let hidden = false;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  if (typeof document === 'undefined') vi.stubGlobal('document', { get hidden() { return hidden; } });
  else vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  return {
    hide: (value: boolean) => void (hidden = value),
    pending: () => queue.length,
    run(frames: number, interval: number, onFrame?: () => void) {
      for (let i = 0; i < frames; i++) {
        now += interval;
        onFrame?.();
        const due = queue;
        queue = [];
        for (const cb of due) cb(now);
      }
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('watchFrameRate', () => {
  it('stays quiet at 60 fps', () => {
    const frames = fakeFrames();
    const slow = vi.fn();
    const watch = watchFrameRate(50, slow);
    frames.run(60, 1000 / 60, () => watch.touch());
    expect(slow).not.toHaveBeenCalled();
  });

  it('reports a slow run once, with the measured rate', () => {
    const frames = fakeFrames();
    const slow = vi.fn();
    const watch = watchFrameRate(50, slow);
    frames.run(60, 30, () => watch.touch());
    expect(slow).toHaveBeenCalledTimes(1);
    expect(slow.mock.calls[0]?.[0]).toBeCloseTo(1000 / 30);
    expect(frames.pending()).toBe(0);
  });

  it('respects minFps', () => {
    const frames = fakeFrames();
    const slow = vi.fn();
    const watch = watchFrameRate(30, slow);
    frames.run(60, 30, () => watch.touch());
    expect(slow).not.toHaveBeenCalled();
  });

  it('ignores warm-up frames and pauses between renders', () => {
    const frames = fakeFrames();
    const slow = vi.fn();
    const watch = watchFrameRate(50, slow);
    watch.touch();
    frames.run(3, 100);
    for (let i = 0; i < 20; i++) {
      watch.touch();
      frames.run(2, 1000 / 60);
      frames.run(1, 400);
    }
    expect(slow).not.toHaveBeenCalled();
  });

  it('stops sampling when renders stop or the page is hidden', () => {
    const frames = fakeFrames();
    const slow = vi.fn();
    const watch = watchFrameRate(50, slow);
    watch.touch();
    frames.run(20, 30);
    expect(frames.pending()).toBe(0);
    frames.hide(true);
    frames.run(40, 30, () => watch.touch());
    expect(slow).not.toHaveBeenCalled();
  });

  it('does nothing after stop', () => {
    const frames = fakeFrames();
    const slow = vi.fn();
    const watch = watchFrameRate(50, slow);
    watch.touch();
    watch.stop();
    frames.run(60, 30, () => watch.touch());
    expect(slow).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(0);
  });
});
