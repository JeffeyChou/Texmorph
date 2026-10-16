import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { ConfigurationHandler } from '@mathjax/src/js/input/tex/Configuration.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js';
import { annotate, tagTree, type MmlLike } from './annotate.ts';
import { dynamicPrefix, type MathJaxFont } from './font.ts';

export const MATHJAX_VERSION: string = mathjax.version;
export const DEFAULT_PACKAGES: readonly string[] = ['base', 'ams', 'newcommand', 'color', 'cancel', 'boldsymbol'];
/** html allows links, classes and inline styles; require and autoload need MathJax's component loader. */
const FORBIDDEN_PACKAGES = new Set(['html', 'require', 'autoload']);

export type FontLoader = (range: string) => Promise<unknown>;

interface RegisteredFont {
  font: MathJaxFont;
  loader: FontLoader | null;
}

/** Fonts by dynamic prefix. MathJax keeps each font's data in module state, so loaders are page-global per font. */
const fonts = new Map<string, RegisteredFont>();
let asyncLoadInstalled = false;
let handlerRegistered = false;

/** Loads one dynamic range of a font through its loader (default: a lazy chunk per range). */
export async function loadFontRange(font: MathJaxFont, range: string): Promise<unknown> {
  const loader = fonts.get(dynamicPrefix(font))?.loader;
  if (loader) return loader(range);
  const load = font.ranges[range];
  if (!load) throw new Error(`unknown MathJax ${font.name} font range "${range}"`);
  return load();
}

function installAsyncLoad(): void {
  if (asyncLoadInstalled) return;
  asyncLoadInstalled = true;
  const previous = mathjax.asyncLoad as ((file: string) => unknown) | null;
  mathjax.asyncLoad = (file: string) => {
    for (const [prefix, entry] of fonts) {
      if (file.startsWith(`${prefix}/`)) return loadFontRange(entry.font, file.slice(prefix.length + 1).replace(/\.js$/, ''));
    }
    if (previous) return previous(file);
    return Promise.reject(new Error(`MathJax requested "${file}", which @texmorph/mathjax cannot load`));
  };
}

/** Makes a font's dynamic ranges loadable; `loader` replaces the font's lazy imports (the most recent one wins). */
export function registerFont(font: MathJaxFont, loader: FontLoader | undefined): void {
  installAsyncLoad();
  const prefix = dynamicPrefix(font);
  const entry = fonts.get(prefix) ?? { font, loader: null };
  fonts.set(prefix, entry);
  if (loader) entry.loader = loader;
}

export interface EngineOptions {
  packages?: readonly string[] | undefined;
  macros?: Readonly<Record<string, string | [string, number]>> | undefined;
  font: MathJaxFont;
  /** Draw `\text{}` with the font family passed to `convert` instead of the math font. */
  inheritTextFont: boolean;
}

export interface ConvertOptions {
  display: boolean;
  em: number;
  ex: number;
  containerWidth: number;
  /** CSS font family for `\text{}` when the engine inherits the text font. */
  family?: string;
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
  registerFont(options.font, undefined);
  const svg = new SVG({
    fontData: options.font.data as never,
    fontCache: 'local',
    linebreaks: { inline: false },
    mtextInheritFont: options.inheritTextFont,
  });
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
    async convert(latex, { display, em, ex, containerWidth, family }) {
      return (await doc.convertPromise(latex, { display, em, ex, containerWidth, ...(family ? { family } : {}) })) as HTMLElement;
    },
    styleSheet() {
      return (svg.styleSheet(doc) as HTMLStyleElement).textContent ?? '';
    },
  };
}
