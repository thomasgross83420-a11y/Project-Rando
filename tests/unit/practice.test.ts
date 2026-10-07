import { it, expect } from 'vitest';
import { CampaignRepository } from '../../src/persistence/repository';
import { createCampaign } from '../../src/persistence/campaign';
import { PracticeStore, practiceArmy } from '../../src/persistence/practice';
import { preferencesSchema } from '../../src/persistence/preferences';
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
