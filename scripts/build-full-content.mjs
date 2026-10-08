import { mkdir, writeFile } from 'node:fs/promises';
import { buildFullContent } from '../.cache/full-content/build-full-content.js';
const bundle = await buildFullContent(),
  root = new URL('../public/content/full/', import.meta.url);
await mkdir(root, { recursive: true });
const files = {};
for (const { file, plan } of bundle.plans) {
  await writeFile(new URL(file, root), JSON.stringify(plan));
  files[file] = plan.hash;
}
await writeFile(
  new URL('index.json', root),
  JSON.stringify({ version: bundle.version, files }, null, 2) + '\n',
);
console.log(`${bundle.plans.length} immutable campaign/mastery plans authored`);
