// Minimal IndexedDB layer. Every collection is an object store keyed by `id`.
// Audio uploads are stored as Blobs in the `files` store.

const DB_NAME = 'lumiere-content-hq';
const DB_VERSION = 1;
export const STORES = ['ideas', 'shoots', 'posts', 'sounds', 'metrics', 'followers', 'notes', 'files', 'meta'];

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  getAll: store => tx(store, 'readonly', s => s.getAll()),
  get: (store, id) => tx(store, 'readonly', s => s.get(id)),
  put: (store, value) => tx(store, 'readwrite', s => s.put(value)),
  delete: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
  clear: store => tx(store, 'readwrite', s => s.clear()),
  async bulkPut(store, values) {
    return tx(store, 'readwrite', s => { for (const v of values) s.put(v); });
  },
};
