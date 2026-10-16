import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'fonts/newcm': 'src/fonts/newcm.ts',
    'fonts/stix2': 'src/fonts/stix2.ts',
    'fonts/termes': 'src/fonts/termes.ts',
    'fonts/pagella': 'src/fonts/pagella.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
});
