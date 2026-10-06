import { z } from 'zod';

// Baselines: blueprint §§7–9, 13, 25, 30. These are real starter identities,
// not substitutes for the remainder of the mandatory roster.
export const starterIDs = [
  'friendly.sentry',
  'friendly.rifle_squad',
  'friendly.combat_engineers',
  'friendly.standard_barricade',
  'friendly.proximity_mine',
  'friendly.slow_field',
  'friendly.repair_node',
  'warden.bulwark',
  'warden.ranger',
  'warden.conductor',
] as const;
export const contentID = z.enum(starterIDs);
export type ContentID = z.infer<typeof contentID>;
export interface Definition {
  name: string;
  width: number;
  height: number;
  cost: number;
  capacity: number;
  hp: number;
  armor: number;
  solid: boolean;
  developing: boolean;
  rank: number;
  weapon?: {
    damage: number;
    intervalTicks: number;
    rangeGU: number;
    targets: 'both' | 'ground' | 'air';
  };
  category: 'tower' | 'mobile' | 'barrier' | 'trap' | 'support' | 'warden';
}
export const foundation: Record<ContentID, Definition> = {
  'friendly.sentry': {
    name: 'Sentry',
    weapon: { damage: 40, intervalTicks: 48, rangeGU: 8, targets: 'both' },
    width: 2,
    height: 2,
    cost: 250,
    capacity: 2,
    hp: 1200,
    armor: 15,
    solid: true,
    developing: true,
    rank: 1,
    category: 'tower',
  },
  'friendly.rifle_squad': {
    name: 'Rifle Squad',
    width: 2,
    height: 2,
    cost: 300,
    capacity: 3,
    hp: 900,
    armor: 10,
    solid: false,
    developing: true,
    rank: 1,
    category: 'mobile',
  },
  'friendly.combat_engineers': {
    name: 'Combat Engineers',
    width: 2,
    height: 2,
    cost: 450,
    capacity: 3,
    hp: 800,
    armor: 5,
    solid: false,
    developing: true,
    rank: 1,
    category: 'mobile',
  },
  'friendly.standard_barricade': {
    name: 'Standard Barricade',
    width: 1,
    height: 1,
    cost: 60,
    capacity: 0,
    hp: 1500,
    armor: 20,
    solid: true,
    developing: false,
    rank: 1,
    category: 'barrier',
  },
  'friendly.proximity_mine': {
    name: 'Proximity Mine',
    width: 1,
    height: 1,
    cost: 75,
    capacity: 0,
    hp: 200,
    armor: 0,
    solid: false,
    developing: false,
    rank: 1,
    category: 'trap',
  },
  'friendly.slow_field': {
    name: 'Slow Field',
    width: 1,
    height: 1,
    cost: 120,
    capacity: 0,
    hp: 200,
    armor: 0,
    solid: false,
    developing: false,
    rank: 3,
    category: 'trap',
  },
  'friendly.repair_node': {
    name: 'Repair Node',
    width: 2,
    height: 2,
    cost: 350,
    capacity: 2,
    hp: 800,
    armor: 5,
    solid: true,
    developing: true,
    rank: 2,
    category: 'support',
  },
  'warden.bulwark': {
    name: 'Bulwark',
    width: 2,
    height: 2,
    cost: 0,
    capacity: 0,
    hp: 2500,
    armor: 35,
    solid: false,
    developing: true,
    rank: 1,
    category: 'warden',
  },
  'warden.ranger': {
    name: 'Ranger',
    width: 2,
    height: 2,
    cost: 0,
    capacity: 0,
    hp: 1700,
    armor: 15,
    solid: false,
    developing: true,
    rank: 1,
    category: 'warden',
  },
  'warden.conductor': {
    name: 'Conductor',
    width: 2,
    height: 2,
    cost: 0,
    capacity: 0,
    hp: 1900,
    armor: 20,
    solid: false,
    developing: true,
    rank: 1,
    category: 'warden',
  },
};
export const doctrines = {
  Bastion: [
    ['friendly.sentry', 2],
    ['friendly.rifle_squad', 1],
    ['friendly.standard_barricade', 6],
    ['friendly.proximity_mine', 2],
    ['friendly.repair_node', 1],
  ],
  Mobile: [
    ['friendly.sentry', 1],
    ['friendly.rifle_squad', 2],
    ['friendly.combat_engineers', 1],
    ['friendly.standard_barricade', 4],
    ['friendly.proximity_mine', 2],
  ],
  Chokepoint: [
    ['friendly.sentry', 1],
    ['friendly.rifle_squad', 1],
    ['friendly.standard_barricade', 8],
    ['friendly.slow_field', 2],
    ['friendly.proximity_mine', 2],
    ['friendly.repair_node', 1],
  ],
} as const satisfies Record<string, readonly (readonly [ContentID, number])[]>;
export const constructionTypes: readonly ContentID[] = [
  'friendly.sentry',
  'friendly.standard_barricade',
];

const definitionSchema = z
  .object({
    name: z.string().min(1),
    width: z.number().int().min(1).max(3),
    height: z.number().int().min(1).max(3),
    cost: z.number().int().nonnegative(),
    capacity: z.number().int().nonnegative(),
    hp: z.number().int().positive(),
    armor: z.number().int().nonnegative(),
    solid: z.boolean(),
    developing: z.boolean(),
    rank: z.number().int().min(1).max(100),
    weapon: z
      .object({
        damage: z.number().positive(),
        intervalTicks: z.number().int().positive(),
        rangeGU: z.number().positive(),
        targets: z.enum(['both', 'ground', 'air']),
      })
      .strict()
      .optional(),
    category: z.enum(['tower', 'mobile', 'barrier', 'trap', 'support', 'warden']),
  })
  .strict();
for (const id of starterIDs) definitionSchema.parse(foundation[id]);
export function requireDefinition(id: string): Definition {
  const parsed = contentID.parse(id);
  return foundation[parsed];
}

export const coreBaseline = { hp: 10000, armor: 20 } as const;
