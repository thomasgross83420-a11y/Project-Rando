import { expect, it } from 'vitest';
import {
  EngineerRearm,
  endingPermanentStock,
  spendFiniteCharge,
  validateFiniteStock,
  type RearmConditions,
  type RearmObservation,
  type FiniteStock,
} from '../../src/sim/finite-stock';
const conditions: RearmConditions = {
  sourceAlive: true,
  trapAlive: true,
  inRange: true,
  lineOfSight: true,
  stationary: true,
  hostileWithinFourGU: false,
  underAttack: false,
  damagedThisTick: false,
  higherPriorityAction: false,
};
const observation = (change: Partial<RearmConditions> = {}): RearmObservation => ({
  conditions: { ...conditions, ...change },
  stock: { initial: 1, permanent: 0, temporary: 0 },
});
it('consumes temporary charges first and ends with only actual purchased stock without mutating inputs', () => {
  const start = { initial: 3, permanent: 1, temporary: 2 };
  const one = spendFiniteCharge(start)!;
  expect(one).toEqual({ initial: 3, permanent: 1, temporary: 1 });
  const two = spendFiniteCharge(one)!;
  expect(two).toEqual({ initial: 3, permanent: 1, temporary: 0 });
  const three = spendFiniteCharge(two)!;
  expect(three).toEqual({ initial: 3, permanent: 0, temporary: 0 });
  expect(spendFiniteCharge(three)).toBeNull();
  expect(endingPermanentStock(start)).toBe(1);
  expect(start).toEqual({ initial: 3, permanent: 1, temporary: 2 });
});
it('rejects invalid finite caps and cannot treat a rechargeable as finite stock', () => {
  for (const s of [
    { initial: 0, permanent: 0, temporary: 0 },
    { initial: 9, permanent: 0, temporary: 0 },
    { initial: 1, permanent: 1, temporary: 1 },
    { initial: 1, permanent: -1, temporary: 0 },
    { initial: 1, permanent: 0, temporary: NaN },
    { initial: 1.5, permanent: 0, temporary: 0 },
  ])
    expect(() => validateFiniteStock(s)).toThrow();
});
it('never creates purchased stock across every finite cap and initial permanent-stock count', () => {
  for (let initial = 1; initial <= 8; initial++)
    for (let permanent = 0; permanent <= initial; permanent++) {
      const r = new EngineerRearm();
      let stock: FiniteStock = { initial, permanent, temporary: 0 },
        tick = 0;
      for (let addition = 0; addition < 8; addition++) {
        if (stock.permanent + stock.temporary === initial) stock = spendFiniteCharge(stock)!;
        const original = structuredClone(stock),
          o = { conditions, stock };
        expect(r.begin(1, 10, o)).toBe(true);
        let result: ReturnType<EngineerRearm['advance']> = [];
        for (let i = 0; i < 360; i++) result = r.advance(++tick, () => o);
        stock = result[0]!.stock;
        expect(o.stock).toEqual(original);
        expect(stock.permanent).toBe(original.permanent);
        expect(endingPermanentStock(stock)).toBeLessThanOrEqual(permanent);
        expect(stock.permanent + stock.temporary).toBeLessThanOrEqual(initial);
      }
      expect(r.completed(1)).toBe(8);
    }
  expect(() => new EngineerRearm().begin(1, 1, observation())).toThrow('distinct');
});
it('completes once after six full seconds, creating only temporary stock and spending one addition', () => {
  const r = new EngineerRearm(),
    o = observation();
  expect(r.begin(1, 10, o)).toBe(true);
  for (let tick = 1; tick < 360; tick++) expect(r.advance(tick, () => o)).toEqual([]);
  expect(r.completed(1)).toBe(0);
  expect(r.advance(360, () => o)).toEqual([
    { source: 1, trap: 10, stock: { initial: 1, permanent: 0, temporary: 1 } },
  ]);
  expect(r.completed(1)).toBe(1);
  expect(r.advance(361, () => o)).toEqual([]);
  expect(r.completed(1)).toBe(1);
  expect(r.active).toEqual([]);
  expect(o.stock).toEqual({ initial: 1, permanent: 0, temporary: 0 });
});
it('reserves one channel per trap and one action per Engineer; cancellation releases without spending', () => {
  const r = new EngineerRearm(),
    o = observation();
  expect(r.begin(2, 10, o)).toBe(true);
  expect(r.begin(1, 10, o)).toBe(false);
  expect(r.begin(2, 11, o)).toBe(false);
  expect(r.begin(3, 11, o)).toBe(true);
  expect(r.active.map((c) => c.source)).toEqual([2, 3]);
  r.cancel(2);
  expect(r.completed(2)).toBe(0);
  expect(r.begin(1, 10, o)).toBe(true);
});
it('cancels every invalid/safety/preemption condition even on the completion tick; partial work cannot carry over', () => {
  const changes: Partial<RearmConditions>[] = [
    { sourceAlive: false },
    { trapAlive: false },
    { inRange: false },
    { lineOfSight: false },
    { stationary: false },
    { hostileWithinFourGU: true },
    { underAttack: true },
    { damagedThisTick: true },
    { higherPriorityAction: true },
  ];
  for (const change of changes) {
    const r = new EngineerRearm(),
      o = observation();
    expect(r.begin(1, 10, observation(change))).toBe(false);
    expect(r.begin(1, 10, o)).toBe(true);
    for (let tick = 1; tick < 360; tick++) r.advance(tick, () => o);
    expect(r.advance(360, () => observation(change))).toEqual([]);
    expect(r.completed(1)).toBe(0);
    expect(r.active).toEqual([]);
    expect(r.begin(1, 10, o)).toBe(true);
    for (let tick = 361; tick < 720; tick++) expect(r.advance(tick, () => o)).toEqual([]);
    expect(r.advance(720, () => o)).toHaveLength(1);
    expect(r.completed(1)).toBe(1);
  }
});
it('missing actors and externally filled traps release the channel; a full trap cannot be started', () => {
  for (const finish of [
    null,
    { ...observation(), stock: { initial: 1, permanent: 1, temporary: 0 } },
  ]) {
    const r = new EngineerRearm();
    r.begin(1, 10, observation());
    expect(r.advance(1, () => finish)).toEqual([]);
    expect(r.active).toEqual([]);
    expect(r.completed(1)).toBe(0);
  }
  expect(
    new EngineerRearm().begin(1, 10, {
      ...observation(),
      stock: { initial: 1, permanent: 0, temporary: 1 },
    }),
  ).toBe(false);
});
it('caps additions at eight per actor, not sixteen for the two visual engineers, and never banks free permanent stock', () => {
  const r = new EngineerRearm();
  let tick = 0;
  for (let addition = 0; addition < 8; addition++) {
    const o = observation();
    expect(r.begin(1, 10, o)).toBe(true);
    let result: ReturnType<EngineerRearm['advance']> = [];
    for (let i = 0; i < 360; i++) result = r.advance(++tick, () => o);
    expect(result).toHaveLength(1);
    expect(endingPermanentStock(result[0]!.stock)).toBe(0);
  }
  expect(r.completed(1)).toBe(8);
  expect(r.begin(1, 10, observation())).toBe(false);
  expect(r.begin(2, 10, observation())).toBe(true);
});
it('rejects skipped/repeated ticks and validates a whole completion batch before mutating any channel or count', () => {
  const r = new EngineerRearm();
  r.begin(1, 10, observation());
  r.begin(2, 11, observation());
  expect(() => r.advance(2, () => observation())).toThrow('consecutive');
  for (let tick = 1; tick < 360; tick++) r.advance(tick, () => observation());
  expect(() =>
    r.advance(360, (id) =>
      id === 1
        ? observation()
        : { ...observation(), stock: { initial: 2, permanent: 0, temporary: 0 } },
    ),
  ).toThrow('cap changed');
  expect(r.completed(1)).toBe(0);
  expect(r.active).toHaveLength(2);
  expect(r.advance(360, () => observation()).map((c) => c.source)).toEqual([1, 2]);
  expect(() => r.advance(360, () => observation())).toThrow('consecutive');
  expect(new EngineerRearm(Number.MAX_SAFE_INTEGER).active).toEqual([]);
  expect(() => new EngineerRearm(Number.MAX_SAFE_INTEGER).begin(1, 10, observation())).toThrow();
});
