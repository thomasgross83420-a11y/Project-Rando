import {
  createCampaign,
  migrateProgression,
  validateCampaign,
} from '../../src/persistence/campaign';
import { guidedPositions } from '../../src/persistence/practice';
/** Deterministic owned identities, including stored assets. */
export function deployedCampaign() {
  const c = migrateProgression(
    createCampaign('Campaign integration', 0, 'Bastion', 'warden.bulwark'),
  );
  c.lineage = '10000000-0000-4000-8000-000000000001';
  c.assets.forEach((a, i) => {
    a.id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
  });
  const used = new Set<string>();
  for (const [type, x, y] of guidedPositions) {
    const a = c.assets.find((a) => a.type === type && !used.has(a.id));
    if (!a) throw new Error('Fixture missing asset');
    a.placement = { x, y, rotation: 0 };
    used.add(a.id);
  }
  const valid = validateCampaign(c);
  if (valid.schema !== 2) throw new Error('Fixture schema');
  return valid;
}
