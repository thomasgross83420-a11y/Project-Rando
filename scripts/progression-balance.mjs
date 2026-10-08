import { writeFile } from 'node:fs/promises';
import { measureProgressionBalance } from '../.cache/progression-balance/progression-balance.js';
await writeFile(
  'docs/evidence/PROGRESSION_BALANCE.json',
  `${JSON.stringify(await measureProgressionBalance(), null, 2)}\n`,
);
