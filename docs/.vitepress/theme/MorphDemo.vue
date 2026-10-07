<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { EasingSpec } from '@texmorph/core';
import type { FormulaRenderer, MathMorph } from '@texmorph/dom';

type RendererName = 'katex' | 'mathjax';

const props = withDefaults(
  defineProps<{
    /** Two or more formulas; each transition morphs one into the next. */
    steps: string[];
    displayMode?: boolean;
    /** Renderers offered by the toggle; the first is the default. */
    renderers?: RendererName[];
    /** Easings offered by a selector; omitted means the default easing. */
    easings?: string[];
    duration?: number;
  }>(),
  { displayMode: true, renderers: () => ['katex', 'mathjax'], duration: 900 },
);

const host = ref<HTMLElement>();
const renderer = ref<RendererName>(props.renderers[0] ?? 'katex');
const easing = ref<string>(props.easings?.[0] ?? '');
const index = ref(0);
const progress = ref(0);
const busy = ref(false);
const error = ref('');
const morph = shallowRef<MathMorph | null>(null);
const transitions = computed(() => props.steps.length - 1);

const loaded = new Map<RendererName, Promise<FormulaRenderer<unknown>>>();
function load(name: RendererName): Promise<FormulaRenderer<unknown>> {
  let r = loaded.get(name);
  if (!r) {
    r =
      name === 'katex'
        ? Promise.all([import('katex'), import('@texmorph/katex'), import('katex/dist/katex.min.css')]).then(([k, m]) => m.katexRenderer(k.default))
        : import('@texmorph/mathjax').then((m) => m.mathjaxRenderer());
    loaded.set(name, r);
  }
  return r;
}

let generation = 0;
let raf = 0;

/** Prepares the transition `steps[i] → steps[i + 1]` and shows it at `t`. */
async function prepare(i: number, t: number): Promise<void> {
  const mine = ++generation;
  cancelAnimationFrame(raf);
  busy.value = true;
  error.value = '';
  try {
    const [r, { createMorphWith }] = await Promise.all([load(renderer.value), import('@texmorph/dom')]);
    if (mine !== generation || !host.value) return;
    morph.value?.dispose();
    morph.value = null;
    host.value.replaceChildren();
    const state = (latex: string) => ({ latex, displayMode: props.displayMode });
    const next = await createMorphWith(r, host.value, state(props.steps[i] ?? ''), state(props.steps[i + 1] ?? ''), {
      duration: props.duration,
      ...(easing.value && { easing: easing.value as EasingSpec }),
    });
    if (mine !== generation) return next.dispose();
    morph.value = next;
    index.value = i;
    progress.value = t;
    next.render(t);
  } catch (e) {
    if (mine === generation) error.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (mine === generation) busy.value = false;
  }
}

function animate(to: 0 | 1): Promise<void> {
  cancelAnimationFrame(raf);
  const m = morph.value;
  if (!m) return Promise.resolve();
  const from = progress.value;
  const span = Math.abs(to - from) * m.duration;
  const start = performance.now();
  return new Promise((done) => {
    const tick = (now: number) => {
      const k = span ? Math.min(1, (now - start) / span) : 1;
      progress.value = from + (to - from) * k;
      m.render(progress.value);
      if (k < 1) raf = requestAnimationFrame(tick);
      else done();
    };
    raf = requestAnimationFrame(tick);
  });
}

async function play(): Promise<void> {
  if (progress.value >= 1) {
    if (index.value + 1 < transitions.value) await prepare(index.value + 1, 0);
    else await prepare(0, 0);
  }
  await animate(1);
}

async function back(): Promise<void> {
  if (progress.value <= 0 && index.value > 0) await prepare(index.value - 1, 1);
  await animate(0);
}

function scrub(event: Event): void {
  cancelAnimationFrame(raf);
  progress.value = Number((event.target as HTMLInputElement).value);
  morph.value?.render(progress.value);
}

const atStart = computed(() => index.value === 0 && progress.value <= 0);
const playLabel = computed(() => (progress.value >= 1 && index.value + 1 >= transitions.value ? 'Replay' : 'Play'));

watch([renderer, easing], () => void prepare(index.value, progress.value));
onMounted(() => void prepare(0, 0));
onBeforeUnmount(() => {
  generation++;
  cancelAnimationFrame(raf);
  morph.value?.dispose();
});
</script>

<template>
  <div class="morph-demo">
    <div ref="host" class="morph-demo-stage" />
    <p v-if="error" class="morph-demo-error">{{ error }}</p>
    <div class="morph-demo-controls">
      <button v-if="transitions > 1" :disabled="busy || atStart" @click="back">Back</button>
      <button :disabled="busy" @click="play">{{ playLabel }}</button>
      <input type="range" min="0" max="1" step="0.001" :value="progress" :disabled="busy" aria-label="Progress" @input="scrub" />
      <span class="morph-demo-t">t = {{ progress.toFixed(2) }}</span>
      <span v-if="transitions > 1" class="morph-demo-t">step {{ index + 1 }}/{{ transitions }}</span>
      <select v-if="easings" v-model="easing" aria-label="Easing">
        <option v-for="e in easings" :key="e" :value="e">{{ e }}</option>
      </select>
      <div v-if="renderers.length > 1" class="morph-demo-group" role="group" aria-label="Renderer">
        <button v-for="r in renderers" :key="r" :class="{ active: renderer === r }" @click="renderer = r">
          {{ r === 'katex' ? 'KaTeX' : 'MathJax' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.morph-demo { margin: 16px 0; padding: 16px 16px 12px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft); }
.morph-demo-stage { position: relative; min-height: 72px; font-size: 22px; color: var(--vp-c-text-1); overflow-x: auto; }
.morph-demo-error { color: var(--vp-c-danger-1); font-size: 13px; }
.morph-demo-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 8px; font-size: 13px; }
.morph-demo-controls button, .morph-demo-controls select { padding: 2px 10px; border: 1px solid var(--vp-c-divider); border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.morph-demo-controls button:disabled { opacity: 0.5; }
.morph-demo-controls input { flex: 1 1 120px; min-width: 100px; }
.morph-demo-t { font-family: var(--vp-font-family-mono); color: var(--vp-c-text-2); white-space: nowrap; }
.morph-demo-group { display: inline-flex; border: 1px solid var(--vp-c-divider); border-radius: 6px; overflow: hidden; }
.morph-demo-group button { border: 0; border-radius: 0; }
.morph-demo-group button.active { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
</style>
