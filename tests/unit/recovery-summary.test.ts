import { expect, it } from 'vitest';
import { deployedCampaign } from '../fixtures/campaign';
import { fullRecoveryBudget } from '../../src/progression/recovery-summary';
import { previewProgression } from '../../src/progression/preparation';
it('budgets exact restore, subsequent full repair and stock independently without touching the wallet or stored assets', () => {
  const c = deployedCampaign(),
    mine = c.assets.find((a) => a.type === 'friendly.proximity_mine' && a.placement);
  if (!mine) throw new Error('Mine missing');
  mine.hp = 0;
  mine.permanentCharges = 0;
  c.coreHP = 10000 * 1024 - 1;
  const ids = c.assets.filter((a) => a.placement).map((a) => a.id),
    before = structuredClone(c);
  const q = fullRecoveryBudget(c, ids);
  expect(q.assets.find((a) => a.id === mine.id)).toEqual({
    id: mine.id,
    restoreCredits: 30,
    repairCredits: 10,
    rearmCredits: 19,
    credits: 59,
  });
  expect(q.coreCredits).toBe(1);
  expect(q.credits).toBe(60);
  expect(c).toEqual(before);
  let paid = previewProgression(c, { kind: 'restore', id: mine.id }).after;
  paid = previewProgression(paid, { kind: 'repair', id: mine.id, requested: 200 * 1024 }).after;
  paid = previewProgression(paid, { kind: 'rearm', id: mine.id, requested: 1 }).after;
  paid = previewProgression(paid, { kind: 'repair-core', requested: 10000 * 1024 }).after;
  expect(before.credits - paid.credits).toBe(q.credits);
  expect(fullRecoveryBudget(paid, ids).credits).toBe(0);
  const stored = c.assets.find((a) => !a.placement);
  if (!stored) throw new Error('Stored asset missing');
  stored.hp = 0;
  expect(fullRecoveryBudget(c, ids)).toEqual(q);
  expect(() => fullRecoveryBudget(c, [mine.id, mine.id])).toThrow('Duplicate');
  expect(() => fullRecoveryBudget(c, [crypto.randomUUID()])).toThrow('missing');
});
