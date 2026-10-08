import { expect, it } from 'vitest';
import {
  quoteAffordableRepair,
  quoteRepair,
  type BodyInvestment,
} from '../../src/economy/recovery';
const investment = (change: Partial<BodyInvestment> = {}): BodyInvestment => ({
  body: 0,
  maximum: 10000 * 1024,
  baseCost: 0,
  enhancementPaid: 0,
  promotionCoresPaid: 0,
  warden: false,
  core: true,
  refundLocked: false,
  emergencyCreated: false,
  ...change,
});
it('finds the exact affordable boundary for Core, Warden, cheap barriers and traps without changing prices or investment', () => {
  const cases = [
    investment(),
    investment({
      core: false,
      warden: true,
      body: 1000 * 1024,
      maximum: 2500 * 1024,
      baseCost: 500,
    }),
    investment({ core: false, body: 1000 * 1024, maximum: 1500 * 1024, baseCost: 60 }),
    investment({ core: false, body: 1, maximum: 200 * 1024, baseCost: 75 }),
  ];
  for (const a of cases)
    for (const wallet of [0, 1, 2, 3, 19, 99, 1000, Number.MAX_SAFE_INTEGER]) {
      const before = structuredClone(a),
        q = quoteAffordableRepair(a, wallet);
      expect(q.credits).toBeLessThanOrEqual(wallet);
      expect(q.body).toBeLessThanOrEqual(a.maximum);
      expect(q).toEqual(quoteRepair(a, q.restored));
      if (q.restored < a.maximum - a.body)
        expect(quoteRepair(a, q.restored + 1).credits).toBeGreaterThan(wallet);
      expect(a).toEqual(before);
    }
  expect(quoteAffordableRepair(investment(), 1).restored).toBe(10 * 1024);
  expect(quoteAffordableRepair(cases[2] as BodyInvestment, 1).restored).toBe(100 * 1024);
});
it('retains a fractional fixed-point affordable edge instead of rounding it into an unaffordable displayed amount', () => {
  const a = investment({ core: false, body: 1000 * 1024, maximum: 1200 * 1024, baseCost: 250 });
  expect(quoteAffordableRepair(a, 3)).toEqual({ body: 1082982, restored: 58982, credits: 3 });
  expect(quoteRepair(a, 58983).credits).toBe(4);
  expect(quoteAffordableRepair(a, 0)).toEqual({ body: a.body, restored: 0, credits: 0 });
});
it('handles safe-integer extremes and rejects wreck-repair and invalid wallets before quoting', () => {
  const extreme = investment({ body: 1, maximum: Number.MAX_SAFE_INTEGER });
  expect(quoteAffordableRepair(extreme, Number.MAX_SAFE_INTEGER).body).toBe(
    Number.MAX_SAFE_INTEGER,
  );
  const poor = quoteAffordableRepair(extreme, 1);
  expect(poor.restored).toBe(10 * 1024);
  for (const wallet of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    expect(() => quoteAffordableRepair(extreme, wallet)).toThrow();
  expect(() =>
    quoteAffordableRepair(investment({ core: false, baseCost: 75, maximum: 200 * 1024 }), 100),
  ).toThrow('Restore');
});
