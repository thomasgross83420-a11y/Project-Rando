import { writeFile } from 'node:fs/promises';
import { measureCombatProgression } from '../.cache/combat-progression/combat-progression-analysis.js';
await writeFile(
  'docs/evidence/COMBAT_PROGRESSION.json',
  `${JSON.stringify(await measureCombatProgression(), null, 2)}\n`,
);
