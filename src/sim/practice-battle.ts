import type { PracticeCheckpoint } from '../persistence/practice';
import { Battle } from './battle';
export async function createPracticeBattle(cp: PracticeCheckpoint): Promise<Battle> {
  return cp.schema === 2
    ? Battle.createProfiledPractice(cp.plan, cp.frozen)
    : Battle.create(cp.army, cp.plan);
}
