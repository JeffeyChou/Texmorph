import type { MathMorph } from '@texmorph/dom';
import { gsap } from 'gsap';

export type MorphTweenVars = Omit<gsap.TweenVars, 'ease'>;

/**
 * Tweens progress from 0 to 1 and renders the morph whenever GSAP writes it, including seeks that suppress callbacks.
 * The ease is always 'none'; easing lives in the plan.
 */
export function morphTween(morph: MathMorph, vars: MorphTweenVars = {}): gsap.core.Tween {
  if ('ease' in (vars as Record<string, unknown>)) throw new TypeError('morphTween ignores GSAP easing; set easing on the morph instead');
  let progress = 0;
  const proxy = {
    get t(): number {
      return progress;
    },
    set t(value: number) {
      progress = value;
      if (morph.state !== 'disposed') morph.render(value);
    },
  };
  return gsap.fromTo(proxy, { t: 0 }, { duration: morph.duration / 1000, ...vars, t: 1, ease: 'none', immediateRender: false });
}

export function addMorph(timeline: gsap.core.Timeline, morph: MathMorph, position?: gsap.Position): gsap.core.Timeline {
  return timeline.add(morphTween(morph), position);
}
