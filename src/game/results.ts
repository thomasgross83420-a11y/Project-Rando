import type { Result, Performance } from './model';
/** Completed Endurance entitlements are already individually rounded. Combine
 * their integers and actual statistics without repricing them as one encounter. */
export function combineResults(blocks: readonly Result[]): Result {
  const last = blocks.at(-1);
  if (!last) throw new Error('No completed blocks');
  const r = structuredClone(last),
    performance = new Map<string, Performance>();
  for (const block of blocks)
    for (const p of block.performance) {
      const prior = performance.get(p.id);
      if (prior) {
        prior.damage += p.damage;
        prior.healing += p.healing;
        prior.shield += p.shield;
        prior.contribution += p.contribution;
        prior.blocks += p.blocks;
        prior.operational ||= p.operational;
        prior.endingHP = p.endingHP;
        prior.endingCharges = p.endingCharges;
        for (const [key, value] of Object.entries(p.reasons))
          prior.reasons[key] = (prior.reasons[key] ?? 0) + value;
      } else performance.set(p.id, structuredClone(p));
    }
  r.plan = structuredClone(blocks[0]!.plan);
  r.armyFingerprint = blocks[0]!.armyFingerprint;
  r.performance = [...performance.values()];
  for (const key of ['credits', 'xp', 'assetXP', 'cores'] as const)
    r[key] = blocks.reduce((sum, b) => sum + BigInt(b[key]), 0n).toString();
  r.buckets = blocks.flatMap((b) => b.buckets);
  r.discovered = [...new Set(blocks.flatMap((b) => b.discovered))];
  r.seconds = blocks.reduce((n, b) => n + b.seconds, 0);
  r.events = blocks.flatMap((b) => b.events).slice(0, 100);
  r.bonuses = [...new Set(blocks.flatMap((b) => b.bonuses))];
  r.killed = {};
  r.heatmap = Array<number>(36).fill(0);
  r.timeline = [];
  let offset = 0;
  for (const block of blocks) {
    for (const [id, count] of Object.entries(block.killed))
      r.killed[id] = (r.killed[id] ?? 0) + count;
    block.heatmap.forEach((value, i) => {
      r.heatmap[i] = (r.heatmap[i] ?? 0) + value;
    });
    r.timeline.push(...block.timeline.map((v) => ({ ...v, second: v.second + offset })));
    offset += block.seconds;
  }
  r.wrecks = r.performance.filter((p) => p.endingHP === 0).length;
  return r;
}
