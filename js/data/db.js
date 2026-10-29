// Minimaler Promise-Wrapper um IndexedDB. Ein Backend bietet je Store:
// getAll(store), get(store, key), put(store, value), delete(store, key), clear(store).

const DB_NAME = 'dartcounter';
const DB_VERSION = 1;
export const STORES = ['players', 'matches', 'meta'];

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function openIndexedDb() {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('players')) db.createObjectStore('players', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('matches')) {
        const s = db.createObjectStore('matches', { keyPath: 'id' });
        s.createIndex('status', 'status');
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const tx = (store, mode) => db.transaction(store, mode).objectStore(store);
  const done = (t) => new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  return {
    getAll: (store) => req(tx(store, 'readonly').getAll()),
    get: (store, key) => req(tx(store, 'readonly').get(key)),
    put: (store, value) => req(tx(store, 'readwrite').put(value)),
    delete: (store, key) => req(tx(store, 'readwrite').delete(key)),
    clear: (store) => req(tx(store, 'readwrite').clear()),
    /** Ersetzt alle Stores atomar. */
    async replaceAll(data) {
      const t = db.transaction(STORES, 'readwrite');
      for (const s of STORES) {
        const os = t.objectStore(s);
        os.clear();
        for (const v of data[s] || []) os.put(v);
      }
      await done(t);
    },
  };
}

/** In-Memory-Backend (Tests, Fallback ohne IndexedDB). */
export function memoryDb() {
  const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  const keyOf = (store, v) => (store === 'meta' ? v.key : v.id);
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    getAll: async (store) => [...data[store].values()].map(clone),
    get: async (store, key) => clone(data[store].get(key)),
    put: async (store, value) => void data[store].set(keyOf(store, value), clone(value)),
    delete: async (store, key) => void data[store].delete(key),
    clear: async (store) => void data[store].clear(),
    async replaceAll(d) {
      for (const s of STORES) {
        data[s].clear();
        for (const v of d[s] || []) data[s].set(keyOf(s, v), clone(v));
      }
    },
  };
}
