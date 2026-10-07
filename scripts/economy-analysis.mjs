import { writeFile } from 'node:fs/promises';
import { analyzeEconomy } from '../.cache/economy/economy-analysis.js';
const report = await analyzeEconomy();
await writeFile(
  'docs/evidence/ECONOMY_ARITHMETIC.json',
  `${JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      cases: report.arithmeticCases,
      monotonicChecks: report.monotonicChecks,
      golden: report.golden,
      tutorial: {
        ticks: report.actualTutorial.ticks,
        hash: report.actualTutorial.hash,
        kills: report.actualTutorial.kills,
        paidPracticeReward: report.actualTutorial.paidPracticeReward,
      },
    },
    (_, v) => (typeof v === 'bigint' ? v.toString() : v),
  ),
);
