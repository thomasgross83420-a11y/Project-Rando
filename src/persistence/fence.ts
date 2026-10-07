import { z } from 'zod';
const sequence = z.string().regex(/^(0|[1-9][0-9]{0,19})$/);
const unique = <T extends z.ZodType>(type: T, max: number) =>
  z
    .array(type)
    .max(max)
    .refine((a) => new Set(a).size === a.length, 'Duplicate claim');
export const fenceSchema = z
  .object({
    schema: z.literal(1),
    lineage: z.uuid().transform((id) => id.toLowerCase()),
    allocated: sequence,
    finalized: sequence,
    campaign: unique(z.string().regex(/^C0[1-8]S0[1-5]$/), 40),
    mastery: unique(z.string().regex(/^MT(?:0[1-9]|1[0-2])$/), 12),
    roles: unique(
      z.enum([
        'enemy.runner',
        'enemy.raider',
        'enemy.bulwark',
        'enemy.lancer',
        'enemy.bombard',
        'enemy.skimmer',
        'enemy.veil',
        'enemy.mole',
        'enemy.sapper',
        'enemy.jammer',
        'enemy.mender',
        'enemy.herald',
        'enemy.drainer',
        'enemy.carrier',
        'enemy.breaker',
        'enemy.harvester',
      ]),
      16,
    ),
    bosses: unique(
      z.enum([
        'boss.prism_sovereign',
        'boss.choir_dreadnought',
        'boss.silent_crown',
        'boss.gorger_titan',
        'boss.shatterstorm',
        'boss.marshal',
        'boss.black_conductor',
        'boss.root_below',
      ]),
      8,
    ),
    milestones: unique(z.number().int().min(1).max(8), 8),
    generated: unique(z.string().regex(/^[a-f0-9]{64}$/), 4096),
  })
  .strict()
  .refine(
    (f) => BigInt(f.finalized) <= BigInt(f.allocated),
    'Finalized sequence exceeds allocated',
  );
export type ProgressFence = z.infer<typeof fenceSchema>;
export function emptyFence(lineage: string): ProgressFence {
  return fenceSchema.parse({
    schema: 1,
    lineage,
    allocated: '0',
    finalized: '0',
    campaign: [],
    mastery: [],
    roles: [],
    bosses: [],
    milestones: [],
    generated: [],
  });
}
export function mergeFences(a: ProgressFence, b: ProgressFence): ProgressFence {
  if (a.lineage !== b.lineage) throw new Error('Cannot merge fences of different campaigns');
  const max = (x: string, y: string) => (BigInt(x) > BigInt(y) ? x : y);
  const union = <T extends string | number>(x: T[], y: T[]) =>
    [...new Set([...x, ...y])].sort((p, q) =>
      typeof p === 'number' && typeof q === 'number'
        ? p - q
        : String(p) < String(q)
          ? -1
          : String(p) > String(q)
            ? 1
            : 0,
    );
  return fenceSchema.parse({
    ...a,
    allocated: max(a.allocated, b.allocated),
    finalized: max(a.finalized, b.finalized),
    campaign: union(a.campaign, b.campaign),
    mastery: union(a.mastery, b.mastery),
    roles: union(a.roles, b.roles),
    bosses: union(a.bosses, b.bosses),
    milestones: union(a.milestones, b.milestones),
    generated: union(a.generated, b.generated),
  });
}
