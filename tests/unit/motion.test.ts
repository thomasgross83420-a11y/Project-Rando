import { describe, expect, it } from 'vitest';
import { combat } from '../../src/data/combat';
import { actorAnimationFrame } from '../../src/render/animation';
import { MotionTracker } from '../../src/render/motion';
import { Battle } from '../../src/sim/battle';
import { hash } from '../../src/sim/determinism';

async function actor() {
  const b = await Battle.create([]);
  return {
    ...b.core,
    id: 3,
    type: 'enemy.runner' as const,
    hp: combat['enemy.runner'].hp,
    maxHP: combat['enemy.runner'].hp,
  };
}
describe('distance-driven cosmetic motion', () => {
  it('freezes while blocked or paused and advances proportionally to distance, not elapsed time', async () => {
    const e = await actor(),
      m = new MotionTracker();
    m.observe([e], 0);
    e.x += 307;
    e.lastMove = 6;
    m.observe([e], 6);
    expect(m.sample(e.id)).toBe(5);
    expect(m.sample(e.id, 0)).toBe(0);
    m.observe([e], 600);
    expect(m.sample(e.id)).toBe(5);
    e.x += 307;
    e.lastMove = 601;
    m.observe([e], 601);
    expect(m.sample(e.id)).toBe(11);
    expect(actorAnimationFrame(e, 601, 0, false, m.sample(e.id)).frame).toBe(1);
    expect(actorAnimationFrame(e, 601, 3, true, m.sample(e.id)).frame).toBe(1);
  });
  it('does not treat dash displacement or dead body movement as a walking stride', async () => {
    const e = await actor(),
      m = new MotionTracker();
    m.observe([e], 0);
    e.dash = { end: 30, recipient: 1, point: { x: e.x, y: e.y }, heading: 0 };
    e.x += 307;
    e.lastMove = 1;
    m.observe([e], 1);
    expect(m.sample(e.id)).toBe(0);
    e.dash = null;
    e.hp = 0;
    e.x += 307;
    e.lastMove = 2;
    m.observe([e], 2);
    expect(m.sample(e.id)).toBe(0);
  });
  it('retains gait phase through turns and repeated sampling without mutating battle state', async () => {
    const b = await Battle.create([]),
      m = new MotionTracker(),
      before = await hash(b.snapshot());
    m.observe(b.entities, b.tick);
    for (let i = 0; i < 50; i++) m.sample(b.core.id, i / 50);
    expect(await hash(b.snapshot())).toBe(before);
    const e = await actor();
    m.observe([e], 0);
    e.x += 615;
    e.lastMove = 1;
    m.observe([e], 1);
    const phase = m.sample(e.id);
    e.heading = 16384;
    m.observe([e], 2);
    expect(m.sample(e.id)).toBe(phase);
    m.observe([e], 0);
    expect(m.sample(e.id)).toBe(0);
  });
});
