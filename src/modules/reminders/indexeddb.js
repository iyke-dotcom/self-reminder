export const DB_NAME = "self-reminder-db";
export const STORE_NAME = "reminders";
export const DB_VERSION = 1;

export function openDb({
  name = DB_NAME,
  storeName = STORE_NAME,
  version = DB_VERSION,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = globalThis.indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDbAdapter({
  dbName = DB_NAME,
  storeName = STORE_NAME,
  version = DB_VERSION,
} = {}) {
  let dbPromise = null;
  let lastRequest = Promise.resolve();

  async function withDb() {
    dbPromise ||= openDb({ name: dbName, storeName, version });
    return dbPromise;
  }

  return {
    async load() {
      const db = await withDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        tx.onerror = () => reject(tx.error);
      });
    },
    saveAll(reminders) {
      const pending = (async () => {
        const db = await withDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          store.clear();
          reminders.forEach((reminder) => store.put(reminder));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      })();
      lastRequest = pending;
      return pending;
    },
    async flush() {
      await lastRequest;
    },
  };
}

export async function clearDb(dbName = DB_NAME) {
  if (!globalThis.indexedDB) return;
  await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
