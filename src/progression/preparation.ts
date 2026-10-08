/** Paid progression and recovery are preparation transactions. Pure previews
 * share the exact operation later committed by CampaignRepository. */
import { foundation, coreBaseline } from '../data/foundation';
import {
  quoteRepair,
  quoteRestore,
  quoteRearm,
  quoteSale,
  type BodyInvestment,
} from '../economy/recovery';
import { walletCredit } from '../economy/policy';
import {
  maximumBody,
  validateCampaign,
  type ProgressionCampaign,
  type ProgressedOwned,
} from '../persistence/campaign';
import { levelUpBody } from './allocation';
import { developingSlice } from './profile';
import { quoteEnhancement } from './purchases';

export type ProgressionCommand =
  | { kind: 'repair'; id: string; requested: number }
  | { kind: 'repair-core'; requested: number }
  | { kind: 'restore'; id: string }
  | { kind: 'rearm'; id: string; requested: number }
  | { kind: 'enhance'; id: string }
  | { kind: 'sell'; id: string };
export function bodyInvestment(a: ProgressedOwned): BodyInvestment {
  const d = foundation[a.type];
  return {
    body: a.hp,
    maximum: maximumBody(a),
    baseCost: d.cost,
    enhancementPaid: a.enhancementPaid,
    promotionCoresPaid: 0,
    warden: d.category === 'warden',
    core: false,
    refundLocked: false,
    emergencyCreated: false,
  };
}
export function previewProgression(before: ProgressionCampaign, command: ProgressionCommand) {
  const c = validateCampaign(before);
  if (c.schema !== 2) throw new Error('Explicit progression migration required');
  let cost = 0,
    refund = 0n,
    uncredited = 0n;
  if (command.kind === 'repair-core') {
    const q = quoteRepair(
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
      command.requested,
    );
    c.coreHP = q.body;
    cost = q.credits;
  } else {
    const a = c.assets.find((a) => a.id === command.id.toLowerCase());
    if (!a) throw new Error('Owned asset missing');
    const investment = bodyInvestment(a);
    switch (command.kind) {
      case 'repair': {
        const q = quoteRepair(investment, command.requested);
        a.hp = q.body;
        cost = q.credits;
        break;
      }
      case 'restore': {
        const q = quoteRestore(investment);
        a.hp = q.body;
        cost = q.credits;
        break;
      }
      case 'rearm': {
        if (a.type !== 'friendly.proximity_mine' || a.permanentCharges === null)
          throw new Error('Rearm is not implemented for this type');
        if (!a.hp) throw new Error('Restore the wreck before rearming');
        const q = quoteRearm(foundation[a.type].cost, 1, a.permanentCharges, command.requested);
        a.permanentCharges = q.permanent;
        cost = q.credits;
        break;
      }
      case 'enhance': {
        if (!(developingSlice as readonly string[]).includes(a.type))
          throw new Error('Enhancement is not implemented for this type');
        const q = quoteEnhancement(
          investment.warden ? 500 : investment.baseCost,
          a.level,
          a.enhancement,
        );
        a.enhancement = q.enhancement;
        a.enhancementPaid += q.credits;
        a.hp = levelUpBody(a.hp, investment.maximum, maximumBody(a));
        cost = q.credits;
        break;
      }
      case 'sell': {
        if (a.type === c.warden)
          throw new Error('Select another owned Warden before selling this Warden');
        const q = quoteSale(
          investment,
          c.assets.filter((a) => foundation[a.type].category === 'warden').length,
        );
        const credited = walletCredit(c.credits, BigInt(q.credits));
        c.credits = credited.balance;
        refund = credited.credited;
        uncredited = credited.uncredited;
        c.assets = c.assets.filter((x) => x.id !== a.id);
        break;
      }
    }
  }
  if (c.credits < cost) throw new Error('Insufficient Credits');
  c.credits -= cost;
  c.revision++;
  const after = validateCampaign(c);
  if (after.schema !== 2) throw new Error('Progression schema changed');
  return {
    after,
    creditsSpent: cost,
    creditsRefunded: String(refund),
    uncredited: String(uncredited),
  };
}
