import { readFileSync } from 'node:fs';
import { runTutorial } from '../.cache/headless/tutorial-headless.js';
await runTutorial(process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : undefined);
