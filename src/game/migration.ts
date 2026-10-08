import { validateCampaign } from '../persistence/campaign';
import type { ProgressFence } from '../persistence/fence';
import { makeAsset, newGame, assertGame, type GameState } from './model';
const mapping: Record<string, string> = {
  'friendly.sentry': 'friendly.sentry',
  'friendly.rifle_squad': 'friendly.rifle_squad',
  'friendly.combat_engineers': 'friendly.combat_engineers',
  'friendly.standard_barricade': 'friendly.standard_barricade',
  'friendly.proximity_mine': 'friendly.proximity_mine',
  'friendly.slow_field': 'friendly.slow_field',
  'friendly.repair_node': 'friendly.repair_node',
};
/** Explicit copy migration. Historical data remains in its original database. */
export function migrateLegacy(raw: unknown, fence: ProgressFence | undefined): GameState {
  const old = validateCampaign(raw),
    s = newGame(old.name, old.slot, old.doctrine, old.warden);
  s.id = old.lineage;
  s.revision = old.revision;
  s.rank = old.rank;
  s.rankXP = old.accountXP;
  s.credits = old.credits;
  s.cores = old.promotionCores;
  s.coreHP = old.coreHP;
  if (old.schema === 2) {
    s.lifetimeXP = old.lifetimeXP;
    s.emergencyEpisode = old.emergencyActive;
  }
  s.assets = old.assets.map((a) => {
    const next = makeAsset(mapping[a.type] ?? a.type);
    next.id = a.id;
    next.hp = a.hp;
    next.xp = a.xp;
    next.level = a.level;
    next.enhancement = a.enhancement;
    next.stars = a.stars;
    next.basePaid = a.paidCredits;
    next.placement = a.placement;
    if ('enhancementPaid' in a) {
      next.enhancementPaid = a.enhancementPaid;
      next.charges = a.permanentCharges;
      next.refundLocked = a.refundLocked;
      next.emergency = a.emergencyCreated;
    }
    if (a.placement) next.tactics.anchor = { x: a.placement.x + 1, y: a.placement.y + 1 };
    return next;
  });
  if (fence) {
    s.sequence = fence.allocated;
    s.finalized = fence.finalized;
    s.stages = fence.campaign.map(
      (id) => (Number(id.slice(1, 3)) - 1) * 5 + Number(id.slice(4)) - 1,
    );
    s.trials = fence.mastery.map((id) => Number(id.slice(2)) - 1);
    s.discoveries = [...fence.roles, ...fence.bosses];
  }
  assertGame(s);
  return s;
}
