import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { ConfigurationHandler } from '@mathjax/src/js/input/tex/Configuration.js';
import { DefaultFont } from '@mathjax/src/js/output/svg/DefaultFont.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js';
import { annotate, tagTree, type MmlLike } from './annotate.ts';
import { NEWCM_DYNAMIC_PREFIX, newcmRanges } from './fonts.ts';

export const MATHJAX_VERSION: string = mathjax.version;
export const DEFAULT_PACKAGES: readonly string[] = ['base', 'ams', 'newcommand', 'color', 'cancel', 'boldsymbol'];
/** html allows links, classes and inline styles; require and autoload need MathJax's component loader. */
const FORBIDDEN_PACKAGES = new Set(['html', 'require', 'autoload']);

export type FontLoader = (range: string) => Promise<unknown>;

let fontLoader: FontLoader | null = null;
let asyncLoadInstalled = false;
let handlerRegistered = false;

async function defaultFontLoader(range: string): Promise<unknown> {
  const load = newcmRanges[range];
  if (!load) throw new Error(`unknown MathJax newcm font range "${range}"`);
  return load();
}

/** Loads one dynamic newcm range through the active loader (default: a lazy chunk per range). */
export function loadFontRange(range: string): Promise<unknown> {
  return (fontLoader ?? defaultFontLoader)(range);
}

function installAsyncLoad(): void {
  if (asyncLoadInstalled) return;
  asyncLoadInstalled = true;
  const previous = mathjax.asyncLoad as ((file: string) => unknown) | null;
  const prefix = `${NEWCM_DYNAMIC_PREFIX}/`;
  mathjax.asyncLoad = (file: string) => {
    if (file.startsWith(prefix)) return loadFontRange(file.slice(prefix.length).replace(/\.js$/, ''));
    if (previous) return previous(file);
    return Promise.reject(new Error(`MathJax requested "${file}", which @texmorph/mathjax cannot load`));
  };
}

export function setFontLoader(loader: FontLoader | undefined): void {
  installAsyncLoad();
  if (loader) fontLoader = loader;
}

export interface EngineOptions {
  packages?: readonly string[] | undefined;
  macros?: Readonly<Record<string, string | [string, number]>> | undefined;
}

export interface ConvertOptions {
  display: boolean;
  em: number;
  ex: number;
  containerWidth: number;
}

export interface Engine {
  convert(latex: string, options: ConvertOptions): Promise<HTMLElement>;
  styleSheet(): string;
}

interface MathItemLike {
  root: MmlLike;
  typesetRoot: HTMLElement | null;
}

export function createEngine(options: EngineOptions): Engine {
  const packages = [...(options.packages ?? DEFAULT_PACKAGES)];
  if (options.macros && !packages.includes('configmacros')) packages.push('configmacros');
  for (const name of packages) {
    if (FORBIDDEN_PACKAGES.has(name)) throw new TypeError(`TeX package "${name}" is not allowed`);
    if (!ConfigurationHandler.get(name)) {
      throw new TypeError(`TeX package "${name}" is not registered; import its configuration module from @mathjax/src first`);
    }
  }
  installAsyncLoad();
  if (!handlerRegistered) {
    RegisterHTMLHandler(browserAdaptor());
    handlerRegistered = true;
  }
  const tex = new TeX({
    packages,
    ...(options.macros ? { macros: { ...options.macros } } : {}),
    formatError: (_jax: unknown, err: Error) => {
      throw err;
    },
  });
  const svg = new SVG({ fontData: DefaultFont, fontCache: 'local', linebreaks: { inline: false } });
  const doc = mathjax.document(document, { InputJax: tex, OutputJax: svg });
  // Tag MathML nodes after compiling (the SVG output copies the attributes onto its <g> elements),
  // then copy final TeX classes and context onto the SVG once typesetting has set them.
  doc.addRenderAction('texmorph-tag', 120, () => {}, (math: MathItemLike) => tagTree(math.root), true);
  doc.addRenderAction(
    'texmorph-annotate',
    160,
    () => {},
    (math: MathItemLike) => {
      if (math.typesetRoot) annotate(math.typesetRoot, math.root);
    },
    true,
  );
  return {
    async convert(latex, { display, em, ex, containerWidth }) {
      return (await doc.convertPromise(latex, { display, em, ex, containerWidth })) as HTMLElement;
    },
    styleSheet() {
      return (svg.styleSheet(doc) as HTMLStyleElement).textContent ?? '';
    },
  };
}
