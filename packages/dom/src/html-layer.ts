import type { Box, GhostFrame, RGBA, Track } from '@texmorph/core';
import type { GhostLayer } from './types.ts';

function css(color: RGBA): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
}

const sized = new WeakMap<HTMLElement, string>();

/** Positions an absolutely positioned HTML ghost. Its native size and origin are written once; frames only write transform, opacity and color. */
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
  style.transform = `translate(${frame.tx}px, ${frame.ty}px) scale(${frame.sx}, ${frame.sy})`;
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
