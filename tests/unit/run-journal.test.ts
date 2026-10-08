import { expect, it } from 'vitest';
import { createCampaign } from '../../src/persistence/campaign';
import { CampaignRepository } from '../../src/persistence/repository';
import { RunJournalStore } from '../../src/persistence/run-journal';
import { canonical, hash } from '../../src/sim/determinism';
import { fixtureRules, fixturePlan, fixtureFrozen, fixtureTerminal } from '../fixtures/run-rules';
async function setup() {
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  const c = createCampaign('Run contract fixture', 0, 'Bastion', 'warden.bulwark');
  await repo.commit(c, undefined);
  return { repo, c, store: new RunJournalStore(repo, fixtureRules) };
}
it('allocates monotonic runs, restarts the same attempt and skips abandoned attempts without paying', async () => {
  const { repo, c, store } = await setup();
  const cp = await store.start(c, fixturePlan, fixtureFrozen);
  expect(cp.runID.sequence).toBe('1');
  expect(await store.restart(c)).toEqual(cp);
  await expect(store.start(c, fixturePlan, fixtureFrozen)).rejects.toThrow('Resolve');
  await expect(repo.commit({ ...c, revision: 1 }, c)).rejects.toThrow('run/practice');
  await store.abandon(c);
  expect(repo.memory.get(0)).toEqual(c);
  expect(repo.memoryFences.get(c.lineage)).toMatchObject({ allocated: '1', finalized: '1' });
  const next = await store.start(c, fixturePlan, fixtureFrozen);
  expect(next.runID.sequence).toBe('2');
  expect(next.planHash).toBe(cp.planHash);
});
it('journals immutable terminal state then commits the synthetic wallet/claim/fence/receipt once and acknowledges separately', async () => {
  const { repo, c, store } = await setup(),
    cp = await store.start(c, fixturePlan, fixtureFrozen);
  const pending = await store.buildPending(cp, fixtureTerminal);
  await store.journal(cp, pending);
  expect(repo.memory.get(0)).toEqual(c);
  expect((await store.read(c))?.pending).toEqual(pending);
  await expect(store.abandon(c)).rejects.toThrow('pending');
  await expect(store.restart(c)).rejects.toThrow('pending');
  const first = await store.finalize(cp, pending);
  expect(first.status).toBe('committed');
  expect(repo.memory.get(0)?.credits).toBe(637);
  expect(repo.memoryPrevious.get(0)).toEqual(c);
  expect(repo.memoryFences.get(c.lineage)).toMatchObject({
    allocated: '1',
    finalized: '1',
    campaign: ['C01S01'],
  });
  expect(await store.finalize(cp, pending)).toEqual(first);
  expect(repo.memory.get(0)?.credits).toBe(637);
  expect((await store.unpresented(0))?.runID).toEqual(cp.runID);
  const next = repo.memory.get(0);
  if (!next) throw new Error('Missing campaign');
  await expect(store.start(next, fixturePlan, fixtureFrozen)).rejects.toThrow('Acknowledge');
  await store.acknowledge(0, cp.runID);
  expect(await store.unpresented(0)).toBeUndefined();
});
it('rejects derived-field tampering even after checksum replacement and never changes the first pending result', async () => {
  const { store, c } = await setup(),
    cp = await store.start(c, fixturePlan, fixtureFrozen);
  const pending = await store.buildPending(cp, fixtureTerminal);
  const modified = { ...pending, after: { ...pending.after, credits: 100000 } };
  const { checksum: _, ...payload } = modified;
  modified.checksum = await hash(payload);
  await expect(store.journal(cp, modified)).rejects.toThrow('derived');
  await store.journal(cp, pending);
  const alternate = await store.buildPending(cp, { ...fixtureTerminal, outcome: 'Defeat' });
  await expect(store.journal(cp, alternate)).rejects.toThrow('Immutable');
  const recovery = JSON.parse(await store.exportPending(cp, pending));
  expect(recovery.checkpoint).toEqual(cp);
  expect(recovery.pending).toEqual(pending);
});
it('rejects stale writes and keeps checksummed captured state isolated from callers', async () => {
  const { repo, c, store } = await setup();
  const plan = { ...fixturePlan };
  const cp = await store.start(c, plan, fixtureFrozen);
  plan.kind = 'mutated';
  expect((await store.restart(c)).plan).toEqual(fixturePlan);
  const pending = await store.buildPending(cp, fixtureTerminal);
  await store.journal(cp, pending);
  repo.memory.set(0, { ...c, revision: 1 });
  await expect(store.finalize(cp, pending)).rejects.toThrow('changed');
  expect(store.memory.get(0)?.pending).toEqual(pending);
  repo.memory.set(0, c);
  repo.writer = undefined;
  await expect(store.finalize(cp, pending)).rejects.toThrow('Read Only');
});
it('prunes only recent receipt details; older finalized sequences never pay after their receipt leaves the 16-entry cache', async () => {
  const { repo, store } = await setup();
  let oldest: Parameters<typeof store.finalize> | undefined;
  for (let i = 0; i < 20; i++) {
    const c = repo.memory.get(0);
    if (!c) throw new Error('Missing campaign');
    const cp = await store.start(c, fixturePlan, fixtureFrozen),
      pending = await store.buildPending(cp, fixtureTerminal);
    if (!oldest) oldest = [cp, pending];
    await store.journal(cp, pending);
    await store.finalize(cp, pending);
    await store.acknowledge(0, cp.runID);
  }
  expect(store.memoryReceipts.get(0)?.receipts).toHaveLength(16);
  if (!oldest) throw new Error('Missing oldest receipt');
  const before = canonical(repo.memory.get(0));
  expect(await store.finalize(...oldest)).toEqual({ status: 'already-finalized', receipt: null });
  expect(canonical(repo.memory.get(0))).toBe(before);
  // Twenty complete checksummed journal transactions can exceed the default
  // five seconds while other integration suites share a hosted runner.
}, 30000);
it('rejects sequence overflow and clears a retained stale attempt without applying its payable payload', async () => {
  const { repo, c, store } = await setup(),
    cp = await store.start(c, fixturePlan, fixtureFrozen),
    pending = await store.buildPending(cp, fixtureTerminal);
  await store.journal(cp, pending);
  repo.memoryFences.set(c.lineage, { ...cp.fence, finalized: '1' });
  expect(await store.finalize(cp, pending)).toEqual({ status: 'already-finalized', receipt: null });
  await store.discardStale(c);
  expect(store.memory.has(0)).toBe(false);
  expect(repo.memory.get(0)).toEqual(c);
  repo.memoryFences.set(c.lineage, {
    ...cp.fence,
    allocated: '18446744073709551615',
    finalized: '18446744073709551615',
  });
  await expect(store.start(c, fixturePlan, fixtureFrozen)).rejects.toThrow('overflow');
  expect(store.memory.has(0)).toBe(false);
});
it('temporary session instances share the same validated checkpoint and receipts', async () => {
  const { repo, c, store } = await setup();
  const cp = await store.start(c, fixturePlan, fixtureFrozen);
  const other = new RunJournalStore(repo, fixtureRules);
  expect(await other.restart(c)).toEqual(cp);
  const pending = await other.buildPending(cp, fixtureTerminal);
  await other.journal(cp, pending);
  await store.finalize(cp, pending);
  expect((await other.unpresented(0))?.runID).toEqual(cp.runID);
});
it('explicit orphan recovery skips the missing attempt without fabricating a terminal result or reward', async () => {
  const { repo, c, store } = await setup(),
    cp = await store.start(c, fixturePlan, fixtureFrozen);
  store.memory.delete(0);
  repo.activeRunSlots.delete(0);
  await expect(store.start(c, fixturePlan, fixtureFrozen)).rejects.toThrow('Unresolved');
  await store.abandonOrphan(c);
  expect(repo.memory.get(0)).toEqual(c);
  expect(repo.memoryFences.get(c.lineage)?.finalized).toBe(cp.runID.sequence);
  expect((await store.start(c, fixturePlan, fixtureFrozen)).runID.sequence).toBe('2');
});
