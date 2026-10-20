import art from '../../public/assets/full/runtime.json';
import { definition, type Category } from './catalog';
import { maxHealth, type GameState, type Plan } from './model';
import { repair, rearm, rearmQuote } from './economy';
import { stageInfo } from './director';
export const CATEGORY_NAMES: Partial<Record<Category, string>> = {
  tower: 'Towers',
  mobile: 'Squads',
  support: 'Support',
  trap: 'Traps',
  route: 'Walls & routes',
  infrastructure: 'Infrastructure',
};
export const FRONT_NAMES = ['Northwest', 'Southwest', 'North', 'Northeast', 'East', 'South'];
const notes: Record<string, string> = {
  rifle_squad: 'Flexible defenders that engage ground and air.',
  heavy_squad: 'Armor-piercing ground and air fire; needs wide paths.',
  combat_engineers: 'Repairs mechanical allies and safely reloads nearby traps.',
  field_medics: 'Heals nearby living allies.',
  interceptor_drones: 'Fast air support against ground and air.',
  aegis_walkers: 'Absorbs pressure and protects nearby allies.',
  bulwark: 'A durable guardian who protects the Core.',
  ranger: 'A mobile hunter who picks off priority targets.',
  conductor: 'Controls crowds and supports nearby defenders.',
  shield_projector: 'Protects nearby allies with a shared shield.',
  repair_node: 'Repairs mechanical allies in its coverage.',
  medical_station: 'Heals living allies in its coverage.',
  detection_relay: 'Reveals stealth and periodically forces nearby burrowers to surface.',
  ammunition_fabricator: 'Helps nearby weapons fire faster.',
  nullifier: 'Disrupts hostile support effects.',
  standard_barricade: 'Blocks ground routes; enemies go around or breach.',
  reinforced_wall: 'A stronger barrier for committed defensive lines.',
  controlled_gate: 'Controls passage through your defensive line.',
  low_cover: 'Protects defenders from eligible direct fire.',
  anti_vehicle_obstacle: 'Blocks large ground bodies.',
  razor_field: 'Damages and slows passing ground enemies.',
  resonance_channel: 'Speeds friendly movement and slows enemies on the route.',
  elevated_firing_platform: 'Mounts a compatible tower above low cover.',
  power_relay: 'Extends the coverage of nearby support buildings.',
  barracks: 'Helps biological defenders recover outside combat.',
  drone_bay: 'Repairs nearby mechanical air units.',
  command_node: 'Improves awareness and coordinates configured fallback positions.',
  tactical_uplink: 'Improves nearby targeting and accuracy.',
  proximity_mine: 'A single-charge blast against nearby ground enemies.',
  slow_field: 'Slows passing ground enemies without spending charges.',
  arc_plate: 'Discharges energy into up to three nearby ground enemies.',
  incendiary_vent: 'Burns ground enemies in its forward cone. Rotate before placing.',
  armor_shredding_charge: 'Blasts ground enemies and temporarily weakens armor.',
  gravity_snare: 'Briefly roots a ground or air enemy, then slows it.',
  decoy_beacon: 'Draws nearby ground enemies toward this expendable defender.',
  collapse_charge: 'A heavy blast that leaves a slowing debris field.',
};
export const roleSummary = (type: string) =>
  definition(type).description || notes[type.split('.').at(-1)!] || 'Supports your defensive plan.';
export function portrait(type: string): string {
  const clips = art.clips as Record<string, number[][]>,
    index = clips['friendly|' + type]?.[0]?.[0],
    frame = index === undefined ? undefined : art.images[index];
  if (!frame) return '<span class="asset-portrait" aria-hidden="true">◇</span>';
  const atlas = art.atlases.find((a) => a.file === frame.file)!;
  return `<span class="asset-portrait" aria-hidden="true"><svg viewBox="${frame.rect.join(' ')}"><image href="${import.meta.env.BASE_URL}assets/full/${frame.file}" width="${atlas.width}" height="${atlas.height}"/></svg></span>`;
}
export function healthMeter(hp: number, max: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));
  return `<div class="health-meter ${pct < 25 ? 'critical' : ''}" role="meter" aria-label="Health" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
}
export const nextCampaign = (s: GameState) =>
  Array.from({ length: 40 }, (_, i) => i).find((i) => !s.stages.includes(i)) ?? 39;
export function nextObjective(s: GameState): {
  title: string;
  detail: string;
  stage: number;
  mode: 'Campaign' | 'Expedition';
} {
  const stage = nextCampaign(s),
    info = stageInfo(stage);
  if (s.stages.length === 40)
    return {
      title: 'Your Bastion endures',
      detail: 'Mastery trials and fresh expeditions await.',
      stage,
      mode: 'Expedition',
    };
  if (s.rank < info.rank)
    return {
      title: `Reach Rank ${info.rank}`,
      detail: 'Earn XP in an expedition to open the next campaign siege.',
      stage,
      mode: 'Expedition',
    };
  return {
    title: s.stages.length
      ? `Chapter ${info.chapter + 1} · Siege ${info.index + 1}`
      : 'Defend your first siege',
    detail: s.stages.length
      ? info.name.split(' · ').at(-1)!
      : 'Protect the Core. Your defenders fight automatically.',
    stage,
    mode: 'Campaign',
  };
}
/** Quote and commit use the same economy operations, including wreck revival then healing. */
export function maintenance(
  s: GameState,
  commit = false,
): { cost: number; damaged: number; empty: number } {
  const clone = { ...s, assets: structuredClone(s.assets), credits: Number.MAX_SAFE_INTEGER };
  const damaged = s.assets.filter((a) => a.placement && a.hp < maxHealth(a)).length,
    empty = s.assets.filter((a) => a.placement && a.charges === 0).length;
  repair(clone, null);
  for (const a of clone.assets.filter((a) => a.placement)) {
    if (!a.hp) repair(clone, a);
    repair(clone, a);
    if (rearmQuote(a)) rearm(clone, a);
  }
  const cost = Number.MAX_SAFE_INTEGER - clone.credits;
  if (commit) {
    if (cost > s.credits) throw Error(`Restoration needs ${cost} Credits`);
    s.credits -= cost;
    s.coreHP = clone.coreHP;
    s.assets = clone.assets;
  }
  return { cost, damaged, empty };
}
export function threatBrief(p: Plan): { fronts: string; summary: string; counter: string } {
  const roles = new Set(p.spawns.map((v) => v.type)),
    air = p.spawns.some((v) => definition(v.type).layer === 'air'),
    armor = p.spawns.some((v) => ['enemy.bulwark', 'enemy.breaker'].includes(v.type));
  return {
    fronts: [...new Set(p.spawns.map((v) => v.entrance))].map((i) => FRONT_NAMES[i]).join(' + '),
    summary: p.boss
      ? `${definition(p.boss).name} leads this attack.`
      : air
        ? 'Air and ground attackers.'
        : armor
          ? 'Armored ground pressure.'
          : 'Ground attackers approach your Core.',
    counter: air
      ? 'Cover both layers with Sentries, Rifles or your Warden.'
      : roles.has('enemy.veil') || roles.has('enemy.mole')
        ? 'Keep inner defenses and detection near the Core.'
        : 'Face the approach. Cover open routes and protect your repair support.',
  };
}
