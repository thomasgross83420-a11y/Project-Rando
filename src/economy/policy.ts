/** Blueprint §§12,13,25D: exact arithmetic only. No wallet writes or claims.
 * A paid run will require the separately implemented journal/receipt boundary.
 */
export const ECONOMY_POLICY = 'economy.duration_wave_v1';
export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}
const gcd = (a: bigint, b: bigint): bigint => {
  while (b) {
    const c = a % b;
    a = b;
    b = c;
  }
  return a;
};
export function rational(n: bigint, d = 1n): Rational {
  if (n < 0n || d <= 0n) throw new Error('Reward rational domain');
  const g = gcd(n, d);
  return Object.freeze({ n: n / g, d: d / g });
}
export const add = (a: Rational, b: Rational): Rational =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const multiply = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
export const floor = (a: Rational): bigint => a.n / a.d;
export const halfUp = (a: Rational): bigint => (2n * a.n + a.d) / (2n * a.d);
export const pressureProfile = [
  35, 45, 55, 30, 65, 75, 40, 80, 60, 35, 85, 95, 45, 75, 55,
] as const;
/** Endpoint-preserving linear resampling of the pinned authored curve. Exact
 * fractions retain half-step pressures (e.g. 0.475 in the five-point tutorial).
 * This implementation choice is recorded separately from measured balance.
 */
export function resamplePressure(
  count: number,
  order: 'original' | 'reverse' | 'rotate' = 'original',
): Rational[] {
  if (!Number.isSafeInteger(count) || count < 2 || count > 21)
    throw new Error('Pressure sample count');
  const values =
    order === 'reverse'
      ? [...pressureProfile].reverse()
      : order === 'rotate'
        ? [...pressureProfile.slice(5), ...pressureProfile.slice(0, 5)]
        : [...pressureProfile];
  return Array.from({ length: count }, (_, i) => {
    const numerator = i * 14,
      den = count - 1,
      lo = Math.floor(numerator / den),
      remainder = numerator % den;
    const a = values[lo],
      b = values[Math.min(14, lo + 1)];
    if (a === undefined || b === undefined) throw new Error('Missing pressure');
    return rational(BigInt(a * (den - remainder) + b * remainder), BigInt(100 * den));
  });
}
export const difficultyRewards = {
  Cadet: rational(4n, 5n),
  Standard: rational(1n),
  Veteran: rational(5n, 4n),
  Master: rational(8n, 5n),
  Cataclysm: rational(11n, 5n),
};
export const modifierRewards = {
  'modifier.crossfire': rational(11n, 10n),
  'modifier.armored_advance': rational(11n, 10n),
  'modifier.support_network': rational(11n, 10n),
  'modifier.elite_patrol': rational(23n, 20n),
};
export type ModifierID = keyof typeof modifierRewards;
export interface RewardContext {
  policy: typeof ECONOMY_POLICY;
  band: number;
  runStartRank: number;
  difficulty: keyof typeof difficultyRewards;
  modifiers: readonly ModifierID[];
  mastery: boolean;
  challengeTier: number;
  firstCampaignAttempt: boolean;
}
export interface RewardBucket {
  block: number;
  segment: number;
  duration: 90 | 120 | 180 | 240 | 300 | 420;
  pressure: Rational;
  plannedQTP: number;
  destroyedQTP: number;
}
const integer = (x: number, lo: number, hi: number): void => {
  if (!Number.isSafeInteger(x) || x < lo || x > hi) throw new Error('Reward integer out of range');
};
export function rewardFactors(input: RewardContext) {
  if (input.policy !== ECONOMY_POLICY) throw new Error('Unsupported economy policy');
  integer(input.band, 1, 20);
  integer(input.runStartRank, 1, 100);
  integer(input.challengeTier, 0, 8);
  if (input.modifiers.length > 2 || new Set(input.modifiers).size !== input.modifiers.length)
    throw new Error('Select at most two distinct modifiers');
  let modifier = rational(1n);
  for (const id of input.modifiers) {
    if (!Object.hasOwn(modifierRewards, id)) throw new Error('Unknown modifier');
    modifier = multiply(modifier, modifierRewards[id]);
  }
  if (modifier.n * 10n > modifier.d * 13n) modifier = rational(13n, 10n);
  const difficulty = difficultyRewards[input.difficulty];
  if (!difficulty) throw new Error('Unknown difficulty');
  const unlocked = Math.floor((input.runStartRank - 1) / 5) + 1;
  const repeat =
    input.firstCampaignAttempt || input.band + 2 >= unlocked
      ? rational(1n)
      : rational(BigInt(input.band + 2), BigInt(unlocked));
  return {
    difficulty,
    modifier,
    profile: input.mastery ? rational(6n, 5n) : rational(1n),
    repeat,
    band: rational(BigInt(39 + input.band), 40n),
    challenge: rational(BigInt(20 + input.challengeTier), 20n),
  };
}
export function originWeight(bucket: RewardBucket): Rational {
  integer(bucket.block, 1, 6);
  if (bucket.block > 1 && bucket.duration !== 300)
    throw new Error('Endurance blocks last 300 seconds');
  if (![90, 120, 180, 240, 300, 420].includes(bucket.duration))
    throw new Error('Unsupported duration');
  integer(bucket.segment, 1, Math.ceil(bucket.duration / 20));
  const p = bucket.pressure;
  if (typeof p.n !== 'bigint' || typeof p.d !== 'bigint' || p.d <= 0n || p.n < 0n || p.n > p.d)
    throw new Error('Pressure must be an exact rational from 0 to 1');
  integer(bucket.plannedQTP, 0, Number.MAX_SAFE_INTEGER);
  integer(bucket.destroyedQTP, 0, bucket.plannedQTP);
  const progress = 300 * (bucket.block - 1) + Math.min(20 * bucket.segment, bucket.duration);
  const duration = rational(BigInt(2000 + Math.min(progress, 1800)), 2500n),
    pressure = add(rational(1n), multiply(bucket.pressure, rational(1n, 10n)));
  return multiply(duration, pressure);
}
export interface RewardAdditions {
  objectives: 0 | 1 | 2;
  firstExpedition: boolean;
  firstClearXP: number;
  discoveryXP: number;
  bossBonus: 0 | 1 | 2;
  milestoneCores: number;
  fixedCredits: number;
  fixedCores: number;
}
export const noAdditions: RewardAdditions = {
  objectives: 0,
  firstExpedition: false,
  firstClearXP: 0,
  discoveryXP: 0,
  bossBonus: 0,
  milestoneCores: 0,
  fixedCredits: 0,
  fixedCores: 0,
};
/** One ordinary encounter OR one Endurance block entitlement; never aggregate
 * different blocks before flooring. Kill time/promised future blocks are absent.
 */
export function calculateReward(
  context: RewardContext,
  buckets: readonly RewardBucket[],
  outcome: 'Victory' | 'Defeat',
  additions: RewardAdditions = noAdditions,
) {
  const f = rewardFactors(context),
    seen = new Set<string>();
  let qTP = 0n,
    weighted = rational(0n),
    block = 0;
  if (buckets.length > 21) throw new Error('Reward bucket bound');
  for (const b of buckets) {
    const key = `${b.block}.${b.segment}`;
    if (seen.has(key)) throw new Error('Duplicate reward origin');
    seen.add(key);
    if (block && block !== b.block)
      throw new Error('Calculate each Endurance block entitlement separately');
    block = b.block;
    if (b.block > 1 && b.duration !== 300) throw new Error('Endurance blocks last 300 seconds');
    const weight = originWeight(b);
    qTP += BigInt(b.destroyedQTP);
    weighted = add(weighted, multiply(rational(BigInt(b.destroyedQTP), 4n), weight));
  }
  integer(additions.objectives, 0, 2);
  integer(additions.bossBonus, 0, 2);
  for (const x of [
    additions.firstClearXP,
    additions.discoveryXP,
    additions.milestoneCores,
    additions.fixedCredits,
    additions.fixedCores,
  ])
    integer(x, 0, Number.MAX_SAFE_INTEGER);
  const victory = outcome === 'Victory';
  if (!victory && outcome !== 'Defeat') throw new Error('Reward needs a terminal outcome');
  const scale = [f.difficulty, f.modifier, f.profile, f.repeat].reduce(multiply, rational(1n));
  const threat = rational(qTP, 4n),
    killCredits = multiply(multiply(multiply(rational(4n), f.band), f.challenge), weighted);
  const completion = rational(victory ? BigInt(200 + 30 * context.band) : 0n);
  const ordinaryCredits = multiply(add(completion, killCredits), scale);
  const g = rational(BigInt(5 + context.band - 1), 5n);
  const ordinaryXP = multiply(
    multiply(
      add(rational(victory ? BigInt(50 + 15 * context.band) : 0n), multiply(rational(3n), threat)),
      g,
    ),
    scale,
  );
  const xpPercent = rational(
    BigInt(100 + (victory ? 10 * additions.objectives + (additions.firstExpedition ? 25 : 0) : 0)),
    100n,
  );
  const xp =
    halfUp(multiply(ordinaryXP, xpPercent)) +
    BigInt(additions.discoveryXP) +
    (victory ? BigInt(additions.firstClearXP) : 0n);
  const pool = multiply(
    multiply(
      multiply(
        add(rational(victory ? 80n : 0n), multiply(rational(4n), threat)),
        rational(BigInt(4 + context.band - 1), 4n),
      ),
      scale,
    ),
    victory ? rational(1n) : rational(1n, 4n),
  );
  const coreBase =
    1 + Math.floor((context.band - 1) / 5) + additions.bossBonus + (context.mastery ? 1 : 0);
  let cores = victory
    ? floor(multiply(multiply(rational(BigInt(coreBase)), f.difficulty), f.repeat))
    : 0n;
  if (victory && f.repeat.n === f.repeat.d && cores < 1n) cores = 1n;
  if (victory) cores += BigInt(additions.milestoneCores) + BigInt(additions.fixedCores);
  return {
    policy: ECONOMY_POLICY,
    unweightedTP: threat,
    weightedThreat: weighted,
    killCredits: multiply(killCredits, scale),
    completionCredits: multiply(completion, scale),
    ordinaryCredits,
    credits: floor(ordinaryCredits) + (victory ? BigInt(additions.fixedCredits) : 0n),
    bastionXP: xp,
    assetXPPool: halfUp(pool),
    promotionCores: cores,
    factors: f,
  };
}
export function walletCredit(
  balance: number,
  reward: bigint,
): { balance: number; credited: bigint; uncredited: bigint } {
  integer(balance, 0, Number.MAX_SAFE_INTEGER);
  if (reward < 0n) throw new Error('Negative reward');
  const headroom = BigInt(Number.MAX_SAFE_INTEGER) - BigInt(balance),
    credited = reward > headroom ? headroom : reward;
  return { balance: balance + Number(credited), credited, uncredited: reward - credited };
}
