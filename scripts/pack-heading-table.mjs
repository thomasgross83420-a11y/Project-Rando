import { readFile, writeFile } from 'node:fs/promises';
const full = JSON.parse(
  await readFile(new URL('../src/data/heading.json', import.meta.url), 'utf8'),
);
const quarter = full.slice(0, 16385).map((v) => v[0]);
for (let h = 0; h < 65536; h++) {
  const i = h % 16384,
    a = quarter[i],
    b = quarter[16384 - i];
  const vector = [
    [a, -b],
    [b, a],
    [-a, b],
    [-b, -a],
  ][Math.floor(h / 16384)];
  if (vector.some((n, j) => n !== full[h][j])) throw Error('Pinned heading changed ' + h);
}
await writeFile(
  new URL('../src/data/heading-quarter.json', import.meta.url),
  JSON.stringify(quarter) + '\n',
);
console.log('All 65,536 original headings verified.');
