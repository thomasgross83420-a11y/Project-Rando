export const DATABASE_NAME = 'resonance-bastion-v1';
export class Database {
  constructor(readonly db: IDBDatabase) {}
  static open(): Promise<Database> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        for (const name of ['campaigns', 'previous', 'meta', 'writer'])
          request.result.createObjectStore(name);
      };
      request.onerror = () => reject(request.error ?? new Error('Storage unavailable'));
      request.onblocked = () => reject(new Error('Close other tabs to finish database upgrade'));
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(new Database(request.result));
      };
    });
  }
  transaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction, result: (value: T) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, mode);
      let value: T;
      const timer = setTimeout(() => {
        try {
          tx.abort();
        } catch {
          /* Reconcile caller state after uncertain timeout. */
        }
        reject(new Error('Storage transaction timed out; reload before retry'));
      }, 10000);
      tx.oncomplete = () => {
        clearTimeout(timer);
        resolve(value);
      };
      tx.onabort = () => {
        clearTimeout(timer);
        reject(tx.error ?? new Error('Storage transaction aborted'));
      };
      tx.onerror = () => {
        /* onabort owns rejection. */
      };
      try {
        work(tx, (v) => {
          value = v;
        });
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  }
  async read<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return this.transaction<T | undefined>([store], 'readonly', (tx, result) => {
      const r = tx.objectStore(store).get(key);
      r.onsuccess = () => result(r.result as T | undefined);
    });
  }
  async probe(): Promise<void> {
    await this.transaction(['meta'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('meta');
      store.put('ok', 'probe');
      store.delete('probe');
      done(undefined);
    });
  }
}
