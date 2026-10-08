import { describe, expect, it } from 'vitest';
import { BackupStore, createBackup, readBackup } from '../../src/persistence/backup';
import { createCampaign, applyCommand, newAsset } from '../../src/persistence/campaign';
import { emptyFence, mergeFences } from '../../src/persistence/fence';
import { parseBackupJSON, BACKUP_BYTES } from '../../src/persistence/json';
import { PracticeStore, practiceArmy } from '../../src/persistence/practice';
import { CampaignRepository } from '../../src/persistence/repository';
import { canonical, hash } from '../../src/sim/determinism';

async function setup() {
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  const c = createCampaign('Recovery', 0, 'Bastion', 'warden.bulwark');
  await repo.commit(c, undefined);
  const practice = new PracticeStore(repo),
    store = new BackupStore(repo, practice);
  return { repo, c, practice, store };
}
describe('complete bounded backup and atomic replacement', () => {
  it('roundtrips the actual retained practice, plan identity and original versions', async () => {
    const { store, c, practice } = await setup();
    const cp = await practice.start(c, practiceArmy(c));
    const backup = await store.export([0], null),
      parsed = await readBackup(canonical(backup));
    expect(parsed.backup.slots[0]?.practice).toEqual(cp);
    expect(parsed.legacy).toBe(false);
    const other = await setup();
    const view = await other.store.inspect();
    await other.store.replace(parsed.backup, [{ source: 0, destination: 0 }], view);
    const restored = other.repo.memory.get(0);
    if (!restored) throw new Error('Import missing');
    expect(restored.lineage).toBe(c.lineage);
    expect(restored.credits).toBe(600);
    expect((await other.practice.read(restored))?.identity).toBe(cp.identity);
  });
  it('an empty destination retains the imported previous snapshot and monotonic practice sequence', async () => {
    const source = await setup();
    const after = applyCommand(source.c, {
      kind: 'buy-place',
      type: 'friendly.standard_barricade',
      x: 18,
      y: 18,
      rotation: 0,
    });
    await source.repo.commit(after, source.c);
    source.practice.memorySequence.set(0, '7');
    const backup = await source.store.export([0], null);
    const repo = new CampaignRepository(undefined);
    await repo.acquire();
    const practice = new PracticeStore(repo),
      store = new BackupStore(repo, practice);
    await store.replace(backup, [{ source: 0, destination: 2 }], await store.inspect());
    expect(repo.memory.get(2)?.credits).toBe(540);
    expect(repo.memoryPrevious.get(2)?.credits).toBe(600);
    expect(repo.memoryPrevious.get(2)?.slot).toBe(2);
    expect(practice.memorySequence.get(2)).toBe('7');
    await store.restorePrevious(2, await store.inspect());
    expect(repo.memory.get(2)?.credits).toBe(600);
    expect(practice.memorySequence.get(2)).toBe('7');
  });
  it('rejects changed bytes, impossible investment and duplicate campaign copies', async () => {
    const { store } = await setup();
    const backup = await store.export([0], null);
    await expect(
      readBackup(canonical(backup).replace('"credits":600', '"credits":601')),
    ).rejects.toThrow('checksum');
    const s = structuredClone(backup.slots[0]);
    if (!s) throw new Error('Missing slot');
    const a = s.campaign.assets[0];
    if (!a) throw new Error('Missing asset');
    a.paidCredits = 9;
    await expect(createBackup([s], null)).rejects.toThrow('investment');
    const t = await setup();
    await expect(
      t.store.replace(
        await t.store.export([0], null),
        [{ source: 0, destination: 1 }],
        await t.store.inspect(),
      ),
    ).rejects.toThrow('multiple slots');
  });
  it('keeps local monotonic watermarks and unions claims while rolling back the wallet exactly', async () => {
    const { repo, c, store } = await setup();
    const f = emptyFence(c.lineage);
    f.allocated = '10';
    f.finalized = '9';
    f.campaign = ['C01S01'];
    repo.memoryFences.set(c.lineage, f);
    const after = applyCommand(c, {
      kind: 'buy-place',
      type: 'friendly.standard_barricade',
      x: 18,
      y: 18,
      rotation: 0,
    });
    await repo.commit(after, c);
    await store.restorePrevious(0, await store.inspect());
    expect(repo.memory.get(0)?.credits).toBe(600);
    expect(repo.memory.get(0)?.revision).toBe(after.revision + 1);
    expect(repo.memoryFences.get(c.lineage)).toEqual(f);
    const older = emptyFence(c.lineage);
    older.campaign = ['C01S02'];
    expect(mergeFences(f, older).campaign).toEqual(['C01S01', 'C01S02']);
    expect(mergeFences(f, older).finalized).toBe('9');
  });
  it('unions imported current and previous fences of the same lineage without overwriting either', async () => {
    const { repo, c, store } = await setup();
    const backup = await store.export([0], null),
      s = backup.slots[0];
    if (!s) throw new Error('Missing slot');
    s.fence.campaign = ['C01S02'];
    s.previous = { campaign: c, fence: { ...emptyFence(c.lineage), campaign: ['C01S01'] } };
    const valid = await createBackup(backup.slots, null);
    await store.replace(valid, [{ source: 0, destination: 0 }], await store.inspect());
    expect(repo.memoryFences.get(c.lineage)?.campaign).toEqual(['C01S01', 'C01S02']);
  });
  it('rejects stale previews, read-only edits and conflicting practice before any writes', async () => {
    const { repo, c, store, practice } = await setup();
    const backup = await store.export([0], null),
      view = await store.inspect();
    await repo.commit({ ...c, name: 'Changed', revision: 1 }, c);
    await expect(store.replace(backup, [{ source: 0, destination: 0 }], view)).rejects.toThrow(
      'changed',
    );
    const current = repo.memory.get(0);
    if (!current) throw new Error('Missing');
    await practice.start(current, practiceArmy(current));
    await expect(
      store.replace(backup, [{ source: 0, destination: 0 }], await store.inspect()),
    ).rejects.toThrow('Resolve');
    expect(repo.memory.get(0)?.name).toBe('Changed');
    repo.writer = undefined;
    await expect(store.deleteSlot(0, await store.inspect())).rejects.toThrow();
  });
  it('validates every slot before changing any destination and never merges wallets', async () => {
    const { repo, store } = await setup();
    const c2 = createCampaign('Second', 1, 'Mobile', 'warden.ranger');
    await repo.commit(c2, undefined);
    const backup = await store.export([0, 1], null),
      bad = structuredClone(backup);
    const s = bad.slots[1];
    if (!s) throw new Error('Missing');
    s.campaign.credits = -1;
    const before = await store.inspect();
    await expect(
      store.replace(
        bad,
        [
          { source: 0, destination: 0 },
          { source: 1, destination: 1 },
        ],
        before,
      ),
    ).rejects.toThrow();
    expect(await store.inspect()).toEqual(before);
    await store.replace(
      backup,
      [
        { source: 0, destination: 0 },
        { source: 1, destination: 1 },
      ],
      before,
    );
    expect(repo.memory.get(0)?.credits).toBe(600);
    expect(repo.memory.get(1)?.credits).toBe(600);
  });
  it('maximum-shaped three-slot current/previous/fence bundles remain roundtrippable', async () => {
    const slots = [];
    for (let i = 0; i < 3; i++) {
      const c = createCampaign(`Maximum ${i}`, i, 'Bastion', 'warden.bulwark');
      while (c.assets.length < 1024) c.assets.push(newAsset('friendly.rifle_squad'));
      const fence = emptyFence(c.lineage);
      fence.generated = Array.from({ length: 4096 }, (_, n) =>
        (n + 1).toString(16).padStart(64, '0'),
      );
      slots.push({
        campaign: c,
        fence,
        previous: { campaign: structuredClone(c), fence },
        practice: null,
        practiceSequence: '18446744073709551615',
      });
    }
    const backup = await createBackup(slots, null),
      text = canonical(backup);
    expect(new TextEncoder().encode(text).length).toBeLessThan(BACKUP_BYTES);
    expect((await readBackup(text)).backup).toEqual(backup);
  });
  it('normalizes UUID case only after checking original bytes and rejects identity aliases', async () => {
    const { store } = await setup(),
      backup = await store.export([0], null);
    const mixed = structuredClone(backup),
      slot = mixed.slots[0];
    if (!slot) throw new Error('Missing');
    slot.campaign.lineage = slot.campaign.lineage.toUpperCase();
    slot.fence.lineage = slot.fence.lineage.toUpperCase();
    for (const asset of slot.campaign.assets) asset.id = asset.id.toUpperCase();
    const { checksum: ignored, ...payload } = mixed;
    void ignored;
    mixed.checksum = await hash(payload);
    const parsed = await readBackup(canonical(mixed));
    expect(parsed.backup.slots[0]?.campaign.lineage).toBe(backup.slots[0]?.campaign.lineage);
    const original = slot.campaign.assets[0];
    if (!original) throw new Error('Missing asset');
    if (slot.campaign.schema === 1) {
      const a = slot.campaign.assets[0];
      if (!a) throw new Error('Missing asset');
      slot.campaign.assets.push({ ...a, id: a.id.toLowerCase() });
    } else {
      const a = slot.campaign.assets[0];
      if (!a) throw new Error('Missing asset');
      slot.campaign.assets.push({ ...a, id: a.id.toLowerCase() });
    }
    await expect(createBackup([slot], null)).rejects.toThrow('Duplicate owned');
  });
  it('imports earlier unchecksummed foundation exports only with an explicit legacy marker', async () => {
    const { c } = await setup();
    const result = await readBackup(
      JSON.stringify({ format: 'resonance-foundation-backup-v1', campaign: c }),
    );
    expect(result.legacy).toBe(true);
    expect(result.backup.slots[0]?.campaign).toEqual(c);
    expect(result.backup.slots[0]?.practice).toBeNull();
  });
  it('rejects unsupported headers, duplicate/escaped keys, prototype keys, depth, oversized bytes and unsafe numbers', async () => {
    for (const text of [
      '{"x":1,"x":2}',
      '{"x":1,"\\u0078":2}',
      '{"__proto__":{}}',
      '{"constructor":1}',
      '['.repeat(34) + '0' + ']'.repeat(34),
      '1e400',
      '{} garbage',
      '{"x":01}',
    ])
      expect(() => parseBackupJSON(text)).toThrow();
    expect(() => parseBackupJSON(' '.repeat(BACKUP_BYTES + 1))).toThrow('32 MiB');
    const { store } = await setup();
    const b = await store.export([0], null);
    await expect(readBackup(canonical({ ...b, schema: 9 }))).rejects.toThrow();
    const s = b.slots[0];
    if (!s) throw new Error('Missing');
    s.campaign.credits = Number.MAX_SAFE_INTEGER + 1;
    await expect(createBackup([s], null)).rejects.toThrow();
  });
});
