import { writeFile } from 'node:fs/promises';
import { measureTutorialBalance } from '../.cache/balance/tutorial-balance.js';

const report = await measureTutorialBalance();
await writeFile('docs/evidence/TUTORIAL_BALANCE.json', `${JSON.stringify(report, null, 2)}\n`);
