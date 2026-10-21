import { it, expect } from 'vitest';
import { makeAsset } from '../../src/game/model';
import { damageLayers, hasCounter } from '../../src/game/readiness';
it('recognizes finite ground traps as damage counters only while deployed and stocked', () => {
  for (const type of [
    'friendly.proximity_mine',
    'friendly.arc_plate',
    'friendly.incendiary_vent',
    'friendly.armor_shredding_charge',
    'friendly.collapse_charge',
  ]) {
    const a = makeAsset(type);
    expect(damageLayers(a)).toEqual([]);
    a.placement = { x: 20, y: 20, rotation: 0 };
    expect(damageLayers(a)).toEqual(['ground']);
    a.charges = 0;
    expect(damageLayers(a)).toEqual([]);
  }
});
it('distinguishes healing, slowing and root effects from real damage and honors fallback policy', () => {
  for (const type of [
    'friendly.repair_node',
    'friendly.barracks',
    'friendly.slow_field',
    'friendly.gravity_snare',
  ]) {
    const a = makeAsset(type);
    a.placement = { x: 20, y: 20, rotation: 0 };
    expect(damageLayers(a)).toEqual([]);
  }
  const skyguard = makeAsset('friendly.skyguard');
  skyguard.placement = { x: 20, y: 20, rotation: 0 };
  skyguard.tactics.groundFallback = false;
  expect(hasCounter([skyguard], 'air')).toBe(true);
  expect(hasCounter([skyguard], 'ground')).toBe(false);
  skyguard.tactics.groundFallback = true;
  expect(hasCounter([skyguard], 'ground')).toBe(true);
});
