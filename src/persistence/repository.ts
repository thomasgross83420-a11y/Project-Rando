import type { Database } from './database';
import { validateCampaign, type Campaign } from './campaign';
interface Writer {
  tabID: string;
  generation: number;
  leaseExpiry: number;
}
export class CampaignRepository {
  readonly tabID = crypto.randomUUID();
  writer: Writer | undefined;
  readonly memory = new Map<number, Campaign>();
  readonly temporary: boolean;
  constructor(readonly database: Database | undefined) {
    this.temporary = !database;
  }
  async acquire(takeOver = false): Promise<boolean> {
    if (!this.database) {
      this.writer = { tabID: this.tabID, generation: 1, leaseExpiry: Date.now() + 20000 };
      return true;
    }
    const writer = await this.database.transaction<Writer | undefined>(
      ['writer'],
      'readwrite',
      (tx, done) => {
        const store = tx.objectStore('writer'),
          r = store.get('active');
        r.onsuccess = () => {
          const current = r.result as Writer | undefined;
          if (current && current.tabID !== this.tabID && !takeOver) {
            done(undefined);
            return;
          }
          const next = {
            tabID: this.tabID,
            generation: (current?.generation ?? 0) + (current?.tabID === this.tabID ? 0 : 1),
            leaseExpiry: Date.now() + 20000,
          };
          store.put(next, 'active');
          done(next);
        };
      },
    );
    this.writer = writer;
    return Boolean(writer);
  }
  async heartbeat(): Promise<void> {
    if (!this.database || !this.writer) return;
    const expected = this.writer;
    await this.database.transaction(['writer'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('writer'),
        r = store.get('active');
      r.onsuccess = () => {
        const current = r.result as Writer | undefined;
        if (current?.tabID !== this.tabID || current.generation !== expected.generation) {
          this.writer = undefined;
          done(undefined);
          return;
        }
        current.leaseExpiry = Date.now() + 20000;
        store.put(current, 'active');
        done(undefined);
      };
    });
  }
  async slots(): Promise<(Campaign | Error | undefined)[]> {
    return Promise.all(
      [0, 1, 2].map(async (slot) => {
        try {
          const c = this.database
            ? await this.database.read<unknown>('campaigns', slot)
            : this.memory.get(slot);
          return c === undefined ? undefined : validateCampaign(c);
        } catch (e) {
          return e instanceof Error ? e : new Error(String(e));
        }
      }),
    );
  }
  async commit(after: Campaign, expected: Campaign | undefined): Promise<void> {
    const valid = validateCampaign(after),
      writer = this.writer;
    if (!writer) throw new Error('Another tab owns editing. This tab is read-only.');
    if (!this.database) {
      const current = this.memory.get(valid.slot);
      this.compare(current, expected);
      this.memory.set(valid.slot, structuredClone(valid));
      return;
    }
    await this.database.transaction(
      ['campaigns', 'previous', 'writer'],
      'readwrite',
      (tx, done) => {
        const campaigns = tx.objectStore('campaigns'),
          ownership = tx.objectStore('writer').get('active');
        ownership.onsuccess = () => {
          const current = ownership.result as Writer | undefined;
          if (current?.tabID !== this.tabID || current.generation !== writer.generation) {
            tx.abort();
            this.writer = undefined;
            return;
          }
          const request = campaigns.get(valid.slot);
          request.onsuccess = () => {
            try {
              const before = request.result as Campaign | undefined;
              this.compare(before, expected);
              if (before) tx.objectStore('previous').put(before, valid.slot);
              campaigns.put(valid, valid.slot);
              done(undefined);
            } catch {
              tx.abort();
            }
          };
        };
      },
    );
  }
  private compare(current: Campaign | undefined, expected: Campaign | undefined): void {
    if (current?.lineage !== expected?.lineage || current?.revision !== expected?.revision)
      throw new Error('Campaign changed. Reload before retry.');
  }
  async opened(slot: number): Promise<void> {
    if (!this.database || !this.writer) return;
    await this.database.transaction(['writer', 'meta'], 'readwrite', (tx, done) => {
      const request = tx.objectStore('writer').get('active');
      request.onsuccess = () => {
        const w = request.result as Writer | undefined;
        if (w?.tabID !== this.tabID || w.generation !== this.writer?.generation) {
          tx.abort();
          return;
        }
        tx.objectStore('meta').put(slot, 'lastOpened');
        done(undefined);
      };
    });
  }
  async lastOpened(): Promise<number | undefined> {
    return this.database?.read<number>('meta', 'lastOpened');
  }
}
export class Preparation {
  undoStack: Campaign[] = [];
  redoStack: Campaign[] = [];
  busy = false;
  constructor(
    readonly repository: CampaignRepository,
    public campaign: Campaign,
  ) {}
  async commit(after: Campaign): Promise<void> {
    if (this.busy) throw new Error('Save already in progress');
    this.busy = true;
    try {
      await this.repository.commit(after, this.campaign);
      this.undoStack.push(this.campaign);
      this.redoStack = [];
      this.campaign = after;
    } finally {
      this.busy = false;
    }
  }
  async history(kind: 'undo' | 'redo'): Promise<void> {
    if (this.busy) throw new Error('Save already in progress');
    const from = kind === 'undo' ? this.undoStack : this.redoStack,
      to = kind === 'undo' ? this.redoStack : this.undoStack,
      old = from.at(-1);
    if (!old) return;
    this.busy = true;
    try {
      const after = validateCampaign({
        ...structuredClone(old),
        revision: this.campaign.revision + 1,
      });
      await this.repository.commit(after, this.campaign);
      from.pop();
      to.push(this.campaign);
      this.campaign = after;
    } finally {
      this.busy = false;
    }
  }
}
