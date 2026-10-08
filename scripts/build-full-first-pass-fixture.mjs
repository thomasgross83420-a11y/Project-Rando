import { build } from 'vite';
await build({
  configFile: false,
  build: {
    outDir: '.cache/full-browser',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: 'scripts/full-first-pass-fixture.ts',
      formats: ['iife'],
      name: 'RBFullFixture',
      fileName: () => 'fixture.js',
    },
  },
});
