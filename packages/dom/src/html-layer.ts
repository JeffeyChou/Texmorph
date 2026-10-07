import type { Box, GhostFrame, RGBA, Track } from '@texmorph/core';
import type { GhostLayer } from './types.ts';

function css(color: RGBA): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
}

const sized = new WeakMap<HTMLElement, string>();

// Below this size change (CSS px) a ghost is drawn unscaled, exactly like the real token.
const STILL = 0.05;

/**
 * Positions an absolutely positioned HTML ghost. Its native size and origin are written once; frames write
 * left/top, transform (scale only), opacity and color. Translating with left/top rather than a transform keeps
 * text on the same pixel grid as the real formula, so the switch between them at t = 0 and t = 1 is invisible.
 */
export function placeHtmlGhost(ghost: HTMLElement, frame: GhostFrame, track: Track): void {
  const native = frame.layer === 'source' ? track.from.box : track.to.box;
  const style = ghost.style;
  const key = `${native.width}x${native.height}:${track.origin}`;
  if (sized.get(ghost) !== key) {
    style.width = `${native.width}px`;
    style.height = `${native.height}px`;
    style.transformOrigin = track.origin === 'center' ? '50% 50%' : '0 0';
    sized.set(ghost, key);
  }
  style.left = `${frame.tx}px`;
  style.top = `${frame.ty}px`;
  const still = Math.abs(frame.sx - 1) * native.width < STILL && Math.abs(frame.sy - 1) * native.height < STILL;
  style.transform = still ? 'none' : `scale(${frame.sx}, ${frame.sy})`;
  style.opacity = String(frame.opacity);
  if (frame.color) style.color = css(frame.color);
}

export function createHtmlGhostLayer(stage: HTMLElement, _bounds: Box): GhostLayer {
  const root = document.createElement('div');
  root.className = 'texmorph-ghosts';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none';
  stage.append(root);
  return {
    root,
    add(ghost) {
      const el = ghost as HTMLElement;
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.margin = '0';
      root.append(el);
    },
    place(ghost, frame, track) {
      placeHtmlGhost(ghost as HTMLElement, frame, track);
    },
    dispose() {
      root.replaceChildren();
    },
  };
}
