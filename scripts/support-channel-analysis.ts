import { supportCampaign } from '../tests/fixtures/support';
import { Battle } from '../src/sim/battle';
import { campaignTutorialPlan, freezeCampaign } from '../src/sim/campaign-start';
import { hash } from '../src/sim/determinism';
import { SCORE_PER_POINT } from '../src/progression/contribution';
export async function measureSupportChannels() {
  const records = [];
  for (const order of ['receiver-first', 'receiver-last'] as const) {
    for (const simulation of ['rb-sim-v3', 'rb-sim-v4'] as const) {
      const { campaign, receiverID } = supportCampaign(order);
      const b = await Battle.createCampaign(
        campaignTutorialPlan('Standard', simulation),
        freezeCampaign(campaign),
      );
      for (let i = 0; i < 16; i++) b.step();
      const recipient = b.contributionSnapshot.actors.find((a) => a.uuid === receiverID);
      if (!recipient) throw new Error('Recipient missing');
      const channels = b.entities.filter((e) => e.channel === recipient.id);
      const at16 = {
        body: recipient.body,
        selfChannels: channels.filter((e) => e.id === recipient.id).length,
        externalChannels: channels.filter((e) => e.id !== recipient.id).length,
        restorationScore: String(
          b.contributionSnapshot.actors.reduce((sum, a) => sum + BigInt(a.scores.restoration), 0n),
        ),
        snapshotHash: await hash(b.snapshot()),
      };
      for (let i = 16; i < 350; i++) b.step();
      const end = b.contributionSnapshot,
        target = end.actors.find((a) => a.uuid === receiverID);
      if (!target) throw new Error('Recipient missing');
      records.push({
        order,
        simulation,
        pulseTicks: 15,
        startingBody: 400 * 1024,
        maximumBody: 800 * 1024,
        at16,
        at350: {
          body: target.body,
          restorationUsed: target.restorationUsed,
          activeChannels: b.entities.filter((e) => e.channel === recipient.id).length,
          totalRestorationScore: String(
            end.actors.reduce((sum, a) => sum + BigInt(a.scores.restoration), 0n),
          ),
          snapshotHash: await hash(b.snapshot()),
        },
      });
      if (
        simulation === 'rb-sim-v4' &&
        (at16.externalChannels !== 2 ||
          at16.selfChannels !== 1 ||
          target.body !== target.maximum ||
          BigInt(target.restorationUsed) !== 400n * 1024n ||
          BigInt(records[records.length - 1]?.at350.totalRestorationScore ?? '0') !==
            400n * SCORE_PER_POINT)
      )
        throw new Error('Support contract failed');
    }
  }
  return {
    scope:
      'Four-Node stationary support contract; no enemies admitted before tick 350; not battle balance/performance certification',
    policy: 'rb-sim-v4 external-channel accounting',
    records,
  };
}
