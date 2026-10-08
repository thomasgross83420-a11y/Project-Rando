import { expect, it } from 'vitest';
import { supportCampaign } from '../fixtures/support';
import { Battle } from '../../src/sim/battle';
import { campaignTutorialPlan, freezeCampaign } from '../../src/sim/campaign-start';
import { SCORE_PER_POINT } from '../../src/progression/contribution';
import { hash } from '../../src/sim/determinism';
import { deployedCampaign } from '../fixtures/campaign';
import { CampaignRepository } from '../../src/persistence/repository';
import { RunJournalStore } from '../../src/persistence/run-journal';
import {
  campaignTutorialRules,
  captureCampaignTerminal,
} from '../../src/progression/campaign-result';
async function setup(
  order: 'receiver-first' | 'receiver-last',
  simulation: 'rb-sim-v3' | 'rb-sim-v4',
) {
  const { campaign, receiverID } = supportCampaign(order),
    frozen = freezeCampaign(campaign);
  const b = await Battle.createCampaign(campaignTutorialPlan('Standard', simulation), frozen);
  const recipient = b.contributionSnapshot.actors.find((a) => a.uuid === receiverID);
  if (!recipient) throw new Error('Missing recipient');
  return { b, receiverID, recipientID: recipient.id, campaign };
}
for (const order of ['receiver-first', 'receiver-last'] as const) {
  it(`v4 permits self repair plus exactly two external channels when ${order}, and v3 keeps its older replay`, async () => {
    const old = await setup(order, 'rb-sim-v3'),
      current = await setup(order, 'rb-sim-v4');
    for (let i = 0; i < 16; i++) {
      old.b.step();
      current.b.step();
    }
    const sources = current.b.entities.filter((e) => e.channel === current.recipientID);
    expect(sources).toHaveLength(3);
    expect(sources.filter((e) => e.id !== current.recipientID)).toHaveLength(2);
    expect(current.b.get(current.recipientID)?.hp).toBe((400 + 18.75) * 1024);
    expect(old.b.get(old.recipientID)?.hp).toBe((400 + 12.5) * 1024);
    const actors = current.b.contributionSnapshot.actors;
    expect(actors.reduce((n, a) => n + BigInt(a.scores.restoration), 0n)).toBe(
      (75n * SCORE_PER_POINT) / 4n,
    );
    expect(actors.filter((a) => BigInt(a.scores.restoration) > 0n)).toHaveLength(3);
    const again = await setup(order, 'rb-sim-v3');
    for (let i = 0; i < 16; i++) again.b.step();
    expect(await hash(again.b.snapshot())).toBe(await hash(old.b.snapshot()));
  });
}
it('v4 channels finish the remaining injury below the start threshold, never overheal and release at full body', async () => {
  const { b, recipientID } = await setup('receiver-last', 'rb-sim-v4');
  for (let i = 0; i < 350; i++) b.step();
  const target = b.get(recipientID);
  if (!target) throw new Error('Missing');
  expect(target.hp).toBe(target.maxHP);
  expect(b.entities.filter((e) => e.channel === recipientID)).toEqual([]);
  const actors = b.contributionSnapshot.actors;
  expect(actors.reduce((n, a) => n + BigInt(a.scores.restoration), 0n)).toBe(
    400n * SCORE_PER_POINT,
  );
  expect(actors.find((a) => a.id === recipientID)?.restorationUsed).toBe(String(400 * 1024));
});
it('wrecked repair sources cannot reserve slots and an incapacitated recipient cannot be repaired', async () => {
  for (const recipientWrecked of [false, true]) {
    const { campaign, receiverID } = supportCampaign('receiver-last');
    for (const a of campaign.assets.filter((a) => a.type === 'friendly.repair_node'))
      if (a.id !== receiverID || recipientWrecked) a.hp = 0;
    const b = await Battle.createCampaign(campaignTutorialPlan(), freezeCampaign(campaign));
    for (let i = 0; i < 16; i++) b.step();
    const target = b.contributionSnapshot.actors.find((a) => a.uuid === receiverID);
    expect(target?.body).toBe(recipientWrecked ? 0 : (400 + 6.25) * 1024);
    expect(b.entities.filter((e) => e.channel !== 0)).toHaveLength(recipientWrecked ? 0 : 1);
  }
});
it('a retained v3 siege preserves its published whole-battle, checkpoint and pending-result hashes under the v4 runtime', async () => {
  const c = deployedCampaign(),
    repo = new CampaignRepository(undefined);
  await repo.acquire();
  await repo.commit(c, undefined);
  const store = new RunJournalStore(repo, campaignTutorialRules);
  const cp = await store.start(c, campaignTutorialPlan('Standard', 'rb-sim-v3'), freezeCampaign(c));
  expect(cp.checksum).toBe('01d157b2ab2409135b805c9e93b92f83ff604e70af60dbbf53ab62000758f8c7');
  const b = await Battle.createCampaign(cp.plan, cp.frozen);
  while (b.state === 'Siege' || b.state === 'Cleanup') b.step();
  expect(await hash(b.snapshot())).toBe(
    '7729eced0383501f7bf27a22a1c844bc1153ad76b7a7328b26ddebd30860b968',
  );
  const pending = await store.buildPending(cp, captureCampaignTerminal(b));
  expect(pending.checksum).toBe('d669eaff88c61219e2f1a3594bd14a46bd5d2d655b59349f77b32b15faa2598c');
  expect(pending.after.simulationVersion).toBe('rb-sim-v3');
  expect(pending.after.build).toBe('0.2.6-progression');
  await store.journal(cp, pending);
  const first = await store.finalize(cp, pending);
  expect(await store.finalize(cp, pending)).toEqual(first);
}, 120000);
