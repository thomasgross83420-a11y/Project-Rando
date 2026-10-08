import { Battle } from '../src/sim/battle';
import { hash } from '../src/sim/determinism';
import { tutorialArmy } from '../tests/fixtures/tutorial';
import { practiceSchema } from '../src/persistence/practice';
import { createPracticeBattle } from '../src/sim/practice-battle';
export async function runTutorial(input?: unknown): Promise<void> {
  const checkpoint = input ? practiceSchema.parse(input) : undefined;
  let expected = '';
  const results = [];
  for (const batch of checkpoint ? [12] : [1, 2, 4, 8, 12]) {
    const b = checkpoint
      ? await createPracticeBattle(checkpoint)
      : await Battle.create(tutorialArmy());
    let steps = 0;
    while ((b.state === 'Siege' || b.state === 'Cleanup') && steps++ < 21600)
      for (let i = 0; i < batch; i++) b.step();
    const identity = await hash(b.snapshot());
    if (expected && identity !== expected) throw new Error('Determinism failed');
    if (checkpoint?.terminal && identity !== checkpoint.terminal.hash)
      throw new Error('Browser checkpoint result differs from headless replay');
    expected = identity;
    results.push({
      batch,
      state: b.state,
      tick: b.tick,
      kills: b.kills,
      tp: b.destroyedTP,
      core: b.core.hp,
      hash: identity,
    });
    if (b.state !== 'Victory' || b.kills !== 24 || b.destroyedTP !== 30)
      throw new Error(`Tutorial did not clear authored plan: ${b.reason}`);
  }
  console.log(
    JSON.stringify({
      fixture: 'Real Gate2 autonomous tutorial',
      results,
      music: 'No audio dependency in authoritative simulation',
    }),
  );
}
