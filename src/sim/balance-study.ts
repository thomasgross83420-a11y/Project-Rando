/** Development-only fixture input. Never a tutorial checkpoint/paid run plan. */
import { z } from 'zod';
import { combat, type ActorDefinition } from '../data/combat';
import { type StartAsset, startSchema } from './tutorial';
import { captureProfile, bandDefinition, type CapturedProfile } from '../progression/profile';
import { levelUpBody } from '../progression/allocation';
export const studySchema = z
  .object({
    schema: z.literal(1),
    seed: z.string().min(1).max(128),
    band: z.number().int().min(1).max(20),
    accuracyGrowth: z.boolean(),
    assets: z
      .array(
        z
          .object({
            uuid: z.uuid().transform((s) => s.toLowerCase()),
            level: z.number().int().min(1).max(100),
            enhancement: z.number().int().min(0).max(10),
          })
          .strict(),
      )
      .max(120),
  })
  .strict();
export type StudyInput = z.infer<typeof studySchema>;
export interface ShotObservation {
  sequence: number;
  source: number;
  target: number;
  accuracyPassed: boolean;
  resolution: 'in-flight' | 'intended' | 'other-hostile' | 'friendly-solid' | 'expired';
}
export interface CapturedStudy {
  readonly kind: 'development-balance-study';
  readonly input: StudyInput;
  readonly army: readonly StartAsset[];
  readonly profiles: Readonly<Record<number, CapturedProfile>>;
  readonly enemies: Readonly<Record<'enemy.runner' | 'enemy.raider', ActorDefinition>>;
}
export function captureStudy(army: StartAsset[], input: StudyInput): CapturedStudy {
  if (army.length > 120) throw new Error('Study friendly population cap');
  const parsed = studySchema.parse(input),
    sorted = army
      .map((a) => startSchema.parse(a))
      .sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));
  if (
    new Set(sorted.map((a) => a.uuid)).size !== sorted.length ||
    new Set(parsed.assets.map((a) => a.uuid)).size !== parsed.assets.length ||
    parsed.assets.some((a) => !sorted.some((s) => s.uuid === a.uuid))
  )
    throw new Error('Study asset identity mismatch');
  const profiles: Record<number, CapturedProfile> = {};
  for (const [i, a] of sorted.entries()) {
    const p = parsed.assets.find((p) => p.uuid === a.uuid),
      profile = captureProfile(a.type, p?.level ?? 1, p?.enhancement ?? 0);
    if (a.hp > combat[a.type].hp) throw new Error('Study input durability exceeds baseline');
    profiles[i + 2] = profile;
    a.hp = levelUpBody(a.hp, combat[a.type].hp, profile.definition.hp);
    Object.freeze(a);
  }
  parsed.assets.sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));
  parsed.assets.forEach(Object.freeze);
  Object.freeze(parsed.assets);
  Object.freeze(parsed);
  return Object.freeze({
    kind: 'development-balance-study',
    input: parsed,
    army: Object.freeze(sorted),
    profiles: Object.freeze(profiles),
    enemies: Object.freeze({
      'enemy.runner': bandDefinition('enemy.runner', parsed.band),
      'enemy.raider': bandDefinition('enemy.raider', parsed.band),
    }),
  });
}
