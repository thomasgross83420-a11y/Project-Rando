import { combat } from '../../src/data/combat';
import type { StartAsset } from '../../src/sim/tutorial';
export function tutorialArmy(): StartAsset[] {
  return [
    ['friendly.sentry', 24, 26, 2],
    ['friendly.sentry', 24, 32, 2],
    ['friendly.rifle_squad', 22, 28, 2],
    ['warden.bulwark', 29, 33, 2],
    ['friendly.repair_node', 25, 34, 2],
    ['friendly.standard_barricade', 22, 26, 1],
    ['friendly.proximity_mine', 18, 24, 1],
  ].map((v, i) => {
    const [type, x, y, width] = v as [keyof typeof combat, number, number, number];
    return {
      uuid: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      type,
      heading: 0,
      x,
      y,
      width,
      height: width,
      hp: combat[type].hp,
    };
  });
}
