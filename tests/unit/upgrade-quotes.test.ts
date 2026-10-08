import { expect, it } from 'vitest';
import { quoteEnhancement, quotePromotion } from '../../src/progression/purchases';
import { quoteRepair } from '../../src/economy/recovery';
it('requires earned enhancement levels, buys only the next tier and matches the full Sentry investment', () => {
  let total = 0;
  for (let k = 1; k <= 10; k++) total += quoteEnhancement(250, 10 * k, k - 1).credits;
  expect(total).toBe(2690);
  expect(quoteEnhancement(250, 10, 0)).toEqual({ enhancement: 1, credits: 100 });
  expect(quoteEnhancement(250, 100, 9)).toEqual({ enhancement: 10, credits: 438 });
  expect(quoteEnhancement(500, 10, 0).credits).toBe(200);
  // Binary floating evaluation yields ceil(55.00000000000001) = 56 here.
  expect(quoteEnhancement(100, 20, 1).credits).toBe(55);
  expect(() => quoteEnhancement(250, 9, 0)).toThrow('locked');
  expect(() => quoteEnhancement(250, 19, 1)).toThrow('locked');
  expect(() => quoteEnhancement(250, 9, 1)).toThrow('ceiling');
  expect(() => quoteEnhancement(250, 100, 10)).toThrow('locked');
  expect(() => quoteEnhancement(Number.MAX_SAFE_INTEGER, 100, 9)).toThrow('safe');
});
it('requires both promotion gates and prior tiers and prices the entire mastery path', () => {
  let credits = 0,
    cores = 0;
  for (let star = 1; star <= 5; star++) {
    const q = quotePromotion(100, 100, star);
    credits += q.credits;
    cores += q.cores;
  }
  expect(credits).toBe(82000);
  expect(cores).toBe(82);
  expect(quotePromotion(10, 10, 1)).toEqual({ stars: 2, credits: 1000, cores: 1 });
  expect(() => quotePromotion(9, 10, 1)).toThrow('both');
  expect(() => quotePromotion(10, 9, 1)).toThrow('both');
  expect(() => quotePromotion(24, 25, 2)).toThrow('both');
  expect(() => quotePromotion(1, 1, 2)).toThrow('Existing');
  expect(() => quotePromotion(100, 100, 6)).toThrow('maximum');
});
it('quotes zero missing-body repair as zero without turning it into a restoration command', () => {
  const a = {
    body: 1200 * 1024,
    maximum: 1200 * 1024,
    baseCost: 250,
    enhancementPaid: 0,
    promotionCoresPaid: 0,
    warden: false,
    core: false,
    refundLocked: false,
    emergencyCreated: false,
  };
  expect(quoteRepair(a, 0)).toEqual({ body: a.body, restored: 0, credits: 0 });
  expect(() => quoteRepair(a, -1)).toThrow();
  expect(() => quoteRepair({ ...a, body: 0 }, 0)).toThrow('Restore');
});
