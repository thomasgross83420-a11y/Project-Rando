import { z } from 'zod';
import { foundation, coreBaseline } from './foundation';
const weaponSchema = z
  .object({
    damage: z.number().int().positive(),
    interval: z.number().int().positive(),
    range: z.number().int().positive(),
    speed: z.number().int().nonnegative(),
    accuracy: z.number().int().min(0).max(100),
    warmup: z.literal(6),
    turn: z.number().int().positive(),
  })
  .strict();
const actorSchema = z
  .object({
    name: z.string(),
    hp: z.number().int().positive(),
    armor: z.number().int().nonnegative(),
    radius: z.number().int().nonnegative(),
    speed: z.number().int().nonnegative(),
    vision: z.number().int().nonnegative(),
    mechanical: z.boolean(),
    solid: z.boolean(),
    weapon: weaponSchema.nullable(),
  })
  .strict();
export const combatIDs = [
  'objective.harmonic_core',
  'friendly.sentry',
  'friendly.rifle_squad',
  'friendly.repair_node',
  'friendly.standard_barricade',
  'friendly.proximity_mine',
  'warden.bulwark',
  'enemy.runner',
  'enemy.raider',
] as const;
export const combatID = z.enum(combatIDs);
export type CombatID = z.infer<typeof combatID>;
export type ActorDefinition = z.infer<typeof actorSchema>;
const weapon = (
  damage: number,
  interval: number,
  range: number,
  speed: number,
  accuracy: number,
  turn: number,
) => ({
  damage: damage * 1024,
  interval,
  range: Math.round(range * 1024),
  speed: speed * 1024,
  accuracy,
  warmup: 6 as const,
  turn,
});
const friendly = (
  id: keyof typeof foundation,
  radius: number,
  speed: number,
  vision: number,
  mechanical: boolean,
  armament: ReturnType<typeof weapon> | null,
): ActorDefinition => {
  const d = foundation[id];
  return {
    name: d.name,
    hp: d.hp * 1024,
    armor: d.armor,
    radius,
    speed: Math.round(speed * 1024),
    vision: vision * 1024,
    mechanical,
    solid: d.solid,
    weapon: armament,
  };
};
const sentryWeapon = foundation['friendly.sentry'].weapon;
if (!sentryWeapon) throw new Error('Missing Sentry baseline weapon');
export const combat: Record<CombatID, ActorDefinition> = {
  'objective.harmonic_core': {
    name: 'Harmonic Core',
    hp: coreBaseline.hp * 1024,
    armor: coreBaseline.armor,
    radius: 0,
    speed: 0,
    vision: 6 * 1024,
    mechanical: true,
    solid: true,
    weapon: null,
  },
  'friendly.sentry': friendly(
    'friendly.sentry',
    0,
    0,
    8,
    true,
    weapon(sentryWeapon.damage, sentryWeapon.intervalTicks, sentryWeapon.rangeGU, 24, 90, 180),
  ),
  'friendly.rifle_squad': friendly(
    'friendly.rifle_squad',
    358,
    2.2,
    10,
    false,
    weapon(27, 36, 6, 22, 85, 360),
  ),
  'friendly.repair_node': friendly('friendly.repair_node', 0, 0, 6, true, null),
  'friendly.standard_barricade': friendly('friendly.standard_barricade', 0, 0, 6, true, null),
  'friendly.proximity_mine': friendly('friendly.proximity_mine', 0, 0, 6, true, null),
  'warden.bulwark': friendly('warden.bulwark', 461, 2, 12, false, weapon(60, 36, 7, 24, 90, 360)),
  'enemy.runner': {
    name: 'Runner',
    hp: 100 * 1024,
    armor: 0,
    radius: 358,
    speed: 3 * 1024,
    vision: 10 * 1024,
    mechanical: false,
    solid: false,
    weapon: weapon(20, 48, 0.8, 0, 100, 360),
  },
  'enemy.raider': {
    name: 'Raider',
    hp: 250 * 1024,
    armor: 10,
    radius: 358,
    speed: 2253,
    vision: 10 * 1024,
    mechanical: false,
    solid: false,
    weapon: weapon(35, 60, 0.8, 0, 100, 360),
  },
};
for (const id of combatIDs) actorSchema.parse(combat[id]);
export const tuning = {
  ticks: 60,
  projectileCap: 300,
  hostileCap: 120,
  allyCap: 120,
  friendlyDecision: 15,
  enemyDecision: 21,
  perception: 15,
  memory: 120,
  commitment: 60,
  hysteresis: 10000,
  aimTolerance: 1456,
  heldVictory: 60,
  inevitable: 180,
  stalemate: 5400,
  movementOffsets: [0, 2731, -2731, 5461, -5461, 10923, -10923, 16384, -16384, 32768],
  interposeCD: 1080,
  challengeCD: 960,
  holdfastCD: 1440,
} as const;
