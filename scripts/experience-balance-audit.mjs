import { mkdir, writeFile } from 'node:fs/promises';
import { experienceBalanceAudit } from '../.cache/experience-audit/experience-balance-audit.js';
await mkdir('docs/evidence', { recursive: true });
for (const [policy, name] of [
  [['friendly.sentry', 'friendly.rifle_squad'], 'rifle'],
  [['friendly.sentry', 'friendly.sentry'], 'sentry'],
]) {
  const report = await experienceBalanceAudit(policy);
  await writeFile(
    `docs/evidence/experience-balance-${name}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
