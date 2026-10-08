/** Ordinary C01S01 result adapter. No cosmetic event log drives rewards. */
import { z } from 'zod';
import { combat } from '../data/combat';
import { coreBaseline } from '../data/foundation';
import { calculateReward, noAdditions, resamplePressure, walletCredit } from '../economy/policy';
import { maximumBody, validateCampaign } from '../persistence/campaign';
import { fenceSchema } from '../persistence/fence';
import type { RunRules, TerminalInput } from '../persistence/run-journal';
import type { Battle } from '../sim/battle';
import {
  campaignTutorialSchema,
  campaignTutorialPlan,
  validateFrozenCampaign,
  type FrozenCampaign,
} from '../sim/campaign-start';
import { canonical } from '../sim/determinism';
import { CONTRIBUTION_POLICY, SCORE_PER_POINT, SCORE_PER_FIXED } from './contribution';
import { allocateAssetXP, applyRankXP, levelUpBody } from './allocation';
import { captureProfile, developingSlice } from './profile';
import { fullRecoveryBudget } from './recovery-summary';
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const wide = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,38})$/)
  .refine((x) => BigInt(x) <= (1n << 128n) - 1n);
const actorSchema = z
  .object({
    id: integer.min(1),
    uuid: z
      .uuid()
      .transform((s) => s.toLowerCase())
      .nullable(),
    type: z.string().max(100),
    team: z.enum(['friendly', 'hostile']),
    developing: z.boolean(),
    rewardable: z.boolean(),
    body: integer,
    maximum: integer.min(1),
    firstZero: z.boolean(),
    initialMissing: integer,
    hostileBodyReceived: wide,
    restorationUsed: wide,
    operationalBlocks: z.array(z.literal(1)).max(1),
    initialStock: integer.max(1),
    permanentStock: integer.max(1),
    temporaryStock: z.literal(0),
    controlReceived: z.literal('0'),
    controlledTick: z.literal(-1),
    revealed: z.literal(false),
    scores: z
      .object({
        damage: wide,
        restoration: wide,
        prevention: wide,
        control: z.literal('0'),
        detection: z.literal('0'),
      })
      .strict(),
    score: wide,
  })
  .strict();
const ledgerSchema = z
  .object({
    policy: z.literal(CONTRIBUTION_POLICY),
    scoreUnitsPerPoint: z.literal(String(SCORE_PER_POINT)),
    tick: integer,
    block: z.literal(1),
    actors: z.array(actorSchema).min(2).max(105),
  })
  .strict();
const aggregatesSchema = z
  .object({
    contributions: ledgerSchema,
    perceivedHostiles: z.array(integer.min(1001).max(1024)).max(24),
    kills: integer.max(24),
    destroyedTP: integer.max(30),
    admittedPackets: integer.max(24),
    victoryQuiet: integer.max(60),
    liveHostileProjectiles: z.literal(0),
  })
  .strict();
const endSchema = z
  .object({
    coreHP: integer.max(coreBaseline.hp * 1024),
    assets: z
      .array(
        z
          .object({
            id: z.uuid().transform((s) => s.toLowerCase()),
            hp: integer,
            permanentStock: integer.max(1),
          })
          .strict(),
      )
      .max(80),
  })
  .strict();
const originsSchema = z
  .array(
    z
      .object({
        segment: integer.min(1).max(5),
        plannedQTP: integer.max(120),
        destroyedQTP: integer.max(120),
      })
      .strict(),
  )
  .length(5);
export const CAMPAIGN_RESULT_RULES = 'campaign.c01s01-result-v1';
function originBuckets(actors: readonly { id: number; team: string; body: number }[]) {
  const packets = campaignTutorialPlan().packets;
  return Array.from({ length: 5 }, (_, i) => {
    const group = packets.filter((p) => Math.floor(p.tick / 1200) === i);
    return {
      segment: i + 1,
      plannedQTP: group.reduce((sum, p) => sum + p.tp * 4, 0),
      destroyedQTP: group
        .filter((p) =>
          actors.some((a) => a.team === 'hostile' && a.id === 1000 + p.id && a.body === 0),
        )
        .reduce((sum, p) => sum + p.tp * 4, 0),
    };
  });
}
/** Captures applied terminal values; cannot turn practice or a Study into a paid run. */
export function captureCampaignTerminal(b: Battle) {
  campaignTutorialSchema.parse(b.plan);
  if (b.state !== 'Victory' && b.state !== 'Defeat')
    throw new Error('Campaign has no terminal result');
  const contributions = b.contributionSnapshot;
  return {
    terminalTick: b.tick,
    outcome: b.state,
    endBodyAndStock: {
      coreHP: b.core.hp,
      assets: contributions.actors
        .filter((a) => a.uuid)
        .map((a) => ({ id: a.uuid, hp: a.body, permanentStock: a.permanentStock })),
    },
    aggregates: {
      contributions,
      perceivedHostiles: b.perceivedHostiles,
      kills: b.kills,
      destroyedTP: b.destroyedTP,
      admittedPackets: b.packet,
      victoryQuiet: b.victoryQuiet,
      liveHostileProjectiles: b.projectiles.filter((p) => p.team === 'hostile').length,
    },
    rewardOriginBuckets: originBuckets(contributions.actors),
  };
}
function validateActors(frozen: FrozenCampaign, terminal: TerminalInput) {
  const facts = aggregatesSchema.parse(terminal.aggregates),
    ledger = facts.contributions;
  if (ledger.tick !== terminal.terminalTick) throw new Error('Terminal contribution tick mismatch');
  const seen = new Set<number>(),
    uuids = new Set<string>();
  const expectedFriendly = [
    {
      id: 1,
      uuid: null,
      type: 'objective.harmonic_core',
      hp: frozen.coreHP,
      maximum: coreBaseline.hp * 1024,
      developing: false,
      permanentStock: 0,
    },
    ...frozen.army.map((a, i) => ({
      id: i + 2,
      uuid: a.uuid,
      type: a.type,
      hp: a.hp,
      maximum: captureProfile(a.type, a.level, a.enhancement).definition.hp,
      developing: (developingSlice as readonly string[]).includes(a.type),
      permanentStock: a.permanentStock,
    })),
  ];
  let damage = 0n,
    restore = 0n,
    received = 0n,
    restored = 0n,
    hostileBodyLost = 0n;
  for (const a of ledger.actors) {
    if (seen.has(a.id) || (a.uuid && uuids.has(a.uuid)))
      throw new Error('Duplicate terminal actor');
    seen.add(a.id);
    if (a.uuid) uuids.add(a.uuid);
    if (a.body > a.maximum || (a.body === 0 && !a.firstZero) || (a.body > 0 && a.firstZero))
      throw new Error('Terminal body/resurrection mismatch');
    const score = Object.values(a.scores).reduce((sum, x) => sum + BigInt(x), 0n);
    if (score !== BigInt(a.score) || (!a.developing && score !== 0n))
      throw new Error('Terminal score eligibility/sum mismatch');
    if (a.team === 'friendly') {
      const f = expectedFriendly.find((f) => f.id === a.id);
      if (
        !f ||
        a.uuid !== f.uuid ||
        a.type !== f.type ||
        a.maximum !== f.maximum ||
        a.developing !== f.developing ||
        a.rewardable ||
        a.initialMissing !== f.maximum - f.hp ||
        a.initialStock !== (a.type === 'friendly.proximity_mine' ? 1 : 0) ||
        a.permanentStock > f.permanentStock
      )
        throw new Error('Terminal owned identity/profile/stock mismatch');
      const injury = BigInt(a.hostileBodyReceived),
        healing = BigInt(a.restorationUsed);
      if (
        healing > BigInt(a.initialMissing) + injury ||
        BigInt(a.body) !== BigInt(f.hp) - injury + healing
      )
        throw new Error('Terminal injury/restoration/body mismatch');
      if (
        (f.hp === 0 && a.operationalBlocks.length !== 0) ||
        (f.hp > 0 && terminal.terminalTick > 0 && a.operationalBlocks.length !== 1)
      )
        throw new Error('Terminal participation mismatch');
      damage += BigInt(a.scores.damage);
      restore += BigInt(a.scores.restoration);
      received += injury;
      restored += healing;
    } else {
      const p = campaignTutorialPlan().packets.find((p) => 1000 + p.id === a.id);
      if (
        !p ||
        a.type !== p.type ||
        a.uuid !== null ||
        a.developing ||
        !a.rewardable ||
        a.maximum !== combat[p.type].hp ||
        a.initialMissing !== 0 ||
        a.initialStock !== 0 ||
        a.permanentStock !== 0 ||
        a.operationalBlocks.length !== 0 ||
        a.hostileBodyReceived !== '0' ||
        a.restorationUsed !== '0' ||
        p.tick > terminal.terminalTick
      )
        throw new Error('Terminal enemy origin/profile mismatch');
      hostileBodyLost += BigInt(a.maximum - a.body);
    }
  }
  if (expectedFriendly.some((f) => !seen.has(f.id)))
    throw new Error('Missing terminal owned actor');
  if (damage > hostileBodyLost * SCORE_PER_FIXED || restore !== restored * SCORE_PER_FIXED)
    throw new Error('Terminal contribution conservation mismatch');
  const maximumAttack = campaignTutorialPlan().packets.reduce(
    (sum, p) => sum + (combat[p.type].weapon?.damage ?? 0),
    0,
  );
  if (received > BigInt(terminal.terminalTick) * BigInt(maximumAttack))
    throw new Error('Terminal damage budget exceeded');
  const prevention = ledger.actors.reduce((sum, a) => sum + BigInt(a.scores.prevention), 0n);
  if (prevention > BigInt(terminal.terminalTick) * BigInt(maximumAttack) * SCORE_PER_FIXED)
    throw new Error('Terminal prevention budget exceeded');
  const dead = ledger.actors.filter((a) => a.team === 'hostile' && a.body === 0),
    kills = dead.length,
    tp = dead.reduce((sum, a) => sum + (a.type === 'enemy.raider' ? 2 : 1), 0);
  if (facts.kills !== kills || facts.destroyedTP !== tp)
    throw new Error('Terminal kill totals mismatch');
  const origins = originsSchema.parse(terminal.rewardOriginBuckets);
  if (canonical(origins) !== canonical(originBuckets(ledger.actors)))
    throw new Error('Terminal reward origins mismatch');
  const end = endSchema.parse(terminal.endBodyAndStock),
    core = ledger.actors.find((a) => a.id === 1);
  if (
    !core ||
    end.coreHP !== core.body ||
    canonical(end.assets) !==
      canonical(
        ledger.actors
          .filter((a) => a.uuid)
          .map((a) => ({ id: a.uuid, hp: a.body, permanentStock: a.permanentStock })),
      )
  )
    throw new Error('Terminal body/stock capture mismatch');
  if (
    facts.admittedPackets !== ledger.actors.filter((a) => a.team === 'hostile').length ||
    ledger.actors
      .filter((a) => a.team === 'hostile')
      .some((a) => a.id > 1000 + facts.admittedPackets)
  )
    throw new Error('Terminal admitted packet mismatch');
  if (
    terminal.outcome === 'Victory' &&
    (!core.body ||
      kills !== 24 ||
      facts.admittedPackets !== 24 ||
      facts.victoryQuiet !== 60 ||
      facts.liveHostileProjectiles !== 0)
  )
    throw new Error('Victory terminal condition mismatch');
  if (
    new Set(facts.perceivedHostiles).size !== facts.perceivedHostiles.length ||
    facts.perceivedHostiles.some(
      (id) => !ledger.actors.some((a) => a.team === 'hostile' && a.id === id),
    )
  )
    throw new Error('Terminal discovery identity mismatch');
  return { facts, end, origins };
}
export const campaignTutorialRules: RunRules = {
  id: CAMPAIGN_RESULT_RULES,
  validateStart(base, plan, frozen, fence) {
    const c = validateCampaign(base);
    if (c.schema !== 2) throw new Error('Progression campaign required');
    campaignTutorialSchema.parse(plan);
    validateFrozenCampaign(c, frozen);
    const f = fenceSchema.parse(fence);
    if (f.lineage !== c.lineage) throw new Error('Campaign fence lineage mismatch');
  },
  derive(cp, terminal) {
    this.validateStart(cp.base, cp.plan, cp.frozen, cp.fence);
    const c = validateCampaign(cp.base);
    if (c.schema !== 2) throw new Error('Progression campaign required');
    const frozen = validateFrozenCampaign(c, cp.frozen),
      { facts, end, origins } = validateActors(frozen, terminal),
      claims = structuredClone(cp.fence);
    const recoveryIDs = frozen.army.map((a) => a.uuid),
      startingRecovery = fullRecoveryBudget(c, recoveryIDs);
    const first = !claims.campaign.includes('C01S01'),
      victory = terminal.outcome === 'Victory';
    const plan = campaignTutorialSchema.parse(cp.plan);
    const objectives = plan.objectives.filter(
      (id) =>
        victory &&
        (id === 'objective.core_75'
          ? end.coreHP * 4 >= coreBaseline.hp * 1024 * 3
          : facts.contributions.actors.some((a) => a.type === c.warden && a.body > 0)),
    );
    const roles = facts.perceivedHostiles
      .map((id) => facts.contributions.actors.find((a) => a.id === id)?.type)
      .filter(
        (type): type is 'enemy.runner' | 'enemy.raider' =>
          type === 'enemy.runner' || type === 'enemy.raider',
      );
    const discovered = [...new Set(roles)].filter((type) => !claims.roles.includes(type)).sort();
    claims.roles.push(...discovered);
    claims.roles.sort();
    if (first && victory) {
      claims.campaign.push('C01S01');
      claims.campaign.sort();
    }
    const pressures = resamplePressure(5),
      reward = calculateReward(
        {
          policy: 'economy.duration_wave_v1',
          band: 1,
          runStartRank: c.rank,
          difficulty: plan.difficulty,
          modifiers: [],
          mastery: false,
          challengeTier: 0,
          firstCampaignAttempt: first,
        },
        origins.map((o) => {
          const pressure = pressures[o.segment - 1];
          if (!pressure) throw new Error('Missing authored origin pressure');
          return { ...o, block: 1 as const, duration: 90 as const, pressure };
        }),
        terminal.outcome,
        {
          ...noAdditions,
          objectives: objectives.length as 0 | 1 | 2,
          firstClearXP: first && victory ? 50 : 0,
          discoveryXP: 25 * discovered.length,
        },
      );
    const rank = applyRankXP(
      c.rank,
      c.accountXP,
      reward.bastionXP,
      BigInt(c.lifetimeXP),
      c.lifetimeXPSaturated,
    );
    const participants = frozen.army.map((a) => {
      const owned = c.assets.find((x) => x.id === a.uuid),
        actor = facts.contributions.actors.find((x) => x.uuid === a.uuid);
      if (!owned || !actor) throw new Error('Result participant missing');
      return {
        id: a.uuid,
        xp: owned.xp,
        level: owned.level,
        developing: actor.developing,
        blocks: actor.operationalBlocks.length,
        contribution: BigInt(actor.score),
      };
    });
    const allocation = allocateAssetXP(reward.assetXPPool, c.rank, participants);
    c.coreHP = end.coreHP;
    for (const e of end.assets) {
      const a = c.assets.find((a) => a.id === e.id);
      if (!a) throw new Error('Result owned asset missing');
      const oldMax = maximumBody(a),
        p = allocation.allocations.find((p) => p.id === a.id);
      a.hp = e.hp;
      if (victory) a.refundLocked = false;
      if (a.permanentCharges !== null) a.permanentCharges = e.permanentStock;
      if (p) {
        a.xp = p.xp;
        a.level = p.level;
        a.hp = levelUpBody(a.hp, oldMax, maximumBody(a));
      }
    }
    const credits = walletCredit(c.credits, reward.credits),
      cores = walletCredit(c.promotionCores, reward.promotionCores);
    c.credits = credits.balance;
    c.promotionCores = cores.balance;
    c.rank = rank.rank;
    c.accountXP = rank.progress;
    c.lifetimeXP = String(rank.lifetime);
    c.lifetimeXPSaturated = rank.saturated;
    c.emergencyActive = false;
    if (plan.simulation === 'rb-sim-v4') {
      c.build = '0.2.7-support';
      c.simulationVersion = 'rb-sim-v4';
    }
    c.revision++;
    const recovery = fullRecoveryBudget(c, recoveryIDs);
    return {
      after: validateCampaign(c),
      claims,
      rewards: {
        policy: reward.policy,
        credits: String(reward.credits),
        creditedCredits: String(credits.credited),
        uncreditedCredits: String(credits.uncredited),
        bastionXP: String(reward.bastionXP),
        promotionCores: String(reward.promotionCores),
        creditedCores: String(cores.credited),
        uncreditedCores: String(cores.uncredited),
        assetXPPool: String(reward.assetXPPool),
        grantedAssetXP: String(allocation.granted),
        unusedAssetXP: String(allocation.unused),
        allocations: allocation.allocations.map((a) => ({
          ...a,
          previousXP: cp.base.assets.find((o) => o.id === a.id)?.xp,
          previousLevel: cp.base.assets.find((o) => o.id === a.id)?.level,
          allocated: String(a.allocated),
          granted: String(a.granted),
          unused: String(a.unused),
        })),
        ranksCrossed: rank.crossed,
        previousRank: cp.base.rank,
        rank: c.rank,
        rankProgress: c.accountXP,
        creditsBefore: cp.base.credits,
        creditsAfter: c.credits,
        coreHP: c.coreHP,
        recovery: {
          ...recovery,
          startingCredits: startingRecovery.credits,
          grossLessFullRecovery: String(credits.credited - BigInt(recovery.credits)),
          walletAfterFullRecovery: String(BigInt(c.credits) - BigInt(recovery.credits)),
        },
        discovered,
        objectives,
        firstClear: first && victory,
      },
    };
  },
};
