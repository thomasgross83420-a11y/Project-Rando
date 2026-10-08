import { PracticeStore, practiceArmy } from '../src/persistence/practice';
/** Browser-test bundle only. Not referenced by the game app or production build. */
import { Database } from '../src/persistence/database';
import { CampaignRepository } from '../src/persistence/repository';
import { createCampaign, type Campaign } from '../src/persistence/campaign';
import { BackupStore, readBackup } from '../src/persistence/backup';
import { campaignTutorialRules, captureCampaignTerminal } from '../src/progression/campaign-result';
import { campaignTutorialPlan, freezeCampaign } from '../src/sim/campaign-start';
import { Battle } from '../src/sim/battle';
import { deployedCampaign } from '../tests/fixtures/campaign';
import { RunJournalStore } from '../src/persistence/run-journal';
import {
  fixtureRules,
  fixturePlan,
  fixtureFrozen,
  fixtureTerminal,
} from '../tests/fixtures/run-rules';
export {
  BackupStore,
  readBackup,
  Battle,
  campaignTutorialRules,
  captureCampaignTerminal,
  campaignTutorialPlan,
  freezeCampaign,
  PracticeStore,
  practiceArmy,
  RunJournalStore,
  CampaignRepository,
  Database,
  fixtureRules,
  fixturePlan,
  fixtureFrozen,
  fixtureTerminal,
};
export async function setup() {
  const database = await Database.open();
  const repo = new CampaignRepository(database);
  await repo.acquire(true);
  let campaign = (await repo.slots())[0];
  if (campaign instanceof Error) throw campaign;
  if (!campaign) {
    campaign = createCampaign('Native transaction fixture', 0, 'Bastion', 'warden.bulwark');
    await repo.commit(campaign, undefined);
  }
  return { repo, store: new RunJournalStore(repo, fixtureRules), campaign: campaign as Campaign };
}
export async function productionSetup(create = true) {
  const database = await Database.open(),
    repo = new CampaignRepository(database);
  await repo.acquire(true);
  let campaign = (await repo.slots())[0];
  if (campaign instanceof Error) throw campaign;
  if (!campaign && create) {
    campaign = deployedCampaign();
    await repo.commit(campaign, undefined);
  }
  return {
    repo,
    campaign,
    journal: new RunJournalStore(repo, campaignTutorialRules),
    backup: new BackupStore(repo, new PracticeStore(repo)),
  };
}
export async function productionPending(session: Awaited<ReturnType<typeof productionSetup>>) {
  const c = session.campaign;
  if (c?.schema !== 2) throw new Error('Production campaign missing');
  const cp = await session.journal.start(c, campaignTutorialPlan(), freezeCampaign(c));
  const b = await Battle.createCampaign(cp.plan, cp.frozen);
  for (let i = 0; i < 1800; i++) b.step();
  b.surrender();
  const pending = await session.journal.buildPending(cp, captureCampaignTerminal(b));
  await session.journal.journal(cp, pending);
  return { cp, pending };
}
