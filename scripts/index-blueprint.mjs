import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const path = 'docs/blueprint/Resonance_Bastion_Browser_Blueprint_Final.md';
const source = readFileSync(path, 'utf8');
const versions = JSON.parse(readFileSync('docs/versions.json', 'utf8'));
if (createHash('sha256').update(source).digest('hex') !== versions.blueprintSHA256)
  throw new Error('Authoritative blueprint changed');
const owners = {
  1: ['authority', 0, 'T01'],
  2: ['authority', 0, 'T01'],
  3: ['state', 2, 'T15'],
  4: ['platform', 0, 'T03/T19'],
  5: ['space', 1, 'T06'],
  6: ['simulation', 2, 'T02/T04/T05'],
  7: ['friendly-content', 5, 'T01/T09'],
  8: ['wardens', 4, 'T09'],
  9: ['progression', 3, 'T02/T12'],
  10: ['hostile-content', 5, 'T01/T09'],
  11: ['bosses', 6, 'T10'],
  12: ['encounters', 6, 'T11/T15'],
  13: ['progression', 3, 'T12'],
  14: ['ai', 4, 'T07'],
  15: ['ui', 7, 'T16'],
  16: ['raster-art', 7, 'T17'],
  17: ['audio', 7, 'T17'],
  18: ['accessibility', 7, 'T16'],
  19: ['persistence', 3, 'T14'],
  20: ['performance', 8, 'T18'],
  21: ['production', 0, 'T01–T20'],
  22: ['platform', 0, 'T19'],
  23: ['simulation', 2, 'T03'],
  24: ['simulation', 4, 'T02–T15'],
  25: ['economy', 3, 'T12/T13'],
  26: ['ui', 7, 'T16'],
  27: ['actions', 5, 'T09'],
  28: ['modes', 6, 'T20'],
  29: ['production', 0, 'T01–T20'],
  30: ['content-ids', 5, 'T01'],
  31: ['acceptance', 8, 'T01–T20'],
};
let section = 'meta',
  ordinal = 0;
const records = [];
for (const [index, line] of source.split('\n').entries()) {
  const heading = line.match(/^#{2,4} (\d+[A-Z]?(?:\.\d+)?)\./);
  if (heading) {
    section = heading[1];
    ordinal = 0;
  }
  if (!line.trim() || line.startsWith('#') || /^\|[\s|-]+\|$/.test(line)) continue;
  const main = section === 'meta' ? 1 : Number.parseInt(section, 10),
    owner = owners[main];
  if (!owner) throw new Error('Unmapped section');
  ordinal++;
  const content =
    line.match(/(?:friendly|warden|enemy|boss|effect|stage|art|audio)\.[a-z_]+/)?.[0] ?? '';
  records.push({
    id: `RB-${section}-${String(ordinal).padStart(3, '0')}`,
    section,
    line: index + 1,
    contentID: content,
    subsystem: owner[0],
    dependency: 'versions/schemas; see DEPENDENCIES.md',
    state: 'Designed',
    evidence: owner[2],
    gate: owner[1],
    code: '',
    test: '',
    saveImpact: [3, 9, 13, 19, 24, 25, 26, 28].includes(main)
      ? 'schema/content/policy version; atomic validation'
      : 'no direct durable mutation; retain content/build version',
    presentation: [7, 8, 10, 11, 15, 16, 17, 18, 26, 27, 30].includes(main)
      ? 'stable art/audio keys; semantic control; T16/T17'
      : 'diagnostics/read-only explanation where applicable',
  });
}
if (new Set(records.map((r) => r.id)).size !== records.length)
  throw new Error('Duplicate requirement identifier');
const map = JSON.parse(readFileSync('docs/IMPLEMENTATION_MAP.json', 'utf8'));
for (const record of records) {
  const evidence = map.find((m) => m.requirements.includes(record.id));
  if (evidence) {
    record.code = evidence.code.join('; ');
    record.test = evidence.tests.join('; ');
    record.dependency = evidence.dependencies.join('; ');
  }
}
const columns = Object.keys(records[0]);
const csv =
  [
    columns.join(','),
    ...records.map((r) => columns.map((c) => JSON.stringify(r[c])).join(',')),
  ].join('\n') + '\n';
writeFileSync('docs/TRACEABILITY.csv', csv);
const catalog = [];
for (const line of source.slice(source.indexOf('## 30.')).split('\n')) {
  const m = line.match(/^\| ((?:friendly|warden|enemy|boss)\.[a-z_]+) \|/);
  if (m) catalog.push({ id: m[1], source: '§30', state: 'Designed', runtimeImplemented: false });
}
writeFileSync('docs/CONTENT_COVERAGE.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `${records.length} source blocks indexed; ${catalog.length} base content IDs. Registry records are not runtime implementations.`,
);
