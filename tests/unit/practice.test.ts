import { expect, it } from 'vitest';
import { createCampaign } from '../../src/persistence/campaign';
import { PracticeStore, practiceArmy } from '../../src/persistence/practice';
import { preferencesSchema } from '../../src/persistence/preferences';
import { CampaignRepository } from '../../src/persistence/repository';
import { planIdentity } from '../../src/sim/tutorial';

it('three temporary practice slots retain separate bounded identities and block campaign edits', async () => {
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  const store = new PracticeStore(repo);
  for (const slot of [0, 1, 2]) {
    const c = createCampaign('Test', slot, 'Bastion', 'warden.bulwark');
    await repo.commit(c, undefined);
    const cp = await store.start(c, practiceArmy(c));
    expect(cp.sequence).toBe('1');
    expect((await store.read(c))?.identity).toBe(cp.identity);
    await expect(repo.commit({ ...c, revision: c.revision + 1 }, c)).rejects.toThrow(
      'Resolve retained',
    );
    const r = {
      state: 'Victory' as const,
      tick: 6000,
      reason: 'Fixture terminal',
      hash: 'a'.repeat(64),
      kills: 24,
      tp: 30,
      coreHP: 10000 * 1024,
    };
    expect((await store.terminal(c, cp, r)).terminal).toEqual(r);
    expect((await store.terminal(c, cp, r)).terminal).toEqual(r);
    await expect(store.terminal(c, cp, { ...r, hash: 'b'.repeat(64) })).rejects.toThrow('mismatch');
  }
  expect(store.memory.size).toBe(3);
  const c = repo.memory.get(1);
  if (!c) throw new Error('Slot fixture');
  const cp = await store.read(c);
  if (!cp) throw new Error('Checkpoint fixture');
  await store.discard(c, cp);
  expect(store.memory.size).toBe(2);
  const next = await store.start(c, practiceArmy(c));
  expect(next.sequence).toBe('2');
  expect(next.identity).toBe(cp.identity);
});
it('legacy preferences gain documented audio defaults without changing presentation', () => {
  const p = preferencesSchema.parse({
    schema: 1,
    uiScale: 36,
    reducedEffects: true,
    highContrast: true,
  });
  expect(p.uiScale).toBe(36);
  expect(p.audio).toEqual({ master: 70, music: 35, sfx: 65, ui: 50, alerts: 75, muted: false });
});
it('retained v1 campaign/practice identities survive the v2 update; only a new practice uses v2', async () => {
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  const c = createCampaign('Legacy', 0, 'Bastion', 'warden.bulwark');
  c.simulationVersion = 'rb-sim-v1';
  await repo.commit(c, undefined);
  const store = new PracticeStore(repo),
    cp = await store.start(c, practiceArmy(c));
  if (cp.schema !== 1) throw new Error('Expected legacy checkpoint');
  cp.plan.simulation = 'rb-sim-v1';
  cp.identity = await planIdentity(cp.plan, cp.army);
  store.memory.set(c.slot, structuredClone(cp));
  const identity = cp.identity;
  const saved = await store.read(c);
  expect(saved?.plan.simulation).toBe('rb-sim-v1');
  expect(saved?.identity).toBe(identity);
  await store.discard(c, cp);
  const next = await store.start(c, practiceArmy(c));
  expect(next.plan.simulation).toBe('rb-sim-v2');
  expect(next.identity).not.toBe(identity);
  expect(repo.memory.get(0)?.simulationVersion).toBe('rb-sim-v1');
});
