import { expect, it } from 'vitest';
import { grownAccuracy, accuracyPass, buffAccuracy } from '../../src/progression/accuracy';
import { rational } from '../../src/economy/policy';
import { combat } from '../../src/data/combat';
import { captureProfile, bandDefinition } from '../../src/progression/profile';
import { captureStudy, type StudyInput } from '../../src/sim/balance-study';
import { Battle } from '../../src/sim/battle';
import { hash } from '../../src/sim/determinism';
import { tutorialArmy } from '../fixtures/tutorial';

it('keeps role ordering, level-one baselines and exactly halves misses without premature caps', () => {
  for (let base = 0; base <= 100; base++) {
    expect(grownAccuracy(base, 1)).toEqual(rational(BigInt(base), 100n));
    expect(grownAccuracy(base, 100)).toEqual(rational(BigInt(100 + base), 200n));
    let previous = 0;
    for (let level = 1; level <= 100; level++) {
      const p = grownAccuracy(base, level),
        value = Number(p.n) / Number(p.d);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      if (base < 100) expect(value).toBeLessThan(1);
      if (base < 100) {
        const q = grownAccuracy(base + 1, level);
        expect(p.n * q.d).toBeLessThan(q.n * p.d);
      }
      previous = value;
    }
  }
  expect(grownAccuracy(90, 2)).toEqual(rational(1783n, 1980n));
  expect(grownAccuracy(85, 100)).toEqual(rational(37n, 40n));
  expect(buffAccuracy(grownAccuracy(95, 100), rational(1n, 20n))).toEqual(rational(1n));
});
it('compares exact uint32 boundary rolls and reproduces every integer-percent legacy threshold', () => {
  for (let percent = 0; percent <= 100; percent++) {
    const p = rational(BigInt(percent), 100n),
      firstMiss = (p.n * 4294967296n + p.d - 1n) / p.d;
    if (firstMiss > 0n) expect(accuracyPass(Number(firstMiss - 1n), p)).toBe(true);
    if (firstMiss <= 0xffffffffn) expect(accuracyPass(Number(firstMiss), p)).toBe(false);
    for (const roll of [0, 1, 123456789, 2147483648, 4294967295])
      expect(accuracyPass(roll, p)).toBe(BigInt(roll) * 100n < BigInt(percent) * 4294967296n);
  }
  expect(accuracyPass(0, rational(0n))).toBe(false);
  expect(accuracyPass(0xffffffff, rational(1n))).toBe(true);
  expect(() => accuracyPass(-1, rational(1n))).toThrow();
  expect(() => accuracyPass(4294967296, rational(1n))).toThrow();
  expect(() => accuracyPass(0, { n: 2n, d: 1n })).toThrow();
  expect(() => grownAccuracy(90, 0)).toThrow();
  expect(() => grownAccuracy(90.1, 1)).toThrow();
});
it('captures one immutable profile per asset while preserving role-specific cadence and nongrowing fields', () => {
  const base = JSON.stringify(combat),
    a = captureProfile('friendly.sentry', 100, 10),
    b = captureProfile('friendly.sentry', 1, 0),
    repair = captureProfile('friendly.repair_node', 100, 10);
  expect(a.definition.hp).toBe(2652 * 1024);
  expect(a.definition.weapon?.interval).toBe(38);
  expect(a.accuracy).toEqual({ numerator: 19, denominator: 20 });
  expect(b.definition.weapon).toEqual(combat['friendly.sentry'].weapon);
  expect(a.definition.armor).toBe(15);
  expect(a.definition.vision).toBe(8 * 1024);
  expect(repair.repair).toEqual({ perPulse: 13312, corePerPulse: 6656, range: 5888 });
  expect(repair.definition.weapon).toBeNull();
  expect(() => {
    a.definition.hp = 1;
  }).toThrow();
  expect(() => {
    if (a.definition.weapon) a.definition.weapon.damage = 1;
  }).toThrow();
  expect(JSON.stringify(combat)).toBe(base);
  expect(() => captureProfile('enemy.runner', 2, 0)).toThrow();
  expect(() => captureProfile('friendly.proximity_mine', 2, 0)).toThrow();
  expect(() => captureProfile('friendly.sentry', 9, 1)).toThrow();
  const hostile = bandDefinition('enemy.raider', 20);
  expect(hostile.hp).toBe(426240);
  expect(hostile.armor).toBe(25);
  expect(hostile.speed).toBe(combat['enemy.raider'].speed);
  expect(() => bandDefinition('enemy.runner', 21)).toThrow();
});
const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Missing test fixture');
  return value;
};
const input = (): StudyInput => ({
  schema: 1,
  seed: 'rb-tutorial-v1',
  band: 1,
  accuracyGrowth: true,
  assets: [{ uuid: required(tutorialArmy()[0]).uuid, level: 100, enhancement: 10 }],
});
it('normalizes, sorts and freezes study inputs, preserves old wounds and rejects identity/rule errors', () => {
  const army = tutorialArmy(),
    options = input();
  required(army[0]).hp -= 100 * 1024;
  const study = captureStudy([...army].reverse(), options);
  expect(required(study.army[0]).hp).toBe((2652 - 100) * 1024);
  required(options.assets[0]).level = 1;
  required(army[0]).hp = 1;
  expect(required(study.profiles[2]).level).toBe(100);
  expect(required(study.army[0]).hp).toBe((2652 - 100) * 1024);
  expect(() =>
    captureStudy(tutorialArmy(), {
      ...input(),
      assets: [required(input().assets[0]), required(input().assets[0])],
    }),
  ).toThrow();
  expect(() =>
    captureStudy(tutorialArmy(), {
      ...input(),
      assets: [{ ...required(input().assets[0]), uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }],
    }),
  ).toThrow();
  expect(() =>
    captureStudy(tutorialArmy(), {
      ...input(),
      assets: [{ ...required(input().assets[0]), level: 9, enhancement: 1 }],
    }),
  ).toThrow();
});
it('retains the exact v2 tutorial and makes level-one study instrumentation observational only', async () => {
  const b = await Battle.create(tutorialArmy()),
    s = await Battle.createStudy(tutorialArmy(), { ...input(), assets: [] });
  while (b.state === 'Siege' || b.state === 'Cleanup') {
    b.step();
    s.step();
  }
  expect(await hash(b.snapshot())).toBe(
    '1fc32c1de93483123a91b0b018aa0f90a36e508c406acc27b14f2990016ba8b6',
  );
  const { study: ignored, ...withoutStudy } = s.snapshot() as Record<string, unknown>;
  expect(ignored).toBeDefined();
  expect(await hash(withoutStudy)).toBe(await hash(b.snapshot()));
  expect(s.observedShots.length).toBeGreaterThan(0);
  expect(b.observedShots.length).toBe(0);
  expect(s.observedShots.filter((s) => s.resolution === 'in-flight')).toHaveLength(
    s.projectiles.length,
  );
}, 120000);
it('keeps captured growing stats deterministic across tick batches and distinct from baseline', async () => {
  let expected = '';
  for (const batch of [1, 12]) {
    const b = await Battle.createStudy(tutorialArmy(), input());
    while (b.state === 'Siege' || b.state === 'Cleanup') for (let i = 0; i < batch; i++) b.step();
    expect(b.get(2)?.maxHP).toBe(2652 * 1024);
    expect(b.get(3)?.maxHP).toBe(1200 * 1024);
    const value = await hash(b.snapshot());
    if (!expected) expected = value;
    expect(value).toBe(expected);
  }
}, 120000);
