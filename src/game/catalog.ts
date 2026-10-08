/** Full first-pass content. Baselines trace to blueprint §§7–11,30.
 * A catalog entry is never itself a claim that its action is implemented. */
export type Category =
  | 'tower'
  | 'mobile'
  | 'support'
  | 'infrastructure'
  | 'trap'
  | 'route'
  | 'warden'
  | 'enemy'
  | 'boss';
export type Profile = 'Precision' | 'Suppression' | 'Siege' | 'Protection' | 'Recovery' | 'Utility';
export type Layer = 'ground' | 'air';
export type Weapon = 'bullet' | 'shell' | 'arc' | 'beam' | 'melee' | 'mortar' | 'guided' | 'none';
export interface Definition {
  id: string;
  name: string;
  category: Category;
  rank: number;
  cost: number;
  capacity: number;
  width: number;
  height: number;
  health: number;
  armor: number;
  speed: number;
  damage: number;
  interval: number;
  range: number;
  minimum: number;
  layer: Layer;
  targets: 'ground' | 'air' | 'both';
  weapon: Weapon;
  velocity: number;
  accuracy: number;
  radius: number;
  area: number;
  penetration: number;
  profile: Profile | null;
  biological: boolean;
  charges: number | null;
  threat: number;
  color: number;
  description: string;
}
const entries: Definition[] = [];
function add(
  id: string,
  name: string,
  category: Category,
  rank: number,
  cost: number,
  capacity: number,
  width: number,
  height: number,
  health: number,
  armor: number,
  damage = 0,
  interval = 1,
  range = 0,
  weapon: Weapon = 'none',
  extra: Partial<Definition> = {},
) {
  const profile: Profile | null =
    category === 'support' || category === 'infrastructure' ? 'Utility' : null;
  entries.push({
    id,
    name,
    category,
    rank,
    cost,
    capacity,
    width,
    height,
    health,
    armor,
    damage,
    interval,
    range,
    weapon,
    speed: 0,
    minimum: 0,
    layer: 'ground',
    targets: 'ground',
    velocity: 24,
    accuracy: 1,
    radius: 0.35,
    area: 0,
    penetration: 0,
    profile,
    biological: false,
    charges: null,
    threat: 0,
    color: 0x57c5cf,
    description: '',
    ...extra,
  });
}
add('friendly.sentry', 'Sentry', 'tower', 1, 250, 2, 2, 2, 1200, 15, 40, 0.8, 8, 'bullet', {
  targets: 'both',
  accuracy: 0.9,
  profile: 'Precision',
  description: 'Reliable direct fire against ground and air.',
});
add('friendly.rotary', 'Rotary', 'tower', 7, 500, 3, 2, 2, 1400, 20, 12, 0.15, 7, 'bullet', {
  targets: 'both',
  accuracy: 0.8,
  velocity: 26,
  profile: 'Suppression',
  description: 'Rapid fire builds heat; repeated hits slow targets.',
});
add(
  'friendly.breaker_cannon',
  'Breaker Cannon',
  'tower',
  10,
  700,
  4,
  3,
  2,
  1600,
  25,
  160,
  2,
  9,
  'shell',
  {
    velocity: 12,
    accuracy: 0.95,
    area: 1.5,
    penetration: 0.5,
    profile: 'Siege',
    description: 'Armor-piercing shells with a ground blast.',
  },
);
add('friendly.skyguard', 'Skyguard', 'tower', 18, 650, 3, 2, 2, 1100, 15, 90, 1, 11, 'guided', {
  targets: 'air',
  velocity: 16,
  profile: 'Siege',
  description: 'Guided air defense; optional close ground fallback.',
});
add('friendly.arc_spire', 'Arc Spire', 'tower', 8, 600, 3, 2, 2, 1000, 10, 65, 1.2, 7, 'arc', {
  targets: 'both',
  profile: 'Suppression',
  description: 'Energy chains across nearby contacts on the same layer.',
});
add(
  'friendly.mortar_nest',
  'Mortar Nest',
  'tower',
  22,
  850,
  4,
  3,
  3,
  1300,
  15,
  220,
  3,
  14,
  'mortar',
  {
    minimum: 4,
    area: 2,
    profile: 'Siege',
    description: 'Arcing, velocity-led bombardment; has a minimum range.',
  },
);
add(
  'friendly.lance_array',
  'Lance Array',
  'tower',
  32,
  1000,
  4,
  2,
  3,
  1100,
  10,
  70,
  0.1,
  10,
  'beam',
  {
    targets: 'both',
    profile: 'Precision',
    description: 'Continuous beam ramps while maintaining its lock.',
  },
);
add('friendly.nullifier', 'Nullifier', 'tower', 28, 750, 3, 2, 2, 1000, 10, 20, 1, 8, 'arc', {
  targets: 'both',
  profile: 'Utility',
  description: 'Detects contacts and suppresses healing and hostile buffs.',
});
add(
  'friendly.rifle_squad',
  'Rifle Squad',
  'mobile',
  1,
  300,
  3,
  2,
  2,
  900,
  10,
  27,
  0.6,
  6,
  'bullet',
  {
    biological: true,
    speed: 2.2,
    targets: 'both',
    accuracy: 0.85,
    velocity: 22,
    profile: 'Suppression',
  },
);
add(
  'friendly.heavy_squad',
  'Heavy Squad',
  'mobile',
  6,
  550,
  4,
  2,
  2,
  1300,
  25,
  22,
  0.4,
  7,
  'bullet',
  {
    biological: true,
    speed: 1.6,
    radius: 0.6,
    targets: 'both',
    accuracy: 0.8,
    velocity: 20,
    penetration: 0.35,
    profile: 'Suppression',
  },
);
add(
  'friendly.combat_engineers',
  'Combat Engineers',
  'mobile',
  1,
  450,
  3,
  2,
  2,
  800,
  5,
  15,
  1,
  4,
  'bullet',
  {
    biological: true,
    speed: 2,
    accuracy: 0.85,
    velocity: 18,
    profile: 'Recovery',
    description: 'Repairs mechanical allies and safely rearms finite traps.',
  },
);
add(
  'friendly.field_medics',
  'Field Medics',
  'mobile',
  12,
  500,
  3,
  2,
  2,
  750,
  5,
  15,
  1.2,
  4,
  'bullet',
  {
    biological: true,
    speed: 2.3,
    accuracy: 0.85,
    velocity: 18,
    profile: 'Recovery',
    description: 'Heals living biological allies, including Wardens.',
  },
);
add(
  'friendly.interceptor_drones',
  'Interceptor Drones',
  'mobile',
  24,
  700,
  4,
  2,
  2,
  850,
  10,
  30,
  0.5,
  6,
  'bullet',
  { speed: 3.4, layer: 'air', targets: 'both', accuracy: 0.95, velocity: 28, profile: 'Siege' },
);
add(
  'friendly.aegis_walkers',
  'Aegis Walkers',
  'mobile',
  38,
  1000,
  5,
  3,
  3,
  2400,
  35,
  70,
  1.5,
  5,
  'bullet',
  {
    speed: 1.2,
    radius: 0.6,
    accuracy: 0.9,
    velocity: 16,
    profile: 'Protection',
    description: 'An 800-point shield redirects part of nearby direct fire.',
  },
);
add(
  'friendly.repair_node',
  'Repair Node',
  'support',
  2,
  350,
  2,
  2,
  2,
  800,
  5,
  25,
  0.25,
  5,
  'none',
  { profile: 'Recovery' },
);
add(
  'friendly.medical_station',
  'Medical Station',
  'support',
  12,
  450,
  2,
  2,
  2,
  800,
  5,
  30,
  0.25,
  5,
  'none',
  { profile: 'Recovery' },
);
add(
  'friendly.detection_relay',
  'Detection Relay',
  'support',
  16,
  350,
  2,
  2,
  2,
  650,
  5,
  0,
  6,
  10,
  'none',
);
add(
  'friendly.shield_projector',
  'Shield Projector',
  'support',
  26,
  700,
  3,
  2,
  2,
  1000,
  15,
  25,
  0.25,
  5,
  'none',
  { profile: 'Protection' },
);
add(
  'friendly.ammunition_fabricator',
  'Ammunition Fabricator',
  'support',
  34,
  650,
  2,
  2,
  2,
  900,
  10,
  0,
  1,
  5,
);
add('friendly.tactical_uplink', 'Tactical Uplink', 'support', 42, 750, 2, 2, 2, 850, 10, 0, 1, 7);
add('friendly.power_relay', 'Power Relay', 'infrastructure', 13, 300, 1, 2, 2, 700, 5, 0, 1, 4);
add('friendly.barracks', 'Barracks', 'infrastructure', 5, 500, 2, 3, 3, 1500, 20, 10, 0.25, 4);
add(
  'friendly.drone_bay',
  'Drone Bay',
  'infrastructure',
  24,
  650,
  2,
  3,
  3,
  1300,
  15,
  20,
  0.25,
  4,
  'none',
  {
    profile: 'Recovery',
  },
);
add(
  'friendly.command_node',
  'Command Node',
  'infrastructure',
  55,
  1000,
  2,
  3,
  3,
  1800,
  20,
  0,
  1,
  6,
);
add(
  'friendly.proximity_mine',
  'Proximity Mine',
  'trap',
  1,
  75,
  0,
  1,
  1,
  200,
  0,
  300,
  0.3,
  1,
  'none',
  { charges: 1, area: 1.5 },
);
add('friendly.slow_field', 'Slow Field', 'trap', 3, 120, 0, 1, 1, 200, 0, 0, 1, 2);
add('friendly.arc_plate', 'Arc Plate', 'trap', 14, 180, 0, 1, 1, 200, 0, 80, 4, 1.5, 'none', {
  charges: 8,
});
add(
  'friendly.incendiary_vent',
  'Incendiary Vent',
  'trap',
  20,
  220,
  0,
  1,
  1,
  200,
  0,
  40,
  6,
  1.5,
  'none',
  { charges: 6, area: 3 },
);
add(
  'friendly.armor_shredding_charge',
  'Armor-Shredding Charge',
  'trap',
  27,
  200,
  0,
  1,
  1,
  200,
  0,
  100,
  3,
  1,
  'none',
  { charges: 2, area: 2 },
);
add('friendly.gravity_snare', 'Gravity Snare', 'trap', 36, 250, 0, 1, 1, 200, 0, 0, 8, 2, 'none', {
  charges: 4,
  targets: 'both',
});
add('friendly.decoy_beacon', 'Decoy Beacon', 'trap', 44, 200, 0, 1, 1, 200, 0, 0, 15, 4, 'none', {
  charges: 3,
});
add(
  'friendly.collapse_charge',
  'Collapse Charge',
  'trap',
  52,
  350,
  0,
  1,
  1,
  200,
  0,
  500,
  1,
  1.2,
  'none',
  { charges: 1, area: 2.5, penetration: 0.5 },
);
add('friendly.standard_barricade', 'Standard Barricade', 'route', 1, 60, 0, 1, 1, 1500, 20);
add('friendly.reinforced_wall', 'Reinforced Wall', 'route', 25, 140, 0, 1, 1, 3000, 40);
add('friendly.controlled_gate', 'Controlled Gate', 'route', 9, 180, 0, 1, 2, 1800, 20);
add('friendly.low_cover', 'Low Cover', 'route', 4, 80, 0, 1, 2, 650, 10);
add('friendly.razor_field', 'Razor Field', 'route', 11, 100, 0, 1, 1, 400, 0, 15, 0.25, 0);
add('friendly.anti_vehicle_obstacle', 'Anti-Vehicle Obstacle', 'route', 29, 160, 0, 1, 2, 2200, 25);
add(
  'friendly.elevated_firing_platform',
  'Elevated Firing Platform',
  'route',
  23,
  350,
  1,
  2,
  2,
  1400,
  15,
  0,
  1,
  0,
  'none',
  { profile: 'Protection' },
);
add('friendly.resonance_channel', 'Resonance Channel', 'route', 46, 130, 0, 1, 3, 450, 5);
add('warden.bulwark', 'Bulwark', 'warden', 1, 500, 0, 2, 2, 2500, 35, 60, 0.6, 7, 'bullet', {
  biological: true,
  speed: 2,
  radius: 0.45,
  targets: 'both',
  accuracy: 0.9,
  profile: 'Protection',
});
add('warden.ranger', 'Ranger', 'warden', 1, 500, 0, 2, 2, 1700, 15, 110, 1, 10, 'bullet', {
  biological: true,
  speed: 2.8,
  radius: 0.45,
  targets: 'both',
  accuracy: 0.95,
  velocity: 32,
  profile: 'Precision',
});
add('warden.conductor', 'Conductor', 'warden', 1, 500, 0, 2, 2, 1900, 20, 50, 0.9, 6, 'arc', {
  biological: true,
  speed: 2.3,
  radius: 0.45,
  targets: 'both',
  profile: 'Recovery',
});
const enemy = (
  id: string,
  name: string,
  rank: number,
  tp: number,
  hp: number,
  armor: number,
  speed: number,
  damage: number,
  interval: number,
  range = 0.8,
  weapon: Weapon = 'melee',
  extra: Partial<Definition> = {},
) =>
  add(`enemy.${id}`, name, 'enemy', rank, 0, 0, 1, 1, hp, armor, damage, interval, range, weapon, {
    speed,
    threat: tp,
    accuracy: weapon === 'melee' ? 1 : 0.85,
    color: 0xe26963,
    ...extra,
  });
enemy('runner', 'Runner', 1, 1, 100, 0, 3, 20, 0.8);
enemy('raider', 'Raider', 1, 2, 250, 10, 2.2, 35, 1);
enemy('bulwark', 'Hostile Bulwark', 6, 6, 750, 40, 1.2, 45, 1.4, 0.8, 'melee', { radius: 0.65 });
enemy('lancer', 'Lancer', 7, 3, 220, 5, 1.8, 45, 1.2, 8, 'bullet', { velocity: 20 });
enemy('bombard', 'Bombard', 22, 7, 450, 20, 1, 120, 3, 14, 'mortar', { minimum: 5, area: 1.7 });
enemy('skimmer', 'Skimmer', 18, 3, 180, 5, 3, 30, 1, 5, 'bullet', {
  layer: 'air',
  targets: 'both',
  velocity: 20,
});
enemy('veil', 'Veil', 16, 4, 220, 0, 2.4, 70, 2);
enemy('mole', 'Mole', 23, 5, 400, 15, 1.4, 50, 1.2);
enemy('sapper', 'Sapper', 10, 4, 300, 10, 2, 180, 3);
enemy('jammer', 'Jammer', 28, 5, 350, 10, 1.7, 20, 1.5, 6, 'arc');
enemy('mender', 'Mender', 12, 5, 300, 5, 1.6, 30, 0.25, 4, 'none');
enemy('herald', 'Herald', 30, 5, 380, 15, 1.5, 25, 1.5, 5, 'bullet');
enemy('drainer', 'Drainer', 34, 6, 550, 20, 1.4, 30, 0.1, 4, 'beam');
enemy('carrier', 'Carrier', 38, 8, 800, 25, 1.2, 35, 1.5, 0.8, 'melee', { radius: 0.65 });
enemy('breaker', 'Breaker', 20, 6, 700, 35, 1.1, 90, 1.8, 0.8, 'melee', { radius: 0.65 });
enemy('harvester', 'Harvester', 46, 7, 650, 20, 1.5, 55, 1.5, 0.8, 'melee', { radius: 0.65 });
const boss = (
  id: string,
  name: string,
  rank: number,
  hp: number,
  armor: number,
  tp: number,
  damage: number,
  interval: number,
  range: number,
  weapon: Weapon,
  extra: Partial<Definition> = {},
) =>
  add(`boss.${id}`, name, 'boss', rank, 0, 0, 3, 3, hp, armor, damage, interval, range, weapon, {
    speed: 0.8,
    radius: 1.2,
    threat: tp,
    color: 0xd08df2,
    accuracy: 1,
    ...extra,
  });
boss('prism_sovereign', 'Prism Sovereign', 5, 5000, 25, 40, 80, 0.1, 10, 'beam');
boss('choir_dreadnought', 'Choir Dreadnought', 10, 9000, 60, 65, 240, 3, 1.5, 'melee');
boss('silent_crown', 'Silent Crown', 20, 6500, 20, 50, 180, 4, 1, 'melee');
boss('gorger_titan', 'Gorger Titan', 27, 11000, 35, 70, 180, 3, 1.5, 'melee');
boss('shatterstorm', 'Shatterstorm', 39, 6500, 20, 50, 80, 4, 9, 'bullet', {
  layer: 'air',
  speed: 1.2,
  targets: 'both',
});
boss('marshal', 'The Marshal', 54, 7500, 40, 55, 90, 1.5, 8, 'bullet');
boss('black_conductor', 'Black Conductor', 74, 8000, 30, 60, 80, 3, 8, 'arc');
boss('root_below', 'The Root Below', 94, 9500, 30, 65, 120, 2, 1.5, 'melee');
add('special.prism', 'Shield Prism', 'enemy', 0, 0, 0, 1, 1, 200, 0, 0, 1, 0, 'none', {
  threat: 2,
  color: 0x9deaff,
});
add('special.decoy', 'Uncertain Crown', 'enemy', 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 'none', {
  color: 0x9f739f,
});
add('special.root', 'Anchored Root', 'enemy', 0, 0, 0, 1, 1, 300, 0, 30, 0.1, 2, 'beam', {
  threat: 3,
  color: 0x819b56,
});
export const CATALOG: readonly Definition[] = Object.freeze(entries.map((e) => Object.freeze(e)));
export const BY_ID: Readonly<Record<string, Definition>> = Object.freeze(
  Object.fromEntries(CATALOG.map((e) => [e.id, e])),
);
export function definition(id: string): Definition {
  const d = BY_ID[id];
  if (!d) throw new Error(`Unknown content: ${id}`);
  return d;
}
export const FRIENDLIES = CATALOG.filter((d) => !['enemy', 'boss'].includes(d.category));
export const ENEMIES = CATALOG.filter((d) => d.category === 'enemy' && d.id.startsWith('enemy.'));
export const BOSSES = CATALOG.filter((d) => d.category === 'boss');
export const FACTIONS = ['Fracture', 'Iron', 'Hollow', 'Maw'] as const;
export type Faction = (typeof FACTIONS)[number];
export const SUPPORT_ROLES = new Set(['enemy.jammer', 'enemy.mender', 'enemy.herald']);
export const BREACH_ROLES = new Set([
  'enemy.sapper',
  'enemy.breaker',
  'boss.choir_dreadnought',
  'boss.marshal',
  'boss.gorger_titan',
  'boss.root_below',
]);
