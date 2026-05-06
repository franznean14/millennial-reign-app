"use client";

// Minimal IndexedDB helpers for caching and an outbox.
// Serialized read/write transactions avoid Safari/WebKit flakes and Blink
// UnknownError ("Failed to delete record from object store") under concurrent
// cacheSet/cacheDelete bursts from home summary, profile, theme, etc.

type OutboxItem = {
  id?: number;
  type: "upsert_profile" | "upsert_daily" | "delete_daily" | "add_bible_study_with_visit" | "delete_bible_study_with_visit";
  payload: any;
  createdAt: number;
};

const DB_NAME = "mr-app";
const DB_VERSION = 1;
const CACHE_STORE = "cache";
const OUTBOX_STORE = "outbox";

let dbSingleton: Promise<IDBDatabase> | null = null;

function resetDbSingleton() {
  dbSingleton = null;
}

function ensureDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB is not supported in this environment"));
  }
  if (dbSingleton) return dbSingleton;
  dbSingleton = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
      if (!db.objectStoreNames.contains(OUTBOX_STORE))
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => resetDbSingleton();
      db.onversionchange = () => {
        db.close();
        resetDbSingleton();
      };
      resolve(db);
    };
    req.onerror = () => {
      resetDbSingleton();
      reject(req.error);
    };
    req.onblocked = () => {
      console.warn('[mr-app] IndexedDB "mr-app" open blocked; close other tabs using the app.');
    };
  });
  return dbSingleton;
}

/** Serialized chain so only one readwrite transaction runs at a time per DB. */
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(run: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(() => run(), () => run());
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  const db = await ensureDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readonly");
    let value: T | undefined;
    tx.onerror = () => reject(tx.error ?? new Error("cacheGet transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("cacheGet transaction aborted"));
    tx.oncomplete = () => resolve(value ?? null);
    const store = tx.objectStore(CACHE_STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      value = req.result as T | undefined;
    };
    req.onerror = () => reject(req.error ?? tx.error);
  });
}

export async function cacheSet(key: string, value: any): Promise<void> {
  return enqueueWrite(
    () =>
      new Promise((resolve, reject) => {
        void ensureDb().then(
          (db) => {
            const tx = db.transaction(CACHE_STORE, "readwrite");
            tx.onerror = () => reject(tx.error ?? new Error("cacheSet transaction failed"));
            tx.onabort = () => reject(tx.error ?? new Error("cacheSet transaction aborted"));
            tx.oncomplete = () => resolve();
            const store = tx.objectStore(CACHE_STORE);
            const req = store.put(value, key);
            req.onerror = () => reject(req.error ?? tx.error);
          },
          reject
        );
      })
  );
}

export async function cacheDelete(key: string): Promise<void> {
  return enqueueWrite(
    () =>
      new Promise((resolve, reject) => {
        void ensureDb().then(
          (db) => {
            const tx = db.transaction(CACHE_STORE, "readwrite");
            tx.onerror = () => reject(tx.error ?? new Error("cacheDelete transaction failed"));
            tx.onabort = () => reject(tx.error ?? new Error("cacheDelete transaction aborted"));
            tx.oncomplete = () => resolve();
            const store = tx.objectStore(CACHE_STORE);
            const req = store.delete(key);
            req.onerror = () => reject(req.error ?? tx.error);
          },
          reject
        );
      })
  );
}

export async function outboxEnqueue(item: Omit<OutboxItem, "id" | "createdAt">) {
  return enqueueWrite(
    () =>
      new Promise<number>((resolve, reject) => {
        void ensureDb().then(
          (db) => {
            const entry: OutboxItem = { ...item, createdAt: Date.now() };
            const tx = db.transaction(OUTBOX_STORE, "readwrite");
            let newId: number | undefined;
            tx.onerror = () => reject(tx.error ?? new Error("outboxEnqueue transaction failed"));
            tx.onabort = () => reject(tx.error ?? new Error("outboxEnqueue transaction aborted"));
            tx.oncomplete = () => {
              if (newId !== undefined) resolve(newId);
              else reject(new Error("outbox enqueue missing auto-increment key"));
            };
            const store = tx.objectStore(OUTBOX_STORE);
            const req = store.add(entry);
            req.onsuccess = () => {
              newId = req.result as number;
            };
            req.onerror = () => reject(req.error ?? tx.error);
          },
          reject
        );
      })
  );
}

export async function outboxReadAll(): Promise<OutboxItem[]> {
  const db = await ensureDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    let rows: OutboxItem[] | undefined;
    tx.onerror = () => reject(tx.error ?? new Error("outboxReadAll transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("outboxReadAll transaction aborted"));
    tx.oncomplete = () => resolve(rows ?? []);
    const store = tx.objectStore(OUTBOX_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      rows = (req.result as OutboxItem[]) ?? [];
    };
    req.onerror = () => reject(req.error ?? tx.error);
  });
}

export async function outboxRemove(id: number) {
  return enqueueWrite(
    () =>
      new Promise<void>((resolve, reject) => {
        void ensureDb().then(
          (db) => {
            const tx = db.transaction(OUTBOX_STORE, "readwrite");
            tx.onerror = () => reject(tx.error ?? new Error("outboxRemove transaction failed"));
            tx.onabort = () => reject(tx.error ?? new Error("outboxRemove transaction aborted"));
            tx.oncomplete = () => resolve();
            const store = tx.objectStore(OUTBOX_STORE);
            const req = store.delete(id);
            req.onerror = () => reject(req.error ?? tx.error);
          },
          reject
        );
      })
  );
}
