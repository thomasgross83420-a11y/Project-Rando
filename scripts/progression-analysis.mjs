import { writeFile } from 'node:fs/promises';
import { progressionEvidence } from '../.cache/progression/progression-analysis.js';
const report = progressionEvidence();
await writeFile('docs/evidence/PROGRESSION_CONTRACTS.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    growthLevels: report.growth.length,
    conservedPermutationCases: report.conservedPermutationCases,
    accuracyGrowth: report.accuracyGrowth,
  }),
);
