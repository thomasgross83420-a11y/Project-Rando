import { compile } from '../src/game/director';
import { FULL_VERSION, type Plan } from '../src/game/model';
export async function buildFullContent() {
  const plans: { file: string; plan: Plan }[] = [];
  for (const difficulty of ['Cadet', 'Standard', 'Veteran', 'Master', 'Cataclysm'] as const) {
    for (let stage = 0; stage < 40; stage++)
      plans.push({
        file: `campaign-${stage}-${difficulty}.json`,
        plan: await compile({ mode: 'Campaign', seed: 'authored', rank: 100, stage, difficulty }),
      });
    for (let trial = 0; trial < 12; trial++)
      plans.push({
        file: `mastery-${trial}-${difficulty}.json`,
        plan: await compile({ mode: 'Mastery', seed: 'authored', rank: 100, trial, difficulty }),
      });
  }
  return { version: FULL_VERSION, plans };
}
