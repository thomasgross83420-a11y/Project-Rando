export const DATABASE_NAME = 'resonance-bastion-v1';
export class Database {
  constructor(readonly db: IDBDatabase) {}
  static open(): Promise<Database> {
    return new Promise((resolve, reject) => {
      let abandoned = false;
      const fail = (error: Error | DOMException) => {
        abandoned = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(
        () =>
          fail(new Error('Storage open timed out; retry saved storage or choose temporary play')),
        10000,
      );
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DATABASE_NAME, 1);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      request.onupgradeneeded = () => {
        for (const name of ['campaigns', 'previous', 'meta', 'writer'])
          request.result.createObjectStore(name);
      };
      request.onerror = () => fail(request.error ?? new Error('Storage unavailable'));
      request.onblocked = () =>
        fail(new Error('Close other tabs to finish database upgrade, then retry'));
      request.onsuccess = () => {
        clearTimeout(timer);
        if (abandoned) {
          request.result.close();
          return;
        }
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
