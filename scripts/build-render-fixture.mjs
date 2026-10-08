import { build } from 'vite';
await build({
  configFile: false,
  base: '/Project-Rando/',
  build: {
    outDir: '.cache/render-reuse-browser',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: 'scripts/render-performance-fixture.ts',
      formats: ['iife'],
      name: 'RBRenderFixture',
      fileName: () => 'fixture.js',
    },
  },
});
