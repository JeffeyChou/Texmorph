import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: { texmorph: 'src/browser.ts' },
    format: 'iife',
    globalName: 'Texmorph',
    platform: 'browser',
    target: 'es2022',
    noExternal: ['@texmorph/core', '@texmorph/dom'],
    outputOptions: { entryFileNames: '[name].iife.js' },
    minify: true,
    dts: false,
    sourcemap: true,
    clean: false,
  },
]);
