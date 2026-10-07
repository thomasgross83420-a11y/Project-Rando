import { z } from 'zod';
import { walletCredit } from '../../src/economy/policy';
import type { RunRules, TerminalInput } from '../../src/persistence/run-journal';
/** Explicit synthetic fixture, not a campaign compiler or gameplay payout. */
export const fixtureRules: RunRules = {
  id: 'foundation-transaction-fixture-v1',
  validateStart(_base, plan, frozen) {
    z.object({ kind: z.literal('transaction-fixture'), seed: z.literal('same-seed') })
      .strict()
      .parse(plan);
    z.object({ credits: z.literal(37) })
      .strict()
      .parse(frozen);
  },
  derive(cp, terminal) {
    this.validateStart(cp.base, cp.plan, cp.frozen, cp.fence);
    z.object({ unchanged: z.literal(true) })
      .strict()
      .parse(terminal.endBodyAndStock);
    z.object({ kills: z.literal(0) })
      .strict()
      .parse(terminal.aggregates);
    z.array(z.never()).length(0).parse(terminal.rewardOriginBuckets);
    const reward = terminal.outcome === 'Victory' ? 37n : 0n;
    const wallet = walletCredit(cp.base.credits, reward);
    const claims = structuredClone(cp.fence);
    if (terminal.outcome === 'Victory' && !claims.campaign.includes('C01S01'))
      claims.campaign.push('C01S01');
    return {
      after: {
        ...structuredClone(cp.base),
        revision: cp.baseRevision + 1,
        credits: wallet.balance,
      },
      rewards: {
        credits: String(wallet.credited),
        uncredited: String(wallet.uncredited),
        fixture: true,
      },
      claims,
    };
  },
};
export const fixturePlan = { kind: 'transaction-fixture', seed: 'same-seed' };
export const fixtureFrozen = { credits: 37 };
export const fixtureTerminal: TerminalInput = {
  outcome: 'Victory',
  terminalTick: 60,
  endBodyAndStock: { unchanged: true },
  aggregates: { kills: 0 },
  rewardOriginBuckets: [],
};
