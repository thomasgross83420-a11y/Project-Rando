import { HeadlessFixture, RandomStream, hash } from '../src/sim/determinism.ts';
const outcomes = [];
for (const chunks of [1, 2, 4, 8, 12]) {
  const world = new HeadlessFixture(await RandomStream.seeded('gate0', 'accuracy', 'rb-sim-v1'));
  for (let total = 0; total < 3600; ) {
    for (let i = 0; i < chunks && total < 3600; i++, total++) world.step();
  }
  outcomes.push(await hash(world.snapshot()));
}
if (new Set(outcomes).size !== 1)
  throw new Error('Headless tick grouping changed authoritative state');
console.log(
  JSON.stringify({
    fixture: 'Gate0 mechanism, not gameplay',
    ticks: 3600,
    groupings: [1, 2, 4, 8, 12],
    hash: outcomes[0],
  }),
);
