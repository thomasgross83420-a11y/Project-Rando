import { build } from 'vite';
await build({
  configFile: false,
  build: {
    outDir: '.cache/run-journal-browser',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: 'scripts/run-journal-fixture.ts',
      formats: ['iife'],
      name: 'RBRunFixture',
      fileName: () => 'fixture.js',
    },
  },
});
