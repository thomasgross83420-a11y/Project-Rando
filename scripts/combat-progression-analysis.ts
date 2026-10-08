/** Real current-slice receipts, not assumed win budgets or full-campaign tuning. */
import { deployedCampaign } from '../tests/fixtures/campaign';
import { Battle } from '../src/sim/battle';
import { campaignTutorialPlan, freezeCampaign } from '../src/sim/campaign-start';
import { CampaignRepository } from '../src/persistence/repository';
import { RunJournalStore } from '../src/persistence/run-journal';
import { campaignTutorialRules, captureCampaignTerminal } from '../src/progression/campaign-result';
import { previewEmergency } from '../src/progression/emergency';
import { previewProgression } from '../src/progression/preparation';
import { maximumBody, type ProgressionCampaign } from '../src/persistence/campaign';
import { fullRecoveryBudget } from '../src/progression/recovery-summary';
import { hash } from '../src/sim/determinism';

const cases = [
  { id: 'guided-standard-two-paid-clears', difficulty: 'Standard', repeats: 2 },
  { id: 'owned-repair-stored-standard', difficulty: 'Standard', repeats: 1 },
  { id: 'rifle-starts-half-body-standard', difficulty: 'Standard', repeats: 1 },
  { id: 'zero-wallet-all-wreck-emergency-cadet', difficulty: 'Cadet', repeats: 1 },
  { id: 'immediate-surrender-standard', difficulty: 'Standard', repeats: 1 },
] as const;
export async function measureCombatProgression() {
  const records = [];
  for (const spec of cases) {
    let c = deployedCampaign();
    if (spec.id === 'owned-repair-stored-standard') {
      const a = c.assets.find((a) => a.type === 'friendly.repair_node');
      if (!a) throw new Error('Repair missing');
      a.placement = null;
    }
    if (spec.id === 'rifle-starts-half-body-standard') {
      const a = c.assets.find((a) => a.type === 'friendly.rifle_squad');
      if (!a) throw new Error('Rifle missing');
      a.hp = maximumBody(a) / 2;
    }
    if (spec.id === 'zero-wallet-all-wreck-emergency-cadet') {
      c.coreHP = 0;
      c.credits = 0;
      for (const a of c.assets) a.hp = 0;
      c = previewEmergency(c).after;
    }
    const repo = new CampaignRepository(undefined);
    await repo.acquire();
    await repo.commit(c, undefined);
    const journal = new RunJournalStore(repo, campaignTutorialRules);
    for (let iteration = 1; iteration <= spec.repeats; iteration++) {
      const cp = await journal.start(c, campaignTutorialPlan(spec.difficulty), freezeCampaign(c)),
        b = await Battle.createCampaign(cp.plan, cp.frozen);
      if (spec.id === 'immediate-surrender-standard') b.surrender();
      let budget = 36000;
      while (b.state === 'Siege' || b.state === 'Cleanup') {
        if (!budget--) throw new Error('Audit combat timeout');
        b.step();
      }
      const terminal = captureCampaignTerminal(b),
        pending = await journal.buildPending(cp, terminal);
      await journal.journal(cp, pending);
      const first = await journal.finalize(cp, pending),
        second = await journal.finalize(cp, pending);
      if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Repeat result drift');
      await journal.acknowledge(c.slot, cp.runID);
      if (pending.after.schema !== 2) throw new Error('Schema');
      const after = pending.after;
      records.push({
        case: spec.id,
        iteration,
        difficulty: spec.difficulty,
        outcome: b.state,
        ticks: b.tick,
        combatSeconds: b.tick / 60,
        kills: b.kills,
        destroyedTP: b.destroyedTP,
        battleHash: await hash(b.snapshot()),
        terminalHash: await hash(terminal),
        checkpointHash: cp.checksum,
        pendingHash: pending.checksum,
        startingRank: c.rank,
        endingRank: after.rank,
        startingCredits: c.credits,
        endingCredits: after.credits,
        rewards: pending.rewards,
        coreHP: after.coreHP,
        assets: after.assets
          .filter((a) => a.placement)
          .map((a) => ({
            id: a.id,
            type: a.type,
            body: a.hp,
            maximum: maximumBody(a),
            xp: a.xp,
            level: a.level,
            enhancement: a.enhancement,
            stock: a.permanentCharges,
          })),
        contributions: terminal.aggregates,
      });
      c = after;
      if (iteration < spec.repeats) {
        const before = c,
          ids = freezeCampaign(before).army.map((a) => a.uuid),
          q = fullRecoveryBudget(c, ids);
        if (q.credits > c.credits) throw new Error('Guided repeat recovery unaffordable');
        let repaired: ProgressionCampaign = c;
        for (const id of ids) {
          const a = repaired.assets.find((a) => a.id === id);
          if (!a) throw new Error('Missing recovery asset');
          if (!a.hp) repaired = previewProgression(repaired, { kind: 'restore', id }).after;
          repaired = previewProgression(repaired, {
            kind: 'repair',
            id,
            requested: maximumBody(a),
          }).after;
          if (a.permanentCharges !== null)
            repaired = previewProgression(repaired, { kind: 'rearm', id, requested: 1 }).after;
        }
        repaired = previewProgression(repaired, {
          kind: 'repair-core',
          requested: 10000 * 1024,
        }).after;
        if (before.credits - repaired.credits !== q.credits)
          throw new Error('Advisory purchase cost mismatch');
        await repo.commit(repaired, before);
        c = repaired;
      }
    }
  }
  return {
    scope:
      'Six real C01S01 receipts; one authored teaching schedule, not generated campaign balance',
    policy: campaignTutorialRules.id,
    limitations: [
      'One Warden/doctrine',
      'No hostile ranged/air/stealth/boss roster',
      'No physical Android evidence',
      'No coefficient retuning from tutorial-only results',
    ],
    records,
  };
}
