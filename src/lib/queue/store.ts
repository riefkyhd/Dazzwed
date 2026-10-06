/**
 * IndexedDB store for captured shots. A shot is written here the moment it is taken,
 * BEFORE any network call, so tabs closing / reloads / flaky signal can't lose it.
 * Phase 4 adds the uploader on top of this store.
 */
export type ShotStatus = "queued" | "uploading" | "synced";
export type OriginalStatus = "none" | "queued" | "uploading" | "synced";

export interface ShotRecord {
  shotId: string; // client UUID = server idempotency key
  eventSlug: string;
  guestId: string;
  blob: Blob | null; // filtered photo blob (dropped after sync)
  originalBlob?: Blob | null; // clean unfiltered original (dropped after sync)
  size: number;
  width?: number;
  height?: number;
  source?: "inapp" | "native";
  tier?: "original" | "high" | "standard" | "lite";
  filtered?: boolean;
  lookId?: string;
  lookVersion?: number;
  createdAt: number;
  status: ShotStatus;
  originalStatus?: OriginalStatus;
  attempts: number;
  originalAttempts?: number;
  nextAttemptAt: number;
  originalNextAttemptAt?: number;
}

/** Request durable browser storage so blobs are not evicted on low disk */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

const DB_NAME = "disposable-cam";
const DB_VERSION = 1;
const STORE = "shots";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "shotId" });
        s.createIndex("byGuest", "guestId");
        s.createIndex("byStatus", "status");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      // Resolve on transaction completion so writes are durable.
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error ?? req.error);
      t.onabort = () => reject(t.error ?? new Error("transaction aborted"));
    });
  } finally {
    db.close();
  }
}

export function newShotId(): string {
  return crypto.randomUUID();
}

export async function addShot(input: {
  shotId: string;
  eventSlug: string;
  guestId: string;
  blob: Blob;
  originalBlob?: Blob;
  width?: number;
  height?: number;
  source?: "inapp" | "native";
  tier?: "original" | "high" | "standard" | "lite";
  filtered?: boolean;
}): Promise<ShotRecord> {
  const rec: ShotRecord = {
    ...input,
    size: input.blob.size + (input.originalBlob ? input.originalBlob.size : 0),
    createdAt: Date.now(),
    status: "queued",
    originalStatus: input.originalBlob ? "queued" : "none",
    attempts: 0,
    originalAttempts: 0,
    nextAttemptAt: 0,
    originalNextAttemptAt: 0,
  };
  // `add` (not `put`): the same shotId can never be stored twice.
  await tx("readwrite", (s) => s.add(rec));
  return rec;
}

export async function getShot(shotId: string): Promise<ShotRecord | undefined> {
  return tx("readonly", (s) => s.get(shotId));
}

export async function listShots(guestId: string): Promise<ShotRecord[]> {
  return tx("readonly", (s) => s.index("byGuest").getAll(guestId));
}

export async function getPendingShots(guestId?: string): Promise<ShotRecord[]> {
  const db = await openDb();
  try {
    return await new Promise<ShotRecord[]>((resolve, reject) => {
      const t = db.transaction(STORE, "readonly");
      const s = t.objectStore(STORE);
      const req = s.getAll();
      req.onsuccess = () => {
        let results = (req.result || []) as ShotRecord[];
        if (guestId) {
          results = results.filter((r) => r.guestId === guestId);
        }
        // Pending if primary filtered photo is not synced yet, OR original is queued/uploading
        resolve(
          results.filter(
            (r) =>
              r.status !== "synced" ||
              (r.originalStatus && r.originalStatus !== "none" && r.originalStatus !== "synced")
          )
        );
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function countShots(guestId: string): Promise<number> {
  return tx("readonly", (s) => s.index("byGuest").count(guestId));
}

export async function updateShot(shotId: string, patch: Partial<ShotRecord>): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, "readwrite");
      const s = t.objectStore(STORE);
      const get = s.get(shotId);
      get.onsuccess = () => {
        if (get.result) s.put({ ...get.result, ...patch, shotId });
      };
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error("aborted"));
    });
  } finally {
    db.close();
  }
}

export async function pendingCount(guestId: string): Promise<number> {
  const pending = await getPendingShots(guestId);
  return pending.length;
}
