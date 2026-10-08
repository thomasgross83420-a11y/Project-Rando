import { writeFile } from 'node:fs/promises';
import { measureSupportChannels } from '../.cache/support-channels/support-channel-analysis.js';
await writeFile(
  'docs/evidence/SUPPORT_CHANNELS.json',
  `${JSON.stringify(await measureSupportChannels(), null, 2)}\n`,
);
