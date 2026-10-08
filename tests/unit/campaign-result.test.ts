import { expect, it } from 'vitest';
import { deployedCampaign } from '../fixtures/campaign';
import { Battle } from '../../src/sim/battle';
import {
  campaignTutorialPlan,
  freezeCampaign,
  captureCampaign,
} from '../../src/sim/campaign-start';
import {
  campaignTutorialRules,
  captureCampaignTerminal,
} from '../../src/progression/campaign-result';
import { maximumBody } from '../../src/persistence/campaign';
import { CampaignRepository } from '../../src/persistence/repository';
import { RunJournalStore } from '../../src/persistence/run-journal';
import { hash } from '../../src/sim/determinism';
const required = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error('Missing fixture');
  return v;
};
async function start(c = deployedCampaign()) {
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  await repo.commit(c, undefined);
  const store = new RunJournalStore(repo, campaignTutorialRules),
    plan = campaignTutorialPlan(),
    frozen = freezeCampaign(c);
  const cp = await store.start(c, plan, frozen),
    b = await Battle.createCampaign(cp.plan, cp.frozen);
  return { repo, store, cp, b, c };
}
it('captures actual grown profiles, wounds, zero-body wrecks and permanent stock without any Study or free healing', async () => {
  const c = deployedCampaign(),
    rifle = required(c.assets.find((a) => a.type === 'friendly.rifle_squad')),
    sentry = required(c.assets.find((a) => a.type === 'friendly.sentry')),
    mine = required(c.assets.find((a) => a.type === 'friendly.proximity_mine'));
  rifle.xp = 1502;
  rifle.level = 10;
  rifle.enhancement = 1;
  rifle.enhancementPaid = 120;
  rifle.hp = maximumBody(rifle) - 73 * 1024;
  sentry.hp = 0;
  mine.permanentCharges = 0;
  c.coreHP -= 47 * 1024;
  const frozen = freezeCampaign(c),
    captured = captureCampaign(frozen),
    b = await Battle.createCampaign(campaignTutorialPlan(), frozen);
  const index = frozen.army.findIndex((a) => a.uuid === rifle.id),
    e = required(b.entities.find((e) => e.id === index + 2));
  expect(e.hp).toBe(rifle.hp);
  expect(e.maxHP).toBe(maximumBody(rifle));
  expect(e.maxHP - e.hp).toBe(73 * 1024);
  expect(captured.profiles[index + 2]?.accuracy).toEqual({ numerator: 377, denominator: 440 });
  expect(b.core.hp).toBe(c.coreHP);
  expect(b.entities.find((e) => e.type === 'friendly.proximity_mine')?.charges).toBe(0);
  b.step();
  expect(
    b.contributionSnapshot.actors.find((a) => a.uuid === sentry.id)?.operationalBlocks,
  ).toEqual([]);
  expect(Object.keys(b.snapshot())).not.toContain('study');
  expect(b.observedShots).toEqual([]);
  const after = structuredClone(frozen);
  required(after.army[0]).hp = 1;
  expect(frozen.army[0]?.hp).not.toBe(1);
  expect(Object.isFrozen(captured.frozen.army)).toBe(true);
});
it('commits a real authored victory exactly once, awards first-clear/discovery and only deployed developing asset XP', async () => {
  const { c, repo, store, cp, b } = await start();
  while (b.state === 'Siege' || b.state === 'Cleanup') b.step();
  expect(b.state).toBe('Victory');
  expect(b.kills).toBe(24);
  expect(b.destroyedTP).toBe(30);
  const terminal = captureCampaignTerminal(b),
    pending = await store.buildPending(cp, terminal);
  expect(pending.rewards).toMatchObject({
    bastionXP: '255',
    assetXPPool: '200',
    grantedAssetXP: '200',
    unusedAssetXP: '0',
    promotionCores: '1',
    firstClear: true,
    discovered: ['enemy.raider', 'enemy.runner'],
  });
  expect(pending.after).toMatchObject({ rank: 2, accountXP: 155, promotionCores: 1 });
  const next = pending.after;
  if (next.schema !== 2) throw new Error('Schema');
  const fixed = required(
    next.assets.find((a) => a.type === 'friendly.proximity_mine' && a.placement),
  );
  expect(fixed.hp).toBe(200 * 1024);
  expect(fixed.permanentCharges).toBe(0);
  expect(fixed.xp).toBe(0);
  for (const a of next.assets.filter((a) => !a.placement))
    expect(a).toEqual(c.assets.find((o) => o.id === a.id));
  expect(next.assets.filter((a) => a.xp > 0)).toHaveLength(5);
  await store.journal(cp, pending);
  expect(repo.memory.get(0)).toEqual(c);
  const receipt = await store.finalize(cp, pending);
  expect(await store.finalize(cp, pending)).toEqual(receipt);
  expect(repo.memory.get(0)).toEqual(pending.after);
  expect(repo.memoryPrevious.get(0)).toEqual(c);
  await store.acknowledge(0, cp.runID);
  const repeat = await store.start(next, campaignTutorialPlan(), freezeCampaign(next));
  const repeatBattle = await Battle.createCampaign(repeat.plan, repeat.frozen);
  while (repeatBattle.state === 'Siege' || repeatBattle.state === 'Cleanup') repeatBattle.step();
  const repeated = await store.buildPending(repeat, captureCampaignTerminal(repeatBattle));
  expect(repeated.rewards).toMatchObject({ bastionXP: '155', firstClear: false, discovered: [] });
  expect(repeated.after.credits).toBeGreaterThan(next.credits);
}, 120000);
it('does not pay for abandonment, but finalized early defeat retains actual wounds and claims perceived-role discovery once', async () => {
  const { c, repo, store, cp, b } = await start();
  for (let i = 0; i < 1800; i++) b.step();
  b.surrender();
  const terminal = captureCampaignTerminal(b),
    pending = await store.buildPending(cp, terminal);
  expect(pending.rewards).toMatchObject({ firstClear: false, promotionCores: '0' });
  expect(pending.claims.campaign).toEqual([]);
  expect(pending.claims.roles).toEqual(['enemy.runner']);
  const rewards = pending.rewards as {
    bastionXP: string;
    assetXPPool: string;
    discovered: string[];
  };
  expect(BigInt(rewards.bastionXP)).toBeGreaterThanOrEqual(25n);
  expect(BigInt(rewards.assetXPPool)).toBeLessThan(200n);
  await store.abandon(c);
  expect(repo.memory.get(0)).toEqual(c);
  expect(repo.memoryFences.get(c.lineage)?.roles).toEqual([]);
  expect(await store.finalize(cp, pending)).toEqual({ status: 'already-finalized', receipt: null });
});
it('rejects mismatched reward origins, forged participant scores, duplicate identities and body capture, even with rechecksummed pending JSON', async () => {
  const { store, cp, b } = await start();
  for (let i = 0; i < 900; i++) b.step();
  b.surrender();
  const terminal = captureCampaignTerminal(b);
  const tamper = (fn: (t: ReturnType<typeof captureCampaignTerminal>) => void) => {
    const t = structuredClone(terminal);
    fn(t);
    return t;
  };
  await expect(
    store.buildPending(
      cp,
      tamper((t) => {
        required(t.rewardOriginBuckets[0]).destroyedQTP += 4;
      }),
    ),
  ).rejects.toThrow('origins');
  await expect(
    store.buildPending(
      cp,
      tamper((t) => {
        const a = required(t.aggregates.contributions.actors[1]);
        a.score = '999999';
      }),
    ),
  ).rejects.toThrow('sum');
  await expect(
    store.buildPending(
      cp,
      tamper((t) => {
        t.aggregates.contributions.actors.push(required(t.aggregates.contributions.actors[1]));
      }),
    ),
  ).rejects.toThrow('Duplicate');
  await expect(
    store.buildPending(
      cp,
      tamper((t) => {
        t.endBodyAndStock.coreHP--;
      }),
    ),
  ).rejects.toThrow('capture');
  const pending = await store.buildPending(cp, terminal),
    modified = structuredClone(pending);
  modified.after.credits++;
  const { checksum: _c, ...payload } = modified;
  modified.checksum = await hash(payload);
  await expect(store.journal(cp, modified)).rejects.toThrow('derived');
}, 30000);
