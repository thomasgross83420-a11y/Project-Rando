/** Blueprint §27A shared growth. No automatic armor curve,
 * automatic purchases, perk applicability or runtime stat mutation.
 */
import { add, halfUp, multiply, rational, type Rational } from '../economy/policy';
const checked = (v: number, lo: number, hi: number) => {
  if (!Number.isSafeInteger(v) || v < lo || v > hi) throw new Error('Growth integer domain');
};
export function growthFactors(level: number, enhancement: number) {
  checked(level, 1, 100);
  checked(enhancement, 0, Math.floor(level / 10));
  const t = rational(BigInt(level - 1), 99n),
    e = rational(BigInt(100 + 3 * enhancement), 100n);
  return {
    health: multiply(add(rational(1n), multiply(rational(7n, 10n), t)), e),
    output: multiply(add(rational(1n), multiply(rational(3n, 5n), t)), e),
    range: add(rational(1n), multiply(rational(3n, 20n), t)),
    attackRate: add(rational(1n), multiply(rational(1n, 4n), t)),
  };
}
export function scaleFixed(base: number, factor: Rational): number {
  checked(base, 0, Number.MAX_SAFE_INTEGER);
  const result = halfUp(multiply(rational(BigInt(base)), factor));
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Growth exceeds safe fixed-point domain');
  return Number(result);
}
/** Nominal seconds are kept exact until the single final tick conversion.
 * Beam pulse and healing/repair cadence never receive this acceleration.
 */
export function ordinaryIntervalTicks(
  nominalSeconds: Rational,
  level: number,
  kind: 'attack' | 'beam' | 'support' = 'attack',
): number {
  if (!['attack', 'beam', 'support'].includes(kind)) throw new Error('Unknown interval kind');
  const factors = growthFactors(level, 0);
  if (nominalSeconds.n <= 0n || nominalSeconds.d <= 0n)
    throw new Error('Positive interval required');
  const seconds =
    kind === 'attack'
      ? multiply(nominalSeconds, rational(factors.attackRate.d, factors.attackRate.n))
      : nominalSeconds;
  const ticks = halfUp(multiply(seconds, rational(60n)));
  if (ticks > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Interval exceeds safe tick domain');
  return Math.max(1, Number(ticks));
}
/** Caller must use the content's exhaustive applicability tags. Percentage
 * strength, move speed, footprint, cooldowns and flat signatures do not grow.
 */
export function grownRange(
  base: number,
  level: number,
  enhancement: number,
  auraOnlyEnhancement = false,
): number {
  const factors = growthFactors(level, enhancement);
  checked(base, 0, Number.MAX_SAFE_INTEGER);
  const addition = auraOnlyEnhancement ? rational(BigInt(enhancement * 1024), 20n) : rational(0n);
  const result = halfUp(add(multiply(rational(BigInt(base)), factors.range), addition));
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Range exceeds safe fixed-point domain');
  return Number(result);
}
