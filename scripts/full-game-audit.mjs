import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { fullGameAudit } from '../.cache/full-game-audit/full-game-audit.js';
await mkdir('docs/evidence', { recursive: true });
await writeFile('/tmp/rb-full-game-progress.jsonl', '');
const report = await fullGameAudit(async (row) => {
  console.log(JSON.stringify(row));
  await appendFile('/tmp/rb-full-game-progress.jsonl', `${JSON.stringify(row)}\n`);
});
await writeFile('docs/evidence/full-game-audit.json', `${JSON.stringify(report, null, 2)}\n`);
