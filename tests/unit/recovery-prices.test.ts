import { expect, it } from 'vitest';
import {
  quoteRepair,
  quoteRestore,
  quoteSale,
  quoteRearm,
  type BodyInvestment,
} from '../../src/economy/recovery';
const asset = (changes: Partial<BodyInvestment> = {}): BodyInvestment => ({
  body: 600 * 1024,
  maximum: 1200 * 1024,
  baseCost: 250,
  enhancementPaid: 0,
  promotionCoresPaid: 0,
  warden: false,
  core: false,
  refundLocked: false,
  emergencyCreated: false,
  ...changes,
});
it('prices fractional body repair exactly, caps requested healing and prices bulk per asset', () => {
  expect(quoteRepair(asset(), 600 * 1024)).toEqual({
    restored: 600 * 1024,
    body: 1200 * 1024,
    credits: 32,
  });
  expect(quoteRepair(asset(), 100 * 1024).credits).toBe(6);
  expect(quoteRepair(asset({ body: 1200 * 1024 - 1 }), 100 * 1024)).toEqual({
    restored: 1,
    body: 1200 * 1024,
    credits: 1,
  });
  expect(quoteRepair(asset({ body: 1200 * 1024 }), 1024).credits).toBe(0);
  expect(
    quoteRepair(asset({ core: true, body: 0, maximum: 10000 * 1024 }), 2500 * 1024).credits,
  ).toBe(250);
  expect(
    quoteRepair(
      asset({ warden: true, baseCost: 0, body: 1250 * 1024, maximum: 2500 * 1024 }),
      1250 * 1024,
    ).credits,
  ).toBe(63);
  expect(
    quoteRepair(asset({ baseCost: 60, body: 1, maximum: 1500 * 1024 }), 1500 * 1024).credits,
  ).toBe(15);
  expect(2 * quoteRepair(asset({ body: 1200 * 1024 - 1 }), 1).credits).toBe(2);
  expect(() => quoteRepair(asset({ body: 0 }), 1)).toThrow('Restore');
});
it('restores half body with paid-enhancement-only cost, retains promotion deposits and treats Warden base as 500', () => {
  expect(quoteRestore(asset({ body: 0, enhancementPaid: 2690, promotionCoresPaid: 82 }))).toEqual({
    body: 600 * 1024,
    credits: 235,
  });
  expect(quoteRestore(asset({ body: 0, enhancementPaid: 10000 })).credits).toBe(250);
  expect(quoteRestore(asset({ warden: true, body: 0, baseCost: 0 })).credits).toBe(200);
  expect(() => quoteRestore(asset())).toThrow('wreck');
  expect(() => quoteRestore(asset({ core: true, body: 0 }))).toThrow('non-Core');
});
it('wear-adjusts sale once and respects subsidy, zero-body, paid Cores and last-Warden ownership', () => {
  expect(quoteSale(asset({ enhancementPaid: 2690, promotionCoresPaid: 82 }))).toEqual({
    credits: 766,
    promotionCores: 82,
  });
  expect(quoteSale(asset({ body: 0, promotionCoresPaid: 82 }))).toEqual({
    credits: 0,
    promotionCores: 82,
  });
  expect(quoteSale(asset({ refundLocked: true, promotionCoresPaid: 82 }))).toEqual({
    credits: 0,
    promotionCores: 82,
  });
  expect(quoteSale(asset({ emergencyCreated: true, enhancementPaid: 100 })).credits).toBe(25);
  expect(() => quoteSale(asset({ warden: true }))).toThrow('last');
  expect(quoteSale(asset({ warden: true, body: 1200 * 1024 }), 2).credits).toBe(375);
  expect(() => quoteSale(asset({ core: true }))).toThrow('Core');
});
it('cannot profit from baseline repair/restore/rearm/sale loops and rejects unsafe domains', () => {
  for (const baseCost of [60, 75, 120, 250, 300, 350, 450, 500]) {
    for (let missing = 1; missing <= 10; missing++) {
      const a = asset({ baseCost, body: 1200 * 1024 - Math.floor((1200 * 1024 * missing) / 10) });
      const before = quoteSale(a).credits;
      const restoration = a.body === 0 ? quoteRestore(a) : quoteRepair(a, a.maximum - a.body);
      const after = quoteSale({ ...a, body: restoration.body }).credits;
      // Repair can recover legitimate invested value; buying this asset, then
      // repairing/selling it still cannot produce a net Credit gain.
      expect(after - restoration.credits - baseCost).toBeLessThanOrEqual(0);
      expect(before).toBeLessThanOrEqual(Math.floor(0.75 * baseCost));
    }
  }
  expect(quoteRearm(75, 1, 0, 1)).toEqual({ restored: 1, permanent: 1, credits: 19 });
  expect(quoteRearm(180, 8, 3, 8)).toEqual({ restored: 5, permanent: 8, credits: 29 });
  expect(quoteRearm(180, 8, 8, 1).credits).toBe(0);
  expect(() => quoteRearm(75, 1, 2, 1)).toThrow('stock');
  expect(() => quoteRepair(asset({ body: NaN }), 1)).toThrow();
});
