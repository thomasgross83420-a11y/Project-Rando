import { expect, it } from 'vitest';
import { deployedCampaign } from '../fixtures/campaign';
import { previewEmergency, recoveryViable } from '../../src/progression/emergency';
import { maximumBody } from '../../src/persistence/campaign';
import { bodyInvestment, previewProgression } from '../../src/progression/preparation';
import { quoteSale } from '../../src/economy/recovery';
import { campaignTutorialPlan, freezeCampaign } from '../../src/sim/campaign-start';
import {
  campaignTutorialRules,
  captureCampaignTerminal,
} from '../../src/progression/campaign-result';
import { Battle } from '../../src/sim/battle';
import { CampaignRepository } from '../../src/persistence/repository';
import { RunJournalStore } from '../../src/persistence/run-journal';
const required = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error('Missing fixture');
  return v;
};
function catastrophic() {
  const c = deployedCampaign();
  c.credits = 0;
  c.coreHP = 0;
  for (const a of c.assets) a.hp = 0;
  return c;
}
it('offers the exact affordable minimum instead of granting a subsidy, and preserves owned identities and upgrades', () => {
  const c = catastrophic();
  c.credits = 301;
  const q = previewEmergency(c);
  expect(q.kind).toBe('priced');
  expect(q.credits).toBe(301);
  expect(q.after.credits).toBe(0);
  expect(q.after.coreHP).toBe(1024);
  expect(q.subsidized).toEqual([]);
  expect(q.after.assets.map((a) => a.id)).toEqual(c.assets.map((a) => a.id));
  expect(recoveryViable(q.after)).toBe(true);
});
it('subsidizes the most invested owned Sentry/Rifle and Warden without duplicates, lowering healthy bodies or unlocking refunds', () => {
  const c = catastrophic(),
    sentry = required(c.assets.filter((a) => a.type === 'friendly.sentry')[1]);
  sentry.xp = 1502;
  sentry.level = 10;
  sentry.enhancement = 1;
  sentry.enhancementPaid = 100;
  const q = previewEmergency(c);
  expect(q.kind).toBe('subsidy');
  expect(q.credits).toBe(0);
  expect(q.after.coreHP).toBe(2500 * 1024);
  expect(q.after.assets).toHaveLength(c.assets.length);
  expect(q.subsidized).toContain(sentry.id);
  const a = required(q.after.assets.find((a) => a.id === sentry.id));
  expect(a.hp).toBe(Math.ceil(maximumBody(a) / 2));
  expect(a.xp).toBe(1502);
  expect(quoteSale(bodyInvestment(a)).credits).toBe(0);
  expect(() => previewEmergency(q.after)).toThrow('viable');
  expect(c.coreHP).toBe(0);
  const healthy = catastrophic();
  required(healthy.assets.find((a) => a.type === 'warden.bulwark')).hp = 2500 * 1024;
  const h = previewEmergency(healthy);
  expect(h.after.assets.find((a) => a.type === 'warden.bulwark')?.hp).toBe(2500 * 1024);
});
it('creates only missing basics with a permanently zero base refund and requires explicit conversion at the ownership cap', () => {
  const c = catastrophic();
  c.assets = c.assets.filter((a) => a.type === 'warden.bulwark');
  const q = previewEmergency(c);
  expect(q.after.assets).toHaveLength(3);
  expect(q.after.assets.filter((a) => a.emergencyCreated)).toHaveLength(2);
  const created = required(q.after.assets.find((a) => a.type === 'friendly.sentry'));
  created.refundLocked = false;
  created.hp = maximumBody(created);
  expect(quoteSale(bodyInvestment(created)).credits).toBe(0);
  const full = catastrophic();
  const basic = required(full.assets.find((a) => a.type === 'friendly.standard_barricade'));
  full.assets = full.assets.filter((a) => a.type === 'warden.bulwark');
  for (let i = 0; i < 1023; i++)
    full.assets.push({
      ...basic,
      id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      placement: null,
    });
  expect(() => previewEmergency(full)).toThrow('choose a non-Warden identity');
  const converted = previewEmergency(full, required(full.assets[1]).id);
  expect(converted.after.assets).toHaveLength(1024);
  expect(recoveryViable(converted.after)).toBe(true);
  expect(converted.after.credits).toBe(0);
});
it('wins the authored Cadet tutorial from a catastrophic zero-cash recovery without paid repairs, then releases only deployed refund locks', async () => {
  const q = previewEmergency(catastrophic()),
    c = q.after,
    repo = new CampaignRepository(undefined);
  await repo.acquire();
  await repo.commit(c, undefined);
  const store = new RunJournalStore(repo, campaignTutorialRules),
    cp = await store.start(c, campaignTutorialPlan('Cadet'), freezeCampaign(c)),
    b = await Battle.createCampaign(cp.plan, cp.frozen);
  while (b.state === 'Siege' || b.state === 'Cleanup') b.step();
  expect(b.state).toBe('Victory');
  const p = await store.buildPending(cp, captureCampaignTerminal(b));
  if (p.after.schema !== 2) throw new Error('Schema');
  expect(p.after.emergencyActive).toBe(false);
  expect(
    p.after.assets.filter((a) => q.subsidized.includes(a.id)).every((a) => !a.refundLocked),
  ).toBe(true);
  expect(p.rewards).toMatchObject({ promotionCores: '1', assetXPPool: '160' });
  const w = required(p.after.assets.find((a) => a.type === 'warden.bulwark'));
  expect(w.hp).toBeGreaterThan(0);
  expect(previewProgression(p.after, { kind: 'repair-core', requested: 0 }).creditsSpent).toBe(0);
}, 120000);
