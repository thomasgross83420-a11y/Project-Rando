import { z } from 'zod';
import { combatID } from '../data/combat';
import { hash } from './determinism';
const events = [
  ...[10, 13, 16, 19, 22, 25, 50, 53, 56, 59, 62, 65, 75, 77, 79, 81, 83, 85].map((s) => ({
    s,
    type: 'enemy.runner' as const,
    tp: 1 as const,
  })),
  ...[30, 35, 40, 70, 74, 78].map((s) => ({ s, type: 'enemy.raider' as const, tp: 2 as const })),
].sort((a, b) => a.s - b.s);
const authoredPackets = events.map((p, i) => ({
  id: i + 1,
  tick: p.s * 60,
  entrance: 1 as const,
  type: p.type,
  tp: p.tp,
}));
export const packetSchema = z
  .object({
    id: z.number().int().min(1),
    tick: z.number().int().min(0),
    entrance: z.literal(1),
    type: z.enum(['enemy.runner', 'enemy.raider']),
    tp: z.union([z.literal(1), z.literal(2)]),
  })
  .strict();
export const tutorialSchema = z
  .object({
    schema: z.literal(1),
    mode: z.literal('tutorial-practice'),
    seed: z.literal('rb-tutorial-v1'),
    simulation: z.literal('rb-sim-v1'),
    content: z.literal('rb-content-v1'),
    economyPolicy: z.literal('economy.duration_wave_v1'),
    difficulty: z.literal('Standard'),
    duration: z.literal(5400),
    warningTick: z.literal(3900),
    tp: z.literal(30),
    packets: z
      .array(packetSchema)
      .length(24)
      .refine(
        (p) => JSON.stringify(p) === JSON.stringify(authoredPackets),
        'Authored tutorial schedule must match exactly',
      ),
  })
  .strict();
export type TutorialPlan = z.infer<typeof tutorialSchema>;
export function tutorialPlan(): TutorialPlan {
  return tutorialSchema.parse({
    schema: 1,
    mode: 'tutorial-practice',
    seed: 'rb-tutorial-v1',
    simulation: 'rb-sim-v1',
    content: 'rb-content-v1',
    economyPolicy: 'economy.duration_wave_v1',
    difficulty: 'Standard',
    duration: 5400,
    warningTick: 3900,
    tp: 30,
    packets: authoredPackets,
  });
}
export const startSchema = z
  .object({
    uuid: z.uuid().transform((s) => s.toLowerCase()),
    heading: z.number().int().min(0).max(65535),
    type: combatID,
    x: z.number().int().min(0).max(59),
    y: z.number().int().min(0).max(59),
    width: z.number().int().min(1).max(4),
    height: z.number().int().min(1).max(4),
    hp: z.number().int().positive(),
  })
  .strict();
export type StartAsset = z.infer<typeof startSchema>;
export async function planIdentity(plan: TutorialPlan, army: StartAsset[]): Promise<string> {
  return hash({
    plan: tutorialSchema.parse(plan),
    army: army
      .map((a) => startSchema.parse(a))
      .sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0)),
  });
}
