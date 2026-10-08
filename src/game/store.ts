import { Database } from '../persistence/database';
import { parseBackupJSON } from '../persistence/json';
import { hash } from '../sim/determinism';
import { FULL_VERSION, type GameState } from './model';
import { planDigest, validatePlan } from './director';
import { validateSnapshot } from './validation';
interface Envelope {
  format: 'resonance-bastion-backup';
  version: typeof FULL_VERSION;
  campaign: GameState;
  checksum: string;
}
interface Writer {
  id: string;
  generation: number;
  expires: number;
  lockManaged: boolean;
}
type Fence = Pick<
  GameState,
  | 'sequence'
  | 'finalized'
  | 'epoch'
  | 'retired'
  | 'stages'
  | 'trials'
  | 'discoveries'
  | 'generatedClaims'
  | 'receipts'
  | 'generatedBonusClosed'
>;
export class FullStore {
  private db: Database;
  private writer = crypto.randomUUID();
  private generation = 0;
  private held = false;
  private lockHeld = false;
  private lockAttempted = false;
  private releaseLock: (() => void) | undefined;
  readonly errors = new Map<number, string>();
  private constructor(db: IDBDatabase) {
    this.db = new Database(db);
  }
  static async open(): Promise<FullStore> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      let ended = false;
      const timer = setTimeout(() => {
        ended = true;
        reject(new Error('Storage opening timed out. Retry or choose Temporary Session.'));
      }, 10000);
      const r = indexedDB.open('resonance-bastion-full-v1', 1);
      r.onupgradeneeded = () => {
        for (const s of ['campaigns', 'previous', 'meta', 'writer', 'fences'])
          r.result.createObjectStore(s);
      };
      r.onsuccess = () => {
        clearTimeout(timer);
        if (ended) {
          r.result.close();
          return;
        }
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => {
        clearTimeout(timer);
        reject(r.error);
      };
      r.onblocked = () => {
        clearTimeout(timer);
        ended = true;
        reject(new Error('Close another game tab and retry storage'));
      };
    });
    const store = new FullStore(db);
    await store.db.probe();
    return store;
  }
  async list(): Promise<GameState[]> {
    const values = await this.db.transaction<unknown[]>(['campaigns'], 'readonly', (tx, done) => {
      const r = tx.objectStore('campaigns').getAll();
      r.onsuccess = () => done(r.result);
    });
    this.errors.clear();
    const valid: GameState[] = [];
    for (const value of values) {
      try {
        valid.push(validateSnapshot(value));
      } catch (e) {
        const slot =
          value && typeof value === 'object' && 'slot' in value ? Number(value.slot) : -1;
        this.errors.set(slot, e instanceof Error ? e.message : String(e));
      }
    }
    return valid;
  }
  async takeWriter(force = false): Promise<boolean> {
    if (!this.lockAttempted && navigator.locks) {
      this.lockAttempted = true;
      await new Promise<void>((resolve, reject) => {
        void navigator.locks
          .request('rb-full-writer', { mode: 'exclusive', ifAvailable: true }, async (lock) => {
            this.lockHeld = !!lock;
            resolve();
            if (lock)
              await new Promise<void>((release) => {
                this.releaseLock = release;
              });
          })
          .catch(reject);
      });
    }
    return this.db.transaction(['writer'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('writer'),
        r = store.get('owner');
      r.onsuccess = () => {
        const old = r.result as Writer | undefined;
        if (!force && old && old.id !== this.writer && !(this.lockHeld && old.lockManaged)) {
          this.held = false;
          done(false);
          return;
        }
        this.generation = (old?.generation ?? 0) + (old?.id === this.writer ? 0 : 1);
        store.put(
          {
            id: this.writer,
            generation: this.generation,
            expires: Date.now() + 20000,
            lockManaged: this.lockHeld,
          },
          'owner',
        );
        this.held = true;
        done(true);
      };
    });
  }
  async heartbeat(): Promise<void> {
    if (!this.held) return;
    const valid = await this.db.transaction<boolean>(['writer'], 'readwrite', (tx, done) => {
      const r = tx.objectStore('writer').get('owner');
      r.onsuccess = () => {
        const old = r.result as Writer | undefined;
        if (!this.owns(old)) {
          this.held = false;
          this.releaseLock?.();
          this.lockHeld = false;
          done(false);
          return;
        }
        tx.objectStore('writer').put({ ...old, expires: Date.now() + 20000 }, 'owner');
        done(true);
      };
    });
    if (!valid) throw new Error('Another tab owns editing');
  }
  private owns(value: Writer | undefined): boolean {
    return this.held && value?.id === this.writer && value.generation === this.generation;
  }
  async save(s: GameState): Promise<void> {
    validateSnapshot(s);
    if (new TextEncoder().encode(JSON.stringify(s)).length > 30 * 1024 * 1024)
      throw new Error(
        'Detailed record storage is full. Export a backup, then remove old practice comparisons or unfavorite archived plans.',
      );
    if (!this.held) throw new Error('This tab is read only. Take over editing from Title.');
    const expected = s.revision,
      next = { ...structuredClone(s), revision: expected + 1, updated: Date.now() };
    await this.db.transaction(
      ['campaigns', 'previous', 'writer', 'fences'],
      'readwrite',
      (tx, done) => {
        const owner = tx.objectStore('writer').get('owner');
        owner.onsuccess = () => {
          if (!this.owns(owner.result as Writer | undefined)) {
            this.held = false;
            tx.abort();
            return;
          }
          const store = tx.objectStore('campaigns'),
            get = store.get(s.slot);
          get.onsuccess = () => {
            const current = get.result as GameState | undefined;
            if (current?.id === s.id && current.revision !== expected) {
              tx.abort();
              return;
            }
            const fence = tx.objectStore('fences').get(s.id);
            fence.onsuccess = () => {
              const old = fence.result as Fence | undefined;
              if (
                old &&
                (old.epoch > s.epoch ||
                  (old.epoch === s.epoch && BigInt(old.finalized) > BigInt(s.finalized)))
              ) {
                tx.abort();
                return;
              }
              if (current) tx.objectStore('previous').put(current, s.slot);
              store.put(next, s.slot);
              const f: Fence = {
                sequence: next.sequence,
                finalized: next.finalized,
                epoch: next.epoch,
                retired: next.retired,
                stages: next.stages,
                trials: next.trials,
                discoveries: next.discoveries,
                generatedClaims: next.generatedClaims,
                receipts: next.receipts,
                generatedBonusClosed: next.generatedBonusClosed,
              };
              tx.objectStore('fences').put(f, s.id);
              tx.objectStore('writer').put(
                {
                  id: this.writer,
                  generation: this.generation,
                  expires: Date.now() + 20000,
                  lockManaged: this.lockHeld,
                },
                'owner',
              );
              done(undefined);
            };
          };
        };
      },
    );
    s.revision = next.revision;
    s.updated = next.updated;
  }
  async previous(slot: number): Promise<GameState | undefined> {
    const value = await this.db.read<unknown>('previous', slot);
    return value === undefined ? undefined : validateSnapshot(value);
  }
  async restore(incoming: GameState): Promise<GameState> {
    const s = validateSnapshot(structuredClone(incoming));
    const local = (await this.list()).find((v) => v.id === s.id);
    if (local?.pending && local.pending.id !== s.pending?.id)
      throw new Error('Resolve the locally retained pending result before replacing it');
    const fence = await this.db.read<Fence>('fences', s.id);
    if (fence) {
      if (s.epoch < fence.epoch) {
        s.epoch = fence.epoch;
        s.retired = fence.retired;
        s.sequence = fence.sequence;
        s.finalized = fence.finalized;
        s.active = null;
        s.pending = null;
      } else if (s.epoch === fence.epoch) {
        s.finalized = BigInt(s.finalized) > BigInt(fence.finalized) ? s.finalized : fence.finalized;
        s.sequence = BigInt(s.sequence) > BigInt(fence.sequence) ? s.sequence : fence.sequence;
      }
      s.stages = [...new Set([...s.stages, ...fence.stages])];
      s.trials = [...new Set([...s.trials, ...fence.trials])];
      s.discoveries = [...new Set([...s.discoveries, ...fence.discoveries])];
      const generated = [...new Set([...s.generatedClaims, ...fence.generatedClaims])];
      s.generatedClaims = generated.slice(0, 4096);
      s.generatedBonusClosed =
        s.generatedBonusClosed || fence.generatedBonusClosed || generated.length >= 4096;
      s.receipts = [...new Set([...s.receipts, ...fence.receipts])].slice(-16);
      if (
        s.active &&
        (s.active.epoch !== s.epoch || BigInt(s.active.sequence) <= BigInt(s.finalized))
      )
        s.active = null;
      if (
        s.pending &&
        (s.pending.epoch !== s.epoch || BigInt(s.pending.sequence) <= BigInt(s.finalized))
      )
        s.pending = null;
    }
    if (local) s.revision = local.revision;
    else {
      const current = await this.db.read<{ id?: string; revision?: number }>('campaigns', s.slot);
      if (current?.id === s.id && Number.isSafeInteger(current.revision))
        s.revision = current.revision!;
    }
    validateSnapshot(s);
    await this.save(s);
    return s;
  }
  async remove(slot: number): Promise<void> {
    if (!this.held) throw new Error('Another tab owns editing');
    await this.db.transaction(
      ['campaigns', 'previous', 'writer', 'fences'],
      'readwrite',
      (tx, done) => {
        const r = tx.objectStore('writer').get('owner');
        r.onsuccess = () => {
          if (!this.owns(r.result as Writer | undefined)) {
            tx.abort();
            return;
          }
          const get = tx.objectStore('campaigns').get(slot);
          get.onsuccess = () => {
            if (get.result?.id) tx.objectStore('fences').delete(get.result.id);
            tx.objectStore('campaigns').delete(slot);
            tx.objectStore('previous').delete(slot);
            done(undefined);
          };
        };
      },
    );
  }
  async export(s: GameState): Promise<string> {
    const envelope: Envelope = {
      format: 'resonance-bastion-backup',
      version: FULL_VERSION,
      campaign: s,
      checksum: await hash(s),
    };
    return JSON.stringify(envelope);
  }
  async inspectImport(text: string): Promise<GameState> {
    return inspectFullBackup(text);
  }

  async legacy(): Promise<unknown[]> {
    const db = await Database.open();
    const records = await db.transaction<unknown[]>(['campaigns'], 'readonly', (tx, done) => {
      const r = tx.objectStore('campaigns').getAll();
      r.onsuccess = () => done(r.result);
    });
    db.db.close();
    return records;
  }
}

export async function inspectFullBackup(text: string): Promise<GameState> {
  const e = parseBackupJSON(text) as Envelope;
  if (
    e.format !== 'resonance-bastion-backup' ||
    e.version !== FULL_VERSION ||
    e.checksum !== (await hash(e.campaign))
  )
    throw new Error('Unsupported or corrupted backup');
  const s = validateSnapshot(e.campaign),
    plans = new Map<string, GameState['archive'][number]>();
  for (const p of [
    ...s.archive,
    ...s.history.map((r) => r.plan),
    ...s.comparisons.map((r) => r.plan),
    ...(s.watch?.offers ?? []),
    ...(s.active
      ? [s.active.rootPlan, s.active.plan, ...s.active.completed.map((r) => r.plan)]
      : []),
    ...(s.pending ? [s.pending.plan] : []),
  ]) {
    plans.set(p.hash, p);
    for (const following of p.following) plans.set(following.hash, following);
  }
  for (const p of plans.values()) {
    validatePlan(p);
    if ((await planDigest(p)) !== p.hash)
      throw new Error('Backup contains a corrupted encounter plan');
  }
  return s;
}
