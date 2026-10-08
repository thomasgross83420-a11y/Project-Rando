import { compareIDs } from './order';
import { applyRankXP, allocateAssetXP } from '../progression/allocation';
import {
  calculateReward,
  walletCredit,
  type RewardBucket,
  type RewardContext,
} from '../economy/policy';
import thresholds from '../data/progression.json';
import { definition } from './catalog';
import { makeAsset, maxHealth, type GameState, type Asset, type Result } from './model';
import { guidedLayout } from './construction';
export function repairQuote(a: Asset, amount = maxHealth(a) - a.hp): number {
  const d = definition(a.type),
    maximum = maxHealth(a),
    missing = maximum - a.hp;
  if (!a.hp) return Math.min(d.cost, Math.ceil(0.4 * d.cost + 0.05 * a.enhancementPaid));
  const restore = Math.max(0, Math.min(missing, amount));
  return Math.ceil(Math.min(restore / 10240, (0.25 * d.cost * restore) / maximum));
}
export function repair(s: GameState, a: Asset | null, fraction = 1): number {
  const missing = a ? maxHealth(a) - a.hp : 10240000 - s.coreHP;
  const amount = Math.ceil(missing * fraction),
    cost = a ? repairQuote(a, amount) : Math.ceil(amount / 10240);
  if (!missing) return 0;
  if (cost > s.credits) throw new Error(`Repair costs ${cost} Credits`);
  s.credits -= cost;
  if (a) a.hp = !a.hp ? Math.floor(maxHealth(a) / 2) : Math.min(maxHealth(a), a.hp + amount);
  else s.coreHP = Math.min(10240000, s.coreHP + amount);
  return cost;
}
export function rearmQuote(a: Asset): number {
  const d = definition(a.type);
  return d.charges === null
    ? 0
    : Math.ceil((0.25 * d.cost * (d.charges - (a.charges ?? 0))) / d.charges);
}
export function rearm(s: GameState, a: Asset): void {
  const cost = rearmQuote(a);
  if (cost > s.credits) throw new Error(`Rearm costs ${cost} Credits`);
  s.credits -= cost;
  a.charges = definition(a.type).charges;
}
export function enhance(s: GameState, a: Asset): void {
  const d = definition(a.type),
    tier = a.enhancement + 1;
  if (!d.profile || tier > 10 || tier > Math.floor(a.level / 10))
    throw new Error('Enhancement requires ten asset levels per tier');
  const cost = Math.ceil(d.cost * (0.25 + 0.15 * tier));
  if (cost > s.credits) throw new Error(`Enhancement costs ${cost}`);
  const previous = maxHealth(a);
  a.enhancement = tier;
  a.enhancementPaid += cost;
  s.credits -= cost;
  if (a.hp) a.hp += maxHealth(a) - previous;
}
export const PROMOTIONS = [
  { star: 2, rank: 10, credit: 1000, cores: 1 },
  { star: 3, rank: 25, credit: 3000, cores: 3 },
  { star: 4, rank: 45, credit: 8000, cores: 8 },
  { star: 5, rank: 70, credit: 20000, cores: 20 },
  { star: 6, rank: 100, credit: 50000, cores: 50 },
];
export function promote(s: GameState, a: Asset, branch: 'A' | 'B' = 'A'): void {
  const p = PROMOTIONS.find((p) => p.star === a.stars + 1);
  if (!p || !definition(a.type).profile || s.rank < p.rank || a.level < p.rank)
    throw new Error(`Requires both asset level and Bastion Rank ${p?.rank ?? 100}`);
  if (s.credits < p.credit || s.cores < p.cores)
    throw new Error(`Requires ${p.credit} Credits and ${p.cores} Cores`);
  s.credits -= p.credit;
  s.cores -= p.cores;
  a.coresPaid += p.cores;
  const oldMaximum = maxHealth(a);
  a.stars++;
  if (a.stars === 3) a.branch = branch;
  if (a.hp) a.hp += maxHealth(a) - oldMaximum;
}
export function respec(s: GameState, a: Asset): void {
  if (a.stars < 3) throw new Error('No earned branch');
  const cost = Math.ceil(definition(a.type).cost / 2);
  if (s.credits < cost) throw new Error(`Respec costs ${cost}`);
  s.credits -= cost;
  a.branch = a.branch === 'A' ? 'B' : 'A';
}
export function saleQuote(a: Asset): { credits: number; cores: number } {
  const d = definition(a.type);
  return {
    credits: a.refundLocked
      ? 0
      : Math.floor(
          ((0.75 * (a.emergency ? 0 : d.cost) + 0.5 * a.enhancementPaid) * a.hp) / maxHealth(a),
        ),
    cores: a.coresPaid,
  };
}
export function sell(s: GameState, a: Asset): void {
  if (
    definition(a.type).category === 'warden' &&
    (s.assets.filter((a) => definition(a.type).category === 'warden').length === 1 ||
      a.type === s.warden)
  )
    throw new Error('Keep the selected and last owned Warden');
  const q = saleQuote(a);
  s.credits = Math.min(Number.MAX_SAFE_INTEGER, s.credits + q.credits);
  s.cores = Math.min(Number.MAX_SAFE_INTEGER, s.cores + q.cores);
  storeAsset(s, a);
  s.assets = s.assets.filter((v) => v.id !== a.id);
}
export function acquireWarden(s: GameState, type: string): void {
  if (s.assets.some((a) => a.type === type)) throw new Error('Warden already owned');
  const count = s.assets.filter((a) => definition(a.type).category === 'warden').length,
    rank = count === 1 ? 20 : 50,
    cost = count === 1 ? 2000 : 6000;
  if (s.rank < rank || s.credits < cost)
    throw new Error(`Requires Rank ${rank} and ${cost} Credits`);
  const a = makeAsset(type, false);
  s.credits -= cost;
  s.assets.push(a);
}
export function emergency(s: GameState): void {
  if (s.active || s.pending) throw new Error('Finalize or recover the active siege first');
  if (s.credits > 0) throw new Error('Emergency assistance is available when Credits are depleted');
  s.coreHP = Math.max(s.coreHP, 2560000);
  const get = (type: string) => {
    let a = s.assets
      .filter((a) => a.type === type)
      .sort(
        (a, b) => b.level - a.level || b.enhancement - a.enhancement || compareIDs(a.id, b.id),
      )[0];
    if (!a) {
      if (s.assets.length === 1024)
        throw new Error('Inventory full: store/sell an asset before recovery');
      a = makeAsset(type, false);
      a.emergency = true;
      s.assets.push(a);
    }
    a.hp = Math.max(a.hp, Math.floor(maxHealth(a) / 2));
    a.refundLocked = true;
    return a;
  };
  get(s.warden);
  get('friendly.sentry');
  get('friendly.rifle_squad');
  guidedLayout(s);
  s.emergencyEpisode = true;
}
export function priceResult(s: GameState, r: Result): Result {
  if (r.practice)
    return {
      ...r,
      credits: '0',
      xp: '0',
      assetXP: '0',
      cores: '0',
      bonuses: ['Practice: no persistent rewards or discoveries'],
    };
  const plan = r.plan,
    first = plan.stage !== null && !s.stages.includes(plan.stage),
    firstTrial = plan.trial !== null && !s.trials.includes(plan.trial);
  const discovered = r.discovered.filter((id) => !s.discoveries.includes(id));
  const objectives =
    (r.coreHP >= 7680000 ? 1 : 0) +
    (plan.objectives.includes('no_wrecks')
      ? Number(r.wrecks === 0)
      : Number(r.performance.some((p) => p.type === s.warden && p.endingHP > 0)));
  const context: RewardContext = {
    policy: 'economy.duration_wave_v1',
    band: plan.band,
    runStartRank: s.rank,
    difficulty: plan.difficulty,
    modifiers: plan.modifiers.map(
      (m) =>
        (
          ({
            crossfire: 'modifier.crossfire',
            armoured: 'modifier.armored_advance',
            support: 'modifier.support_network',
            elite: 'modifier.elite_patrol',
          }) as const
        )[m],
    ),
    mastery: plan.mastery,
    challengeTier: plan.tier,
    firstCampaignAttempt: first,
  };
  const buckets: RewardBucket[] = r.buckets
    .filter((b) => b.block === plan.block)
    .map((b) => ({
      ...b,
      duration: plan.duration,
      pressure: { n: BigInt(b.pressureFraction.n), d: BigInt(b.pressureFraction.d) },
    }));
  const victory = r.outcome === 'Victory';
  const reward = calculateReward(context, buckets, r.outcome, {
    objectives: Math.min(2, objectives) as 0 | 1 | 2,
    firstExpedition:
      !s.generatedBonusClosed &&
      ['Expedition', 'Boss Siege'].includes(plan.originMode ?? plan.mode) &&
      !s.generatedClaims.includes(plan.hash),
    firstClearXP: first
      ? Math.round(0.5 * (thresholds.rankNext[Math.min(98, plan.requiredRank - 1)] ?? 0))
      : 0,
    discoveryXP: discovered.reduce((n, id) => n + (id.startsWith('boss.') ? 100 : 25), 0),
    bossBonus: plan.boss ? (first ? 2 : 1) : 0,
    milestoneCores: first && (s.stages.length + 1) % 5 === 0 ? 2 : 0,
    fixedCredits: firstTrial ? 2500 : 0,
    fixedCores: firstTrial ? 4 : 0,
  });
  return {
    ...r,
    credits: reward.credits.toString(),
    xp: reward.bastionXP.toString(),
    assetXP: reward.assetXPPool.toString(),
    cores: reward.promotionCores.toString(),
    bonuses: [
      ...(first && victory ? ['Campaign first clear'] : []),
      ...(firstTrial && victory ? ['Mastery first clear'] : []),
      ...discovered.map((id) => `Discovered ${definition(id).name}`),
      `${objectives}/2 objectives met`,
    ],
  };
}
export function claimResult(s: GameState, r: Result): void {
  if (r.practice) return;
  if (r.epoch !== s.epoch) throw new Error('Result belongs to a retired run namespace');
  if (BigInt(r.sequence) <= BigInt(s.finalized) || s.receipts.includes(r.id))
    throw new Error('This result has already been finalized');
  const credits = walletCredit(s.credits, BigInt(r.credits)),
    cores = walletCredit(s.cores, BigInt(r.cores));
  s.credits = credits.balance;
  s.cores = cores.balance;
  r.clipped = (credits.uncredited + cores.uncredited).toString();
  const runStartRank = s.active?.start.rank ?? s.rank;
  const rank = applyRankXP(s.rank, s.rankXP, BigInt(r.xp), BigInt(s.lifetimeXP));
  s.rank = rank.rank;
  s.rankXP = rank.progress;
  s.lifetimeXP = rank.lifetime.toString();
  const participants = r.performance.map((p) => {
    const a = s.assets.find((a) => a.id === p.id)!;
    return {
      id: p.id,
      xp: a.xp,
      level: a.level,
      developing: !!definition(a.type).profile,
      blocks: p.blocks,
      contribution: BigInt(Math.max(0, p.contribution)),
    };
  });
  const allocations = allocateAssetXP(BigInt(r.assetXP), runStartRank, participants);
  r.allocations = allocations.allocations.map((a) => ({
    id: a.id,
    granted: a.granted.toString(),
    level: a.level,
  }));
  r.unusedAssetXP = allocations.unused.toString();
  for (const p of r.performance) {
    const a = s.assets.find((a) => a.id === p.id);
    if (!a) continue;
    const old = maxHealth(a);
    a.hp = Math.min(old, p.endingHP);
    a.charges = p.endingCharges;
    const xp = allocations.allocations.find((v) => v.id === a.id);
    if (xp) {
      a.xp = xp.xp;
      a.level = xp.level;
      if (a.hp) a.hp += maxHealth(a) - old;
    }
  }
  s.coreHP = r.coreHP;
  s.discoveries = [...new Set([...s.discoveries, ...r.discovered])];
  if (r.outcome === 'Victory') {
    if (r.plan.stage !== null && !s.stages.includes(r.plan.stage)) s.stages.push(r.plan.stage);
    if (r.plan.trial !== null && !s.trials.includes(r.plan.trial)) s.trials.push(r.plan.trial);
    if (
      ['Expedition', 'Boss Siege'].includes(r.plan.originMode ?? r.plan.mode) &&
      !s.generatedClaims.includes(r.plan.hash) &&
      s.generatedClaims.length < 4096
    )
      s.generatedClaims.push(r.plan.hash);
    if (s.generatedClaims.length >= 4096) s.generatedBonusClosed = true;
    if (s.emergencyEpisode) {
      s.emergencyEpisode = false;
      for (const a of s.assets) a.refundLocked = false;
    }
  }
  if (r.plan.mode === 'Long Watch') {
    if (s.watch) {
      const w = s.watch;
      w.sorties = Math.min(Number.MAX_SAFE_INTEGER, w.sorties + 1);
      w.cleared = Math.min(Number.MAX_SAFE_INTEGER, w.cleared + Number(r.outcome === 'Victory'));
      w.streak = r.outcome === 'Victory' ? Math.min(Number.MAX_SAFE_INTEGER, w.streak + 1) : 0;
      w.best = Math.max(w.best, w.streak);
      w.lastBoss = r.plan.boss ?? w.lastBoss;
      w.recent = [
        ...w.recent,
        `${r.plan.recipe}|${r.plan.boss ?? ''}|${r.plan.faction}|${r.plan.spawns
          .slice(0, 12)
          .map((s) => s.type)
          .join(',')}`,
      ].slice(-20);
      w.offers = [];
    }
    if (BigInt(s.watchOrdinal) === (1n << 64n) - 1n) {
      s.watchEpoch++;
      s.watchOrdinal = '1';
    } else s.watchOrdinal = (BigInt(s.watchOrdinal) + 1n).toString();
  }
  const add = (key: keyof GameState['totals'], value: number) => {
    s.totals[key] = Math.min(Number.MAX_SAFE_INTEGER, s.totals[key] + value);
  };
  add('sieges', 1);
  add(r.outcome === 'Victory' ? 'victories' : 'defeats', 1);
  add('seconds', Math.floor(r.seconds));
  add(
    'kills',
    Object.values(r.killed).reduce((a, b) => a + b, 0),
  );
  for (const p of r.performance) {
    add('damage', p.damage);
    add('healing', p.healing);
    add('shield', p.shield);
  }
  r.claimed = true;
  s.finalized = r.sequence;
  s.receipts = [...s.receipts, r.id].slice(-16);
  s.history = [r, ...s.history].slice(0, 100);
  if (!s.archive.some((p) => p.hash === r.plan.hash)) {
    const keep = s.archive.filter((p) => s.favorites.includes(p.hash));
    s.archive = (
      keep.length === 32
        ? keep
        : [r.plan, ...keep, ...s.archive.filter((p) => !s.favorites.includes(p.hash))]
    ).slice(0, 32);
  }
  s.pending = null;
  s.active = null;
  // Keep up to 100 detailed records while leaving room for a recovery checkpoint and compact export.
  while (
    s.history.length > 1 &&
    new TextEncoder().encode(JSON.stringify(s)).length > 20 * 1024 * 1024
  )
    s.history.pop();
}

export function storeAsset(s: GameState, a: Asset): void {
  if (a.type === 'friendly.elevated_firing_platform' && a.placement) {
    for (const mounted of s.assets)
      if (
        mounted.placement &&
        definition(mounted.type).category === 'tower' &&
        mounted.placement.x === a.placement.x &&
        mounted.placement.y === a.placement.y
      )
        mounted.placement = null;
  }
  a.placement = null;
}
