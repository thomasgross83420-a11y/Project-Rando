import { definition } from './catalog';
import { limits, usage, validateLayout } from './construction';
import { maxHealth, type GameState, type PracticeRules, type Plan } from './model';
export function practiceClone(s: GameState, r: PracticeRules, p: Plan): GameState {
  const c = structuredClone(s);
  c.active = null;
  c.pending = null;
  const lim = limits(c);
  const allowances = {
    capacity: Math.min(r.capacity, lim.capacity),
    barriers: Math.min(r.barriers, lim.barriers),
    traps: Math.min(r.traps, lim.traps),
  };
  if (!c.assets.some((a) => a.type === r.warden && definition(a.type).category === 'warden'))
    throw new Error('Practice requires an owned Warden');
  c.warden = r.warden;
  for (const a of c.assets) {
    if (r.fullRepair) {
      a.hp = maxHealth(a);
      a.charges = definition(a.type).charges;
    }
    if (r.flipBranches && a.branch) a.branch = a.branch === 'A' ? 'B' : 'A';
    if (
      r.exclusions.includes(a.type) ||
      (definition(a.type).category === 'warden' && a.type !== r.warden)
    )
      a.placement = null;
  }
  if (r.fullRepair) c.coreHP = 10240000;
  const w = c.assets.find((a) => a.type === r.warden)!;
  if (!w.placement) w.placement = { x: 29, y: 33, rotation: 0 };
  const used = usage(c);
  for (const key of ['capacity', 'traps', 'barriers'] as const)
    if (used[key] > allowances[key])
      throw new Error(
        `Practice ${key}: ${used[key]} deployed exceeds chosen/unlocked allowance ${allowances[key]}. Store or exclude assets first.`,
      );
  const deployed = c.assets.filter(
    (a) => a.placement && a.hp && definition(a.type).weapon !== 'none',
  );
  if (
    p.spawns.some((v) => definition(v.type).layer === 'air') &&
    !deployed.some((a) => definition(a.type).targets !== 'ground')
  )
    throw new Error('Practice cannot start: no legal damaging air counter remains');
  const errors = validateLayout(c);
  if (errors.length) throw new Error(errors.join('; '));
  return c;
}
