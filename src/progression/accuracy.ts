import { add, rational, type Rational } from '../economy/policy';

/** Engineering clarification authorized 2026-10-07. Level 100 halves the
 * baseline miss probability; exact level interpolation retains role ordering.
 * Enhancements, injury, stars and support buffs are separate rule owners.
 * See docs/PROGRESSION_BALANCE.md; this is initial tuning, not final acceptance.
 */
export const ACCURACY_POLICY = 'accuracy.half-miss-v1';
export function grownAccuracy(basePercent: number, level: number): Rational {
  if (!Number.isSafeInteger(basePercent) || basePercent < 0 || basePercent > 100)
    throw new Error('Accuracy percent domain');
  if (!Number.isSafeInteger(level) || level < 1 || level > 100)
    throw new Error('Accuracy level domain');
  return add(
    rational(BigInt(basePercent), 100n),
    rational(BigInt((100 - basePercent) * (level - 1)), 19800n),
  );
}
/** Add explicit percentage-point buffs after growth and cap once at 1. */
export function buffAccuracy(base: Rational, bonus: Rational): Rational {
  if (base.n < 0n || base.d <= 0n || base.n > base.d || bonus.n < 0n || bonus.d <= 0n)
    throw new Error('Accuracy probability domain');
  const p = add(base, bonus);
  return p.n > p.d ? rational(1n) : p;
}
/** Uniform uint32 decision with no percent rounding or modulo bias. Does not
 * consume a stream: the simulation owns its fixed three-draw release schedule.
 */
export function accuracyPass(roll: number, probability: Rational): boolean {
  if (!Number.isSafeInteger(roll) || roll < 0 || roll > 0xffffffff)
    throw new Error('Accuracy roll domain');
  if (probability.n < 0n || probability.d <= 0n || probability.n > probability.d)
    throw new Error('Accuracy probability domain');
  return BigInt(roll) * probability.d < probability.n * 4294967296n;
}
