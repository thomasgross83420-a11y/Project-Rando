/** Optional preparation budget, not a purchase or deduction from rewards.
 * Includes pre-existing wounds: starting cost is reported separately so the
 * full-body budget cannot be mistaken for damage incurred in this encounter. */
import type { ProgressionCampaign } from '../persistence/campaign';
import { quoteRepair, quoteRestore, quoteRearm } from '../economy/recovery';
import { bodyInvestment } from './preparation';
import { coreBaseline } from '../data/foundation';

export function fullRecoveryBudget(c: ProgressionCampaign, ids: readonly string[]) {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate recovery identity');
  const assets = ids.map((id) => {
    const a = c.assets.find((a) => a.id === id);
    if (!a) throw new Error('Recovery identity missing');
    const investment = bodyInvestment(a);
    const restore = a.hp === 0 ? quoteRestore(investment) : { body: a.hp, credits: 0 };
    const repair = quoteRepair({ ...investment, body: restore.body }, investment.maximum);
    const rearm =
      a.permanentCharges === null
        ? { credits: 0 }
        : quoteRearm(investment.baseCost, 1, a.permanentCharges, 1);
    return {
      id,
      restoreCredits: restore.credits,
      repairCredits: repair.credits,
      rearmCredits: rearm.credits,
      credits: restore.credits + repair.credits + rearm.credits,
    };
  });
  const coreCredits = quoteRepair(
    {
      body: c.coreHP,
      maximum: coreBaseline.hp * 1024,
      baseCost: 0,
      enhancementPaid: 0,
      promotionCoresPaid: 0,
      warden: false,
      core: true,
      refundLocked: false,
      emergencyCreated: false,
    },
    coreBaseline.hp * 1024,
  ).credits;
  const credits = coreCredits + assets.reduce((sum, a) => sum + a.credits, 0);
  if (!Number.isSafeInteger(credits)) throw new Error('Recovery budget exceeds safe integer');
  return { credits, coreCredits, assets };
}
