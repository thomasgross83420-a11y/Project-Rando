import { expect, it } from 'vitest';
import { deployedCampaign } from '../fixtures/campaign';
import { maximumBody } from '../../src/persistence/campaign';
import { PracticeStore, practiceArmy } from '../../src/persistence/practice';
import { CampaignRepository } from '../../src/persistence/repository';
import { BackupStore, readBackup } from '../../src/persistence/backup';
import { createPracticeBattle } from '../../src/sim/practice-battle';
import { captureCampaignTerminal } from '../../src/progression/campaign-result';
import { canonical, hash } from '../../src/sim/determinism';
const required = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error('Missing fixture');
  return v;
};
it('practices with owned earned growth and a full free clone, while preserving campaign wounds, wrecks, stock and wallet', async () => {
  const c = deployedCampaign(),
    sentry = required(c.assets.find((a) => a.type === 'friendly.sentry')),
    mine = required(c.assets.find((a) => a.type === 'friendly.proximity_mine'));
  sentry.xp = 1502;
  sentry.level = 10;
  sentry.enhancement = 1;
  sentry.enhancementPaid = 100;
  sentry.hp = 0;
  mine.permanentCharges = 0;
  c.coreHP = 1;
  const original = structuredClone(c),
    repo = new CampaignRepository(undefined);
  await repo.acquire();
  await repo.commit(c, undefined);
  const store = new PracticeStore(repo),
    cp = await store.start(c, practiceArmy(c, false));
  if (cp.schema !== 2) throw new Error('Expected profiled practice');
  expect(cp.frozen.coreHP).toBe(10000 * 1024);
  expect(cp.frozen.army.find((a) => a.uuid === sentry.id)?.hp).toBe(maximumBody(sentry));
  expect(cp.frozen.army.find((a) => a.uuid === mine.id)?.permanentStock).toBe(1);
  expect(await store.read(c)).toEqual(cp);
  const b = await createPracticeBattle(cp);
  expect(() => captureCampaignTerminal(b)).toThrow();
  b.surrender();
  const result = {
    state: 'Defeat' as const,
    tick: b.tick,
    reason: b.reason,
    hash: await hash(b.snapshot()),
    kills: b.kills,
    tp: b.destroyedTP,
    coreHP: b.core.hp,
  };
  await store.terminal(c, cp, result);
  expect(repo.memory.get(0)).toEqual(original);
  expect(c).toEqual(original);
  await store.discard(c, cp);
  expect(repo.memory.get(0)).toEqual(original);
});
it('roundtrips a profiled practice checkpoint in a whole-slot backup without silently replaying it at level one', async () => {
  const c = deployedCampaign(),
    a = required(c.assets.find((a) => a.type === 'friendly.rifle_squad'));
  a.xp = 1502;
  a.level = 10;
  a.hp = maximumBody(a) - 50 * 1024;
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  await repo.commit(c, undefined);
  const practice = new PracticeStore(repo),
    backup = new BackupStore(repo, practice),
    cp = await practice.start(c, practiceArmy(c));
  const exported = await backup.export([0], null),
    parsed = (await readBackup(canonical(exported))).backup;
  const target = new CampaignRepository(undefined);
  await target.acquire();
  const targetPractice = new PracticeStore(target);
  const targetBackup = new BackupStore(target, targetPractice);
  await targetBackup.replace(parsed, [{ source: 0, destination: 2 }], await targetBackup.inspect());
  const imported = required(target.memory.get(2)),
    retained = required(await targetPractice.read(imported));
  expect(retained.identity).toBe(cp.identity);
  expect(retained.schema).toBe(2);
  const b = await createPracticeBattle(retained),
    frozen = retained.schema === 2 ? retained.frozen : undefined;
  const id = required(frozen?.army.findIndex((x) => x.uuid === a.id));
  expect(b.get(id + 2)?.maxHP).toBe(maximumBody(a));
  expect(imported.assets.find((x) => x.id === a.id)?.hp).toBe(a.hp);
});
