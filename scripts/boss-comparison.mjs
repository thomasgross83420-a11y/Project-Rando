import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
await build({
  build: { ssr: 'scripts/boss-comparison.ts', outDir: '.cache/boss-comparison', emptyOutDir: true },
});
const { bossComparison } = await import('../.cache/boss-comparison/boss-comparison.js');
// Synthetic audit checkpoint: earned funds and injuries after four victories.
// Only historical result/archive logs were omitted; no combat or wallet fields changed.
const { s, p } = JSON.parse(await readFile('tests/fixtures/mobile-boss-checkpoint.json', 'utf8'));
const report = await bossComparison(s, p);
await writeFile(
  'docs/evidence/experience-mobile-boss-comparison.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
