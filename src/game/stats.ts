import {
  growthFactors,
  grownRange,
  ordinaryIntervalTicks,
  scaleFixed,
} from '../progression/growth';
import { grownAccuracy } from '../progression/accuracy';
import { rational } from '../economy/policy';
import { definition, type Definition } from './catalog';
import { maxHealth, type Asset, type Plan } from './model';
export interface Stats {
  health: number;
  armor: number;
  damage: number;
  interval: number;
  range: number;
  accuracy: { n: bigint; d: bigint };
  speed: number;
  penetration: number;
  area: number;
  velocity: number;
}
export function friendlyStats(a: Asset): Stats {
  const d = definition(a.type),
    f = growthFactors(a.level, a.enhancement),
    auraOnly = [
      'friendly.ammunition_fabricator',
      'friendly.tactical_uplink',
      'friendly.power_relay',
      'friendly.command_node',
    ].includes(a.type);
  let range = grownRange(Math.round(d.range * 1024), a.level, a.enhancement, auraOnly),
    armor = d.armor,
    area = d.area,
    penetration = d.penetration,
    velocity = d.velocity;
  if (a.stars >= 3) {
    const enhanced = a.stars >= 5;
    if (d.profile === 'Precision' && a.branch === 'B')
      range += Math.round((enhanced ? 1.5 : 1) * 1024);
    if (d.profile === 'Protection' && a.branch === 'B') armor += enhanced ? 15 : 10;
    if (
      d.profile === 'Recovery' &&
      a.branch === 'A' &&
      ['support', 'infrastructure'].includes(d.category)
    )
      range += Math.round((enhanced ? 1.5 : 1) * 1024);
    if (d.profile === 'Utility') {
      if (a.branch === 'A') range += Math.round((enhanced ? 1.5 : 1) * 1024);
      else armor += enhanced ? 20 : 15;
    }
    if (d.profile === 'Siege') {
      if (a.branch === 'A') {
        if (!['friendly.skyguard', 'friendly.interceptor_drones'].includes(d.id))
          area += enhanced ? 0.7 : 0.4;
      } else penetration += enhanced ? 0.25 : 0.15;
    }
  }
  if (d.profile === 'Utility' && a.stars >= 2) range = Math.round(range * 1.1);
  if (d.profile === 'Siege' && a.stars >= 4) velocity *= 1.2;
  return {
    health: maxHealth(a),
    armor,
    damage: scaleFixed(Math.round(d.damage * 1024), f.output),
    interval: ordinaryIntervalTicks(
      rational(BigInt(Math.round(d.interval * 1000)), 1000n),
      a.level,
      d.weapon === 'beam' ? 'beam' : d.weapon === 'none' ? 'support' : 'attack',
    ),
    range,
    accuracy: grownAccuracy(Math.round(d.accuracy * 100), a.level),
    speed: Math.round(d.speed * 1024),
    penetration: Math.min(1, penetration),
    area,
    velocity,
  };
}
export function hostileStats(d: Definition, variant: number, p: Plan): Stats {
  const h = [1, 1.15, 1.4, 1.7][variant]!,
    o = [1, 1.1, 1.2, 1.35][variant]!,
    mastery = p.mastery && d.category === 'boss';
  return {
    health: Math.round(
      d.health * 1024 * (1 + 0.035 * (p.band - 1)) * h * (mastery ? 2 : 1) * (1 + 0.125 * p.tier),
    ),
    armor:
      d.armor +
      Math.min(15, p.band - 1) +
      [0, 5, 10, 15][variant]! +
      (p.modifiers.includes('armoured') ? 10 : 0),
    damage: Math.round(
      d.damage *
        1024 *
        (1 + 0.025 * (p.band - 1)) *
        o *
        (mastery ? 1.15 : 1) *
        (1 + 0.075 * p.tier),
    ),
    interval: Math.max(1, Math.round(d.interval * 60)),
    range: Math.round(d.range * 1024),
    accuracy: rational(BigInt(Math.round(d.accuracy * 100)), 100n),
    speed: Math.round(d.speed * 1024),
    penetration: d.penetration,
    area: d.area,
    velocity: d.velocity,
  };
}
