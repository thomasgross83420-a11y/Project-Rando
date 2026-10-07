import { Battle, type Entity } from '../src/sim/battle';
import { angleError, bearing, direction, distance, H, TRIG, U } from '../src/sim/fixed';
import { combat } from '../src/data/combat';
import { tutorialArmy } from '../tests/fixtures/tutorial';
export async function measureMovement() {
  let worstHeadingError = 0;
  for (let h = 0; h < H; h++)
    worstHeadingError = Math.max(worstHeadingError, angleError(h, bearing(direction(h, TRIG))));
  if (worstHeadingError) throw new Error('Pinned full-circle heading failure');
  const b = await Battle.create(tutorialArmy().filter((a) => a.type === 'friendly.rifle_squad'));
  const e = b.entities.find((e) => e.type === 'friendly.rifle_squad');
  if (!e) throw new Error('Missing mobile fixture');
  const solver = b as unknown as { move(actor: Entity): void },
    assets = [];
  for (const type of [
    'friendly.rifle_squad',
    'warden.bulwark',
    'enemy.runner',
    'enemy.raider',
  ] as const) {
    const samples = [];
    for (let i = 0; i < 48; i++) {
      const heading = Math.round(((i + 0.37) * H) / 48);
      e.type = type;
      e.radius = combat[type].radius;
      e.hp = combat[type].hp;
      e.x = 20 * U;
      e.y = 20 * U;
      e.carryX = 0;
      e.carryY = 0;
      e.lastProgress = b.tick;
      e.lastMove = b.tick;
      e.progressPoint = { x: e.x, y: e.y };
      const start = { x: e.x, y: e.y },
        v = direction(heading, 5 * U);
      e.goal = { x: e.x + v.x, y: e.y + v.y };
      for (let tick = 0; tick < 60; tick++) {
        b.tick++;
        solver.move(e);
      }
      const travelled = distance(start, e),
        angularError = angleError(heading, bearing({ x: e.x - start.x, y: e.y - start.y }));
      if (Math.abs(travelled - combat[type].speed) >= 4 || angularError >= 16)
        throw new Error('Movement direction/speed mismatch');
      samples.push({
        heading,
        degrees: (heading * 360) / H,
        xGU: (e.x - start.x) / U,
        yGU: (e.y - start.y) / U,
        travelGU: travelled / U,
        angularError,
      });
    }
    assets.push({ type, nominalSpeedGU: combat[type].speed / U, samples });
  }
  return {
    date: '2026-10-07',
    headingsChecked: H,
    worstHeadingError,
    anglesPerAsset: 48,
    assets,
    source:
      'Isolated actual production movement solver; target/ability decisions excluded. Autonomous anchor travel and camera mapping separately verified by unit tests.',
    limits:
      'No physical-device or natural-foot-contact certification; eight drawn facings do not restrict arbitrary world travel.',
  };
}
