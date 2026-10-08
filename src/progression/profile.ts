import { combat, type CombatID, type ActorDefinition } from '../data/combat';
import { rational } from '../economy/policy';
import { ACCURACY_POLICY, grownAccuracy } from './accuracy';
import { growthFactors, grownRange, ordinaryIntervalTicks, scaleFixed } from './growth';

export const PROFILE_POLICY = 'progression.current-slice-v1';
export const developingSlice = [
  'friendly.sentry',
  'friendly.rifle_squad',
  'friendly.repair_node',
  'warden.bulwark',
] as const;
export interface CapturedProfile {
  readonly policy: typeof PROFILE_POLICY;
  readonly accuracyPolicy: typeof ACCURACY_POLICY;
  readonly type: CombatID;
  readonly level: number;
  readonly enhancement: number;
  readonly definition: ActorDefinition;
  /** Authoritative grown probability. definition.weapon.accuracy retains the
   * baseline percent solely for legacy compatibility and study ablation. */
  readonly accuracy: { readonly numerator: number; readonly denominator: number } | null;
  readonly repair: {
    readonly perPulse: number;
    readonly corePerPulse: number;
    readonly range: number;
  } | null;
  readonly interposePool: number;
}
/** Captures only implemented fields. No inferred armor growth, free upgrades,
 * promotions, movement growth, or unsupported roster/stat definitions.
 * JSON-safe fractions retain every level's sub-percent accuracy gain.
 */
export function captureProfile(
  type: CombatID,
  level: number,
  enhancement: number,
): CapturedProfile {
  const f = growthFactors(level, enhancement);
  if (!(developingSlice as readonly string[]).includes(type) && (level !== 1 || enhancement !== 0))
    throw new Error('Type does not develop in the current slice');
  const definition = structuredClone(combat[type]);
  definition.hp = scaleFixed(definition.hp, f.health);
  let accuracy: CapturedProfile['accuracy'] = null;
  if (definition.weapon) {
    const w = definition.weapon,
      p = grownAccuracy(w.accuracy, level);
    w.damage = scaleFixed(w.damage, f.output);
    w.range = grownRange(w.range, level, enhancement);
    w.interval = ordinaryIntervalTicks(rational(BigInt(w.interval), 60n), level);
    accuracy = Object.freeze({ numerator: Number(p.n), denominator: Number(p.d) });
    Object.freeze(w);
  }
  return Object.freeze({
    policy: PROFILE_POLICY,
    accuracyPolicy: ACCURACY_POLICY,
    type,
    level,
    enhancement,
    definition: Object.freeze(definition),
    accuracy,
    repair:
      type === 'friendly.repair_node'
        ? Object.freeze({
            perPulse: scaleFixed(6400, f.output),
            corePerPulse: scaleFixed(3200, f.output),
            range: grownRange(5 * 1024, level, enhancement),
          })
        : null,
    interposePool: type === 'warden.bulwark' ? scaleFixed(600 * 1024, f.output) : 0,
  });
}
/** Blueprint §13 band growth only; difficulty budgets are separate. */
export function bandDefinition(
  type: 'enemy.runner' | 'enemy.raider',
  band: number,
): ActorDefinition {
  if (!Number.isSafeInteger(band) || band < 1 || band > 20) throw new Error('Enemy band domain');
  const d = structuredClone(combat[type]);
  d.hp = scaleFixed(d.hp, rational(BigInt(1000 + 35 * (band - 1)), 1000n));
  d.armor += Math.min(15, band - 1);
  if (d.weapon) {
    d.weapon.damage = scaleFixed(d.weapon.damage, rational(BigInt(1000 + 25 * (band - 1)), 1000n));
    Object.freeze(d.weapon);
  }
  return Object.freeze(d);
}
