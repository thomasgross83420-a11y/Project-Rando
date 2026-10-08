/** Test-only bundle. The production entry never imports this module. */
import { newGame, maxHealth, FULL_VERSION } from '../src/game/model';
import { guidedLayout } from '../src/game/construction';
import { definition } from '../src/game/catalog';
import { validateSnapshot } from '../src/game/validation';
import { compile } from '../src/game/director';
import { FullBattle } from '../src/game/engine';
import { priceResult } from '../src/game/economy';
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('resonance-bastion-full-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function seed(advanced = false, pending = false) {
  const s = newGame(
    advanced ? 'Complete review' : 'Browser integration',
    0,
    'Bastion',
    'warden.bulwark',
  );
  if (advanced) {
    s.rank = 100;
    s.credits = 1000000;
    s.cores = 1000;
    s.stages = Array.from({ length: 40 }, (_, i) => i);
    for (const a of s.assets) {
      if (definition(a.type).profile) {
        a.xp = 78498;
        a.level = 100;
        a.stars = 6;
        a.branch = 'A';
        a.coresPaid = 82;
        a.hp = maxHealth(a);
      }
    }
  }
  guidedLayout(s);
  if (pending) {
    const plan = await compile({
        mode: 'Campaign',
        stage: 0,
        rank: s.rank,
        difficulty: 'Standard',
        seed: 'browser-pending',
      }),
      start = structuredClone(s),
      id = crypto.randomUUID();
    s.sequence = '1';
    s.active = {
      id,
      sequence: '1',
      epoch: s.epoch,
      plan,
      rootPlan: plan,
      engine: null,
      start,
      completed: [],
      block: 1,
      signatures: {},
      signatureShots: {},
    };
    const b = await FullBattle.create(start, plan);
    for (let i = 0; i < 18000 && !b.outcome; i++) b.step();
    s.pending = priceResult(start, b.result(id, '1'));
  }
  validateSnapshot(s);
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['campaigns'], 'readwrite');
    tx.objectStore('campaigns').put(s, s.slot);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  database.close();
  return s;
}
export async function read() {
  const database = await db();
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = database.transaction('campaigns', 'readonly'),
      r = tx.objectStore('campaigns').get(0);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  database.close();
  return validateSnapshot(value);
}
export { FULL_VERSION };
