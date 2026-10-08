import { expect, it } from 'vitest';
import { deployedCampaign } from '../fixtures/campaign';
import { CampaignRepository } from '../../src/persistence/repository';
import { PracticeStore } from '../../src/persistence/practice';
import { BackupStore, readBackup } from '../../src/persistence/backup';
import { RunJournalStore } from '../../src/persistence/run-journal';
import {
  campaignTutorialRules,
  captureCampaignTerminal,
} from '../../src/progression/campaign-result';
import { campaignTutorialPlan, freezeCampaign } from '../../src/sim/campaign-start';
import { Battle } from '../../src/sim/battle';
import { canonical } from '../../src/sim/determinism';
const required = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error('Missing fixture');
  return v;
};
async function destination() {
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  const journal = new RunJournalStore(repo, campaignTutorialRules),
    backup = new BackupStore(repo, new PracticeStore(repo));
  return { repo, journal, backup };
}
async function source() {
  const d = await destination(),
    c = deployedCampaign();
  await d.repo.commit(c, undefined);
  const cp = await d.journal.start(c, campaignTutorialPlan(), freezeCampaign(c));
  return { ...d, c, cp };
}
it('exports and imports a real pending defeat into another slot, re-deriving revisions without changing rewards or attempt identity', async () => {
  const s = await source(),
    b = await Battle.createCampaign(s.cp.plan, s.cp.frozen);
  for (let i = 0; i < 1800; i++) b.step();
  b.surrender();
  const pending = await s.journal.buildPending(s.cp, captureCampaignTerminal(b));
  await s.journal.journal(s.cp, pending);
  const backup = await s.backup.export([0], null);
  expect(backup.schema).toBe(2);
  expect((await readBackup(canonical(backup))).backup).toEqual(backup);
  const d = await destination();
  await d.backup.replace(backup, [{ source: 0, destination: 2 }], await d.backup.inspect());
  const c = required(d.repo.memory.get(2)),
    state = required(await d.journal.read(c)),
    p = required(state.pending ?? undefined);
  expect(state.checkpoint.runID).toEqual(s.cp.runID);
  expect(state.checkpoint.planHash).toBe(s.cp.planHash);
  expect(state.checkpoint.base.slot).toBe(2);
  expect(p.after.revision).toBe(c.revision + 1);
  expect(p.after.slot).toBe(2);
  expect(p.rewards).toEqual(pending.rewards);
  expect(p.checksum).not.toBe(pending.checksum);
  await d.journal.finalize(state.checkpoint, p);
  const after = required(d.repo.memory.get(2));
  expect(after.credits).toBe(pending.after.credits);
  expect(after.accountXP).toBe(pending.after.accountXP);
  expect(s.repo.memory.get(0)).toEqual(s.c);
  const finalized = await d.backup.export([2], null),
    again = await destination();
  await again.backup.replace(
    finalized,
    [{ source: 0, destination: 0 }],
    await again.backup.inspect(),
  );
  expect((await again.journal.unpresented(0))?.runID).toEqual(s.cp.runID);
  await expect(again.backup.restorePrevious(0, await again.backup.inspect())).rejects.toThrow(
    'Acknowledge',
  );
}, 30000);
it('preserves a restartable attempt and prohibits replacing, deleting or rolling it back until resolved', async () => {
  const s = await source(),
    backup = await s.backup.export([0], null),
    before = await s.backup.inspect();
  await expect(s.backup.replace(backup, [{ source: 0, destination: 0 }], before)).rejects.toThrow(
    'Resolve retained campaign run',
  );
  await expect(s.backup.deleteSlot(0, before)).rejects.toThrow('Resolve retained campaign run');
  const d = await destination();
  await d.backup.replace(backup, [{ source: 0, destination: 1 }], await d.backup.inspect());
  const c = required(d.repo.memory.get(1));
  expect((await d.journal.restart(c)).runID).toEqual(s.cp.runID);
  await d.journal.abandon(c);
  expect(d.repo.memory.get(1)?.credits).toBe(600);
});
it('retains newer local finalized fences when importing an older pending attempt and cannot pay it again', async () => {
  const s = await source(),
    b = await Battle.createCampaign(s.cp.plan, s.cp.frozen);
  for (let i = 0; i < 1800; i++) b.step();
  b.surrender();
  const p = await s.journal.buildPending(s.cp, captureCampaignTerminal(b));
  await s.journal.journal(s.cp, p);
  const old = await s.backup.export([0], null);
  await s.journal.finalize(s.cp, p);
  await s.journal.acknowledge(0, s.cp.runID);
  await s.backup.replace(old, [{ source: 0, destination: 0 }], await s.backup.inspect());
  const c = required(s.repo.memory.get(0));
  expect(c.credits).toBe(600);
  expect(s.repo.memoryFences.get(c.lineage)?.finalized).toBe('1');
  await expect(s.journal.read(c)).rejects.toThrow('Stale finalized');
  const retained = required(s.journal.memory.get(0));
  await expect(
    s.journal.finalize(retained.checkpoint, required(retained.pending ?? undefined)),
  ).rejects.toThrow('identity conflict');
  expect(s.repo.memory.get(0)).toEqual(c);
  await s.journal.discardStale(c);
  expect(s.journal.memory.get(0)).toBeUndefined();
});
it('rejects a backup with altered body/stock or a foreign receipt without dropping the original pending state', async () => {
  const s = await source(),
    backup = await s.backup.export([0], null),
    before = await s.backup.inspect();
  const changed = structuredClone(backup);
  const slot = required(changed.slots[0]);
  if (!('run' in slot) || !slot.run) throw new Error('Missing paid run');
  slot.campaign.credits++;
  await expect(s.backup.replace(changed, [{ source: 0, destination: 0 }], before)).rejects.toThrow(
    'checksum',
  );
  expect(await s.backup.inspect()).toEqual(before);
});
