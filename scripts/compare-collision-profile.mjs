import { build } from 'vite';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
await build({
  build: {
    ssr: 'scripts/profile-battle.ts',
    outDir: '.cache/profile-reference',
    emptyOutDir: true,
  },
  resolve: {
    alias: [
      {
        find: /\.\.\/sim\/collision$/,
        replacement: resolve('tests/fixtures/collision-reference.ts'),
      },
    ],
  },
});
await build({
  build: {
    ssr: 'scripts/profile-battle.ts',
    outDir: '.cache/profile-optimized',
    emptyOutDir: true,
  },
});
const reference = await (
  await import('../.cache/profile-reference/profile-battle.js')
).profileBattle();
const optimized = await (
  await import('../.cache/profile-optimized/profile-battle.js')
).profileBattle();
if (reference.fingerprint !== optimized.fingerprint)
  throw Error('Collision optimization changed the battle');
const result = {
  method:
    'Same seeded 24-Apex-Carrier battle and legal rank100 starter force, fixed owned IDs; original BigInt collision oracle versus optimized collision. Actual state fingerprints must match. Shared-container elapsed timing is diagnostic.',
  reference,
  optimized,
  speedup: reference.ms / optimized.ms,
};
await writeFile('docs/evidence/collision-performance.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
