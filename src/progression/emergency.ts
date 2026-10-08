/** §25F starter-slice recovery. Uses affordability, never predicted victory. */
import { foundation } from '../data/foundation';
import { PAD } from '../construction/geometry';
import {
  maximumBody,
  newAsset,
  validateCampaign,
  type ProgressionCampaign,
  type ProgressedOwned,
} from '../persistence/campaign';
import { quoteRestore } from '../economy/recovery';
import { bodyInvestment } from './preparation';
const weapon = (a: ProgressedOwned) =>
  a.type === 'friendly.sentry' || a.type === 'friendly.rifle_squad';
export function recoveryViable(c: ProgressionCampaign): boolean {
  return (
    c.coreHP > 0 &&
    c.assets.some((a) => a.type === c.warden && a.hp > 0) &&
    c.assets.some((a) => weapon(a) && a.hp > 0)
  );
}
function arrange(
  c: ProgressionCampaign,
  ids: readonly string[],
): { after: ProgressionCampaign; stored: string[] } {
  const beforePlaced = c.assets.filter((a) => a.placement).map((a) => a.id);
  const attempt = (clear: boolean) => {
    const copy = structuredClone(c);
    if (clear) for (const a of copy.assets) if (!ids.includes(a.id)) a.placement = null;
    for (const id of ids) {
      const a = copy.assets.find((a) => a.id === id);
      if (!a) throw new Error('Recovery identity missing');
      if (a.placement) {
        try {
          validateCampaign(copy);
          continue;
        } catch {
          a.placement = null;
        }
      }
      const cells =
        foundation[a.type].category === 'warden'
          ? [{ x: PAD.x, y: PAD.y }]
          : Array.from({ length: 36 * 36 }, (_, i) => ({
              x: 12 + (i % 36),
              y: 12 + Math.floor(i / 36),
            }));
      let found = false;
      for (const p of cells) {
        a.placement = { ...p, rotation: 0 };
        try {
          validateCampaign(copy);
          found = true;
          break;
        } catch {
          a.placement = null;
        }
      }
      if (!found) return;
    }
    const valid = validateCampaign(copy);
    if (valid.schema !== 2) throw new Error('Recovery schema');
    return valid;
  };
  const after = attempt(false) ?? attempt(true);
  if (!after) throw new Error('No legal recovery layout');
  return {
    after,
    stored: beforePlaced.filter((id) => !after.assets.find((a) => a.id === id)?.placement),
  };
}
const preferred = (assets: ProgressedOwned[]) =>
  [...assets].sort(
    (a, b) =>
      b.level - a.level ||
      b.enhancement - a.enhancement ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )[0];
function basic(
  type: 'friendly.sentry' | 'friendly.rifle_squad',
  subsidized: boolean,
): ProgressedOwned {
  return {
    ...newAsset(type, subsidized ? 0 : foundation[type].cost),
    enhancementPaid: 0,
    permanentCharges: null,
    refundLocked: subsidized,
    emergencyCreated: subsidized,
  };
}
export function previewEmergency(input: ProgressionCampaign, conversionID?: string) {
  const parsed = validateCampaign(input);
  if (parsed.schema !== 2) throw new Error('Progression required');
  const c = parsed;
  if (c.warden !== 'warden.bulwark')
    throw new Error('Emergency combat validation currently supports Bulwark only');
  if (recoveryViable(c))
    throw new Error('Owned defense is viable; repair or deploy it without subsidy');
  const w = c.assets.find((a) => a.type === c.warden);
  if (!w) throw new Error('Selected Warden missing');
  const live = preferred(c.assets.filter((a) => weapon(a) && a.hp > 0)),
    wrecks = c.assets
      .filter((a) => weapon(a) && a.hp === 0)
      .map((a) => ({ a, quote: quoteRestore(bodyInvestment(a)) }))
      .sort((a, b) => a.quote.credits - b.quote.credits || (a.a.id < b.a.id ? -1 : 1));
  const restore = w.hp === 0 ? quoteRestore(bodyInvestment(w)) : null;
  const chosen = live ?? wrecks[0]?.a;
  const weaponCost = live ? 0 : (wrecks[0]?.quote.credits ?? 250);
  const cost = (c.coreHP === 0 ? 1 : 0) + (restore?.credits ?? 0) + weaponCost;
  if (c.credits >= cost) {
    if (c.coreHP === 0) c.coreHP = 1024;
    if (restore) w.hp = restore.body;
    let a = chosen;
    if (!a) {
      if (c.assets.length === 1024)
        throw new Error('Ownership cap requires explicit recovery conversion');
      a = basic('friendly.sentry', false);
      c.assets.push(a);
    } else if (!a.hp) a.hp = quoteRestore(bodyInvestment(a)).body;
    c.credits -= cost;
    c.emergencyActive = false;
    c.revision++;
    return {
      kind: 'priced' as const,
      credits: cost,
      ...arrange(c, [w.id, a.id]),
      subsidized: [] as string[],
    };
  }
  c.coreHP = Math.max(c.coreHP, 2500 * 1024);
  w.hp = Math.max(w.hp, Math.ceil(maximumBody(w) / 2));
  w.refundLocked = true;
  const selected = [w];
  for (const type of ['friendly.sentry', 'friendly.rifle_squad'] as const) {
    let a = preferred(c.assets.filter((a) => a.type === type));
    if (!a) {
      if (c.assets.length < 1024) {
        a = basic(type, true);
        c.assets.push(a);
      } else if (c.assets.some(weapon)) continue;
      else {
        const convert = c.assets.find(
          (a) => a.id === conversionID && foundation[a.type].category !== 'warden',
        );
        if (!convert)
          throw new Error(
            'At the ownership cap, choose a non-Warden identity to convert to a Sentry; cancellation preserves it',
          );
        c.assets = c.assets.filter((a) => a.id !== convert.id);
        a = basic('friendly.sentry', true);
        c.assets.push(a);
      }
    }
    a.hp = Math.max(a.hp, Math.ceil(maximumBody(a) / 2));
    a.refundLocked = true;
    selected.push(a);
  }
  c.emergencyActive = true;
  c.revision++;
  return {
    kind: 'subsidy' as const,
    credits: 0,
    ...arrange(
      c,
      selected.map((a) => a.id),
    ),
    subsidized: selected.map((a) => a.id),
  };
}
