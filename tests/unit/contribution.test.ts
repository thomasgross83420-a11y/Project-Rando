import { expect, it } from 'vitest';
import {
  ContributionLedger,
  SCORE_PER_POINT,
  SCORE_PER_FIXED,
  type LedgerActor,
} from '../../src/progression/contribution';
import { Battle } from '../../src/sim/battle';
import { hash } from '../../src/sim/determinism';
import { bearing, delta } from '../../src/sim/fixed';
import { allocateAssetXP } from '../../src/progression/allocation';
import { tutorialArmy } from '../fixtures/tutorial';
const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Missing fixture');
  return value;
};
const actor = (id: number, changes: Partial<LedgerActor> = {}): LedgerActor => ({
  id,
  uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  type: 'test.actor',
  team: 'friendly',
  developing: true,
  rewardable: false,
  body: 100 * 1024,
  maximum: 100 * 1024,
  initialStock: 0,
  permanentStock: 0,
  ...changes,
});
const row = (l: ContributionLedger, id: number) =>
  required(l.snapshot().actors.find((a) => a.id === id));
it('credits actual hostile body and shield loss, including released damage after source death, excluding decoys/nondevelopers', () => {
  const l = new ContributionLedger(4);
  l.register(actor(1));
  l.register(actor(2, { uuid: null, team: 'hostile', developing: false, rewardable: true }));
  l.register(actor(3, { uuid: null, team: 'hostile', developing: false, rewardable: false }));
  l.register(actor(4, { developing: false }));
  l.beginTick(1);
  l.damage(2, 1, 100 * 1024, 0);
  l.damage(1, 2, 25 * 1024, 10 * 1024);
  l.damage(1, 3, 100 * 1024, 0);
  l.damage(4, 2, 10 * 1024, 0);
  expect(row(l, 1).scores.damage).toBe(String(35n * SCORE_PER_POINT));
  expect(row(l, 1).body).toBe(0);
  expect(row(l, 1).operationalBlocks).toEqual([1]);
  expect(row(l, 4).score).toBe('0');
  expect(() => l.damage(1, 2, 100 * 1024, 0)).toThrow('exceeds');
});
it('caps restoration per recipient across providers at initial injury plus actual hostile damage, ignoring environmental injury and overheal', () => {
  const l = new ContributionLedger(4);
  l.register(actor(1));
  l.register(actor(2, { body: 50 * 1024 }));
  l.register(actor(3));
  l.register(actor(4, { uuid: null, team: 'hostile', developing: false }));
  l.beginTick(1);
  expect(l.restore(1, 2, 30 * 1024)).toBe(30n * 1024n);
  expect(l.restore(3, 2, 20 * 1024)).toBe(20n * 1024n);
  l.structuralLoss(2, 50 * 1024);
  expect(l.restore(1, 2, 50 * 1024)).toBe(0n);
  l.damage(4, 2, 10 * 1024, 0);
  expect(l.restore(3, 2, 10 * 1024)).toBe(10n * 1024n);
  expect(row(l, 1).scores.restoration).toBe(String(30n * SCORE_PER_POINT));
  expect(row(l, 3).scores.restoration).toBe(String(30n * SCORE_PER_POINT));
  expect(row(l, 2).restorationUsed).toBe(String(60n * 1024n));
  expect(() => l.restore(1, 2, 1)).toThrow('mismatch');
  l.damage(4, 2, 100 * 1024, 0);
  expect(() => l.restore(1, 2, 1)).toThrow('mismatch');
});
it('enforces one real prevention budget per ordered hit and never credits armor or nondeveloping providers', () => {
  const l = new ContributionLedger(4);
  l.register(actor(1));
  l.register(actor(2));
  l.register(actor(3, { developing: false }));
  l.register(actor(4, { uuid: null, team: 'hostile', developing: false }));
  l.prevention(
    4,
    2,
    [
      { source: 1, bodyAverted: 25 * 1024 },
      { source: 3, bodyAverted: 5 * 1024 },
    ],
    30 * 1024,
  );
  expect(row(l, 1).scores.prevention).toBe(String(25n * SCORE_PER_POINT));
  expect(row(l, 3).score).toBe('0');
  expect(() =>
    l.prevention(
      4,
      2,
      [
        { source: 1, bodyAverted: 30 * 1024 },
        { source: 3, bodyAverted: 1 },
      ],
      30 * 1024,
    ),
  ).toThrow('Duplicate');
  l.damage(4, 2, 95 * 1024, 0);
  expect(() => l.prevention(4, 2, [{ source: 1, bodyAverted: 10 * 1024 }], 10 * 1024)).toThrow(
    'living',
  );
});
it('keeps fractional control exact, caps each enemy across providers and gives first hidden reveal only', () => {
  const l = new ContributionLedger(3);
  l.register(actor(1));
  l.register(actor(2));
  l.register(actor(3, { uuid: null, team: 'hostile', developing: false, rewardable: true }));
  for (let tick = 1; tick <= 1200; tick++) {
    l.beginTick(tick);
    l.control(tick % 2 ? 1 : 2, 3, 50, false, true);
  }
  expect(BigInt(row(l, 1).scores.control) + BigInt(row(l, 2).scores.control)).toBe(
    100n * SCORE_PER_POINT,
  );
  l.beginTick(1201);
  l.control(1, 3, 50, true, false);
  l.control(1, 3, 50, true, true);
  expect(() => l.control(2, 3, 50, true, true)).toThrow('Duplicate');
  l.reveal(1, 3, true, true);
  expect(row(l, 1).scores.detection).toBe('0');
  l.reveal(1, 3, true, false);
  l.reveal(2, 3, true, false);
  expect(row(l, 1).scores.detection).toBe(String(10n * SCORE_PER_POINT));
  expect(row(l, 2).scores.detection).toBe('0');
});
it('consumes temporary stock first and retains body independently of permanent depletion', () => {
  const l = new ContributionLedger(1);
  l.register(actor(1, { initialStock: 2, permanentStock: 1 }));
  l.grantTemporaryCharge(1);
  l.spendCharge(1);
  expect(row(l, 1).permanentStock).toBe(1);
  expect(row(l, 1).temporaryStock).toBe(0);
  l.spendCharge(1);
  expect(row(l, 1).permanentStock).toBe(0);
  expect(row(l, 1).body).toBe(100 * 1024);
  expect(() => l.spendCharge(1)).toThrow('depleted');
  expect(() => l.register(actor(2))).toThrow('budget');
});
it('captures real repairs and deployed support XP even without a damage event, while excluding fixed route/traps', async () => {
  const army = tutorialArmy();
  for (const a of army) if (a.type === 'friendly.sentry') a.hp -= 100 * 1024;
  const b = await Battle.createTracked(army);
  for (let tick = 0; tick < 180; tick++) b.step();
  const facts = b.contributionSnapshot,
    repair = required(facts.actors.find((a) => a.type === 'friendly.repair_node'));
  expect(BigInt(repair.scores.restoration)).toBeGreaterThan(0n);
  expect(repair.scores.damage).toBe('0');
  expect(facts.actors.find((a) => a.type === 'friendly.standard_barricade')?.score).toBe('0');
  const allocation = allocateAssetXP(
    200n,
    1,
    facts.actors
      .filter((a) => a.uuid)
      .map((a) => ({
        id: required(a.uuid ?? undefined),
        xp: 0,
        level: 1,
        developing: a.developing,
        blocks: a.operationalBlocks.length,
        contribution: BigInt(a.score),
      })),
  );
  expect(allocation.granted).toBe(200n);
  expect(allocation.unused).toBe(0n);
  expect(allocation.allocations.find((a) => a.id === repair.uuid)?.granted).toBeGreaterThan(28n);
  expect(allocation.allocations).toHaveLength(5);
}, 30000);
it('converts raw shield absorption into ordered armor-adjusted body prevention and attributes the remaining reduction once', async () => {
  const b = await Battle.createTracked(tutorialArmy());
  for (let i = 0; i < 614; i++) b.step();
  const w = required(b.entities.find((e) => e.type === 'warden.bulwark')),
    hostile = required(b.entities.find((e) => e.team === 'hostile' && e.hp > 0));
  w.x = b.core.x + 3 * 1024;
  w.y = b.core.y;
  w.anchor = { x: w.x, y: w.y };
  w.goal = null;
  w.fieldEnd = b.tick + 120;
  // The next tick is a normal 15-tick aura refresh, so the real field
  // resolver installs both its reduction and contribution owner.
  b.core.shield.push({
    pool: 60 * 1024,
    expires: b.tick + 60,
    heading: bearing(delta(b.core, hostile)),
    source: w.id,
  });
  Reflect.set(b, 'impacts', [
    {
      fraction: 0,
      source: hostile.id,
      sequence: 99999,
      target: 1,
      raw: 120 * 1024,
      origin: { x: hostile.x, y: hostile.y },
    },
  ]);
  b.step();
  const facts = b.contributionSnapshot,
    core = required(facts.actors.find((a) => a.id === 1)),
    ward = required(facts.actors.find((a) => a.id === w.id));
  expect(core.body).toBe(9960 * 1024);
  expect(core.hostileBodyReceived).toBe(String(40 * 1024));
  // Armor 20 converts 60 raw shield absorption to 50 body prevention;
  // Holdfast then prevents 10 more body points, rather than adding 20 raw.
  expect(ward.scores.prevention).toBe(String(60n * SCORE_PER_POINT));
});
it('preserves the untracked simulation exactly while ledger results stay deterministic across grouping and retained events', async () => {
  let expected = '';
  for (const batch of [1, 12]) {
    const b = await Battle.createTracked(tutorialArmy());
    while (b.state === 'Siege' || b.state === 'Cleanup') for (let i = 0; i < batch; i++) b.step();
    const { contributions, ...simulation } = b.snapshot() as Record<string, unknown>;
    expect(await hash(simulation)).toBe(
      '1fc32c1de93483123a91b0b018aa0f90a36e508c406acc27b14f2990016ba8b6',
    );
    const h = await hash(contributions);
    if (!expected) expected = h;
    expect(h).toBe(expected);
    const mine = required(
      b.contributionSnapshot.actors.find((a) => a.type === 'friendly.proximity_mine'),
    );
    expect(mine.permanentStock).toBe(0);
    expect(mine.body).toBe(200 * 1024);
    expect(mine.firstZero).toBe(false);
    expect(
      b.contributionSnapshot.actors
        .filter((a) => a.team === 'hostile')
        .reduce((v, a) => v + Number(a.body), 0),
    ).toBe(0);
    const damage = b.contributionSnapshot.actors.reduce((v, a) => v + BigInt(a.scores.damage), 0n);
    expect(damage).toBe(3200n * 1024n * SCORE_PER_FIXED);
  }
}, 120000);
