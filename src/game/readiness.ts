import { definition } from './catalog';
import type { Asset } from './model';
const damagingTraps = new Set([
  'friendly.proximity_mine',
  'friendly.arc_plate',
  'friendly.incendiary_vent',
  'friendly.armor_shredding_charge',
  'friendly.collapse_charge',
]);
/** Potential damage capability for preflight, never a promise to win the plan. */
export function damageLayers(a: Asset): ('ground' | 'air')[] {
  if (!a.placement || !a.hp) return [];
  const d = definition(a.type),
    trap = damagingTraps.has(a.type) && (a.charges ?? 0) > 0;
  if (d.weapon === 'none' && !trap && a.type !== 'friendly.razor_field') return [];
  return (['ground', 'air'] as const).filter(
    (layer) =>
      (d.targets === layer ||
        d.targets === 'both' ||
        (layer === 'ground' && a.type === 'friendly.skyguard' && a.tactics.groundFallback)) &&
      !(layer === 'ground' && a.type === 'friendly.skyguard' && !a.tactics.groundFallback),
  );
}
export const hasCounter = (assets: Asset[], layer: 'ground' | 'air') =>
  assets.some((a) => damageLayers(a).includes(layer));
