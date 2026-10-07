import { writeFile } from 'node:fs/promises';
import { measureMovement } from '../.cache/movement/movement-audit.js';
const report = await measureMovement();
await writeFile('docs/evidence/MOVEMENT_360.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    headings: report.headingsChecked,
    worstHeadingError: report.worstHeadingError,
    assets: report.assets.length,
    anglesPerAsset: report.anglesPerAsset,
  }),
);
