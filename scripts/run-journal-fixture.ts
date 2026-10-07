import { PracticeStore, practiceArmy } from '../src/persistence/practice';
/** Browser-test bundle only. Not referenced by the game app or production build. */
import { Database } from '../src/persistence/database';
import { CampaignRepository } from '../src/persistence/repository';
import { createCampaign, type Campaign } from '../src/persistence/campaign';
import { RunJournalStore } from '../src/persistence/run-journal';
import {
  fixtureRules,
  fixturePlan,
  fixtureFrozen,
  fixtureTerminal,
} from '../tests/fixtures/run-rules';
export {
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
