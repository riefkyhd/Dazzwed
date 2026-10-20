/**
 * IndexedDB store for captured shots and offline guest gallery.
 * A shot is written here the moment it is taken, BEFORE any network call,
 * so tabs closing / reloads / flaky signal can't lose it.
 */
export type ShotStatus = "queued" | "uploading" | "synced";
export type OriginalStatus = "none" | "queued" | "uploading" | "synced";

export interface ShotRecord {
  shotId: string; // client UUID = server idempotency key
  eventSlug: string;
  guestId: string;
  blob: Blob | null; // filtered photo blob (dropped after sync)
  originalBlob?: Blob | null; // clean unfiltered original (dropped after sync)
  thumbnailBlob?: Blob | null; // permanent lightweight thumbnail for guest gallery (~1200px, WebP/JPEG)
  imageBuffer?: ArrayBuffer | null;
  mimeType?: string;
  originalBuffer?: ArrayBuffer | null;
  originalMimeType?: string;
  thumbnailBuffer?: ArrayBuffer | null;
  thumbnailMimeType?: string;
  size: number;
  width?: number;
  height?: number;
  source?: "inapp" | "native";
  tier?: "original" | "high" | "standard" | "lite";
  filtered?: boolean;
  lookId?: string;
  lookVersion?: number;
  presetId?: string;
  captureSource?: "takePhoto" | "videoFrame";
  retakenPresetIds?: string[];
  createdAt: number;
  status: ShotStatus;
  originalStatus?: OriginalStatus;
  attempts: number;
  originalAttempts?: number;
  nextAttemptAt: number;
  originalNextAttemptAt?: number;
  uploadStartedAt?: number;
  originalUploadStartedAt?: number;
}

export interface GalleryPhoto {
  shotId: string;
  guestId: string;
  createdAt: number;
  thumbnailUrl: string; // Object URL or Base64
  status: ShotStatus;
  lookId?: string;
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
const DB_VERSION = 2; // Incremented for gallery thumbnails & session stores
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
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "slug" });
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

const inMemoryFallbackShots = new Map<string, ShotRecord>();
export const activeInFlightIds = new Set<string>();

export function _resetStoreForTesting(): void {
  inMemoryFallbackShots.clear();
  activeInFlightIds.clear();
}

function deserializeRecord(raw: any): ShotRecord {
  if (!raw) return raw;
  const rec = { ...raw } as ShotRecord;
  if (!rec.blob && rec.imageBuffer) {
    rec.blob = new Blob([rec.imageBuffer], { type: rec.mimeType || "image/jpeg" });
  } else if (!rec.blob && !rec.imageBuffer) {
    rec.blob = null;
  }
  if (!rec.originalBlob && rec.originalBuffer) {
    rec.originalBlob = new Blob([rec.originalBuffer], { type: rec.originalMimeType || "image/jpeg" });
  } else if (!rec.originalBlob && !rec.originalBuffer) {
    rec.originalBlob = null;
  }
  if (!rec.thumbnailBlob && rec.thumbnailBuffer) {
    rec.thumbnailBlob = new Blob([rec.thumbnailBuffer], { type: rec.thumbnailMimeType || "image/jpeg" });
  }
  return rec;
}

export async function addShot(input: {
  shotId: string;
  eventSlug: string;
  guestId: string;
  blob: Blob;
  originalBlob?: Blob;
  thumbnailBlob?: Blob;
  width?: number;
  height?: number;
  source?: "inapp" | "native";
  tier?: "original" | "high" | "standard" | "lite";
  filtered?: boolean;
  lookId?: string;
  lookVersion?: number;
  presetId?: string;
  captureSource?: "takePhoto" | "videoFrame";
  retakenPresetIds?: string[];
}): Promise<ShotRecord> {
  let imageBuffer: ArrayBuffer | null = null;
  let originalBuffer: ArrayBuffer | null = null;
  let thumbnailBuffer: ArrayBuffer | null = null;

  try {
    imageBuffer = await input.blob.arrayBuffer();
  } catch {}

  if (input.originalBlob) {
    try {
      originalBuffer = await input.originalBlob.arrayBuffer();
    } catch {}
  }

  const thumb = input.thumbnailBlob || input.blob;
  try {
    thumbnailBuffer = await thumb.arrayBuffer();
  } catch {}

  const rec: ShotRecord = {
    ...input,
    thumbnailBlob: thumb,
    imageBuffer,
    mimeType: input.blob.type || "image/jpeg",
    originalBuffer,
    originalMimeType: input.originalBlob?.type || "image/jpeg",
    thumbnailBuffer,
    thumbnailMimeType: thumb.type || "image/jpeg",
    size: input.blob.size + (input.originalBlob ? input.originalBlob.size : 0),
    createdAt: Date.now(),
    status: "queued",
    originalStatus: input.originalBlob ? "queued" : "none",
    attempts: 0,
    originalAttempts: 0,
    nextAttemptAt: 0,
    originalNextAttemptAt: 0,
  };

  try {
    // WebKit DataCloneError safeguard: store ArrayBuffers instead of raw Blob
    const idbRec = { ...rec };
    delete (idbRec as any).blob;
    delete (idbRec as any).originalBlob;
    delete (idbRec as any).thumbnailBlob;

    await tx("readwrite", (s) => s.add(idbRec));
  } catch (err) {
    console.warn("IndexedDB addShot failed, retained in memory queue:", err);
    inMemoryFallbackShots.set(rec.shotId, rec);
  }

  return rec;
}

export async function getShot(shotId: string): Promise<ShotRecord | undefined> {
  try {
    const raw = await tx("readonly", (s) => s.get(shotId));
    if (raw) return deserializeRecord(raw);
  } catch (err) {
    console.warn("IndexedDB getShot failed, checking memory:", err);
  }
  const mem = inMemoryFallbackShots.get(shotId);
  return mem ? deserializeRecord(mem) : undefined;
}

export async function listShots(guestId: string): Promise<ShotRecord[]> {
  const map = new Map<string, ShotRecord>();
  try {
    const rawList = await tx("readonly", (s) => s.index("byGuest").getAll(guestId));
    for (const r of rawList) {
      map.set(r.shotId, deserializeRecord(r));
    }
  } catch (err) {
    console.warn("IndexedDB listShots failed, checking memory fallback:", err);
  }
  for (const [id, r] of inMemoryFallbackShots.entries()) {
    if (r.guestId === guestId && !map.has(id)) {
      map.set(id, deserializeRecord(r));
    }
  }
  return Array.from(map.values());
}

export async function getPendingShots(guestId?: string): Promise<ShotRecord[]> {
  const map = new Map<string, ShotRecord>();
  try {
    const db = await openDb();
    try {
      const results = await new Promise<ShotRecord[]>((resolve, reject) => {
        const t = db.transaction(STORE, "readonly");
        const s = t.objectStore(STORE);
        const req = s.getAll();
        req.onsuccess = () => resolve((req.result || []) as ShotRecord[]);
        req.onerror = () => reject(req.error);
      });
      for (const r of results) {
        if (!guestId || r.guestId === guestId) {
          map.set(r.shotId, deserializeRecord(r));
        }
      }
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn("IndexedDB getPendingShots failed, checking memory:", err);
  }

  for (const [id, r] of inMemoryFallbackShots.entries()) {
    if (!guestId || r.guestId === guestId) {
      if (!map.has(id)) {
        map.set(id, deserializeRecord(r));
      }
    }
  }

  const all = Array.from(map.values());
  const now = Date.now();

  // Self-heal stale "uploading" locks (e.g. from killed background tabs or phone locks > 45s)
  // ONLY reset if the shot is NOT actively in-flight in the current JavaScript runtime.
  for (const r of all) {
    let needsUpdate = false;
    const patch: Partial<ShotRecord> = {};

    if (r.status === "uploading") {
      const isActivelyRunning = activeInFlightIds.has(r.shotId);
      const isStale = !r.uploadStartedAt || now - r.uploadStartedAt > 45_000;
      if (!isActivelyRunning && isStale) {
        console.warn(
          `[getPendingShots] Detected stale 'uploading' lock for shot ${r.shotId}. Self-healing back to 'queued'.`
        );
        patch.status = "queued";
        r.status = "queued";
        needsUpdate = true;
      }
    }

    if (r.originalStatus === "uploading") {
      const isActivelyRunning = activeInFlightIds.has(`${r.shotId}:original`);
      const isStale = !r.originalUploadStartedAt || now - r.originalUploadStartedAt > 45_000;
      if (!isActivelyRunning && isStale) {
        console.warn(
          `[getPendingShots] Detected stale 'uploading' lock for original of shot ${r.shotId}. Self-healing back to 'queued'.`
        );
        patch.originalStatus = "queued";
        r.originalStatus = "queued";
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      void updateShot(r.shotId, patch);
    }
  }

  return all.filter(
    (r) =>
      r.status !== "synced" ||
      (r.originalStatus && r.originalStatus !== "none" && r.originalStatus !== "synced")
  );
}

export async function countShots(guestId: string): Promise<number> {
  const shots = await listShots(guestId);
  return shots.length;
}

export async function updateShot(shotId: string, patch: Partial<ShotRecord>): Promise<void> {
  if (inMemoryFallbackShots.has(shotId)) {
    const mem = inMemoryFallbackShots.get(shotId)!;
    inMemoryFallbackShots.set(shotId, { ...mem, ...patch });
  }

  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE, "readwrite");
        const s = t.objectStore(STORE);
        const get = s.get(shotId);
        get.onsuccess = () => {
          if (get.result) {
            const updated = { ...get.result, ...patch, shotId };
            if (patch.blob === null) {
              updated.blob = null;
              delete updated.imageBuffer;
            }
            if (patch.originalBlob === null) {
              updated.originalBlob = null;
              delete updated.originalBuffer;
            }
            s.put(updated);
          }
        };
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error("aborted"));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn("IndexedDB updateShot failed:", err);
  }
}

export async function pendingCount(guestId: string): Promise<number> {
  const pending = await getPendingShots(guestId);
  return pending.length;
}

/**
 * Retrieves all shots for this guest to render the private guest gallery.
 */
export async function getGuestGalleryPhotos(guestId: string): Promise<GalleryPhoto[]> {
  const shots = await listShots(guestId);
  // Sort reverse chronologically
  shots.sort((a, b) => b.createdAt - a.createdAt);

  return shots.map((s) => {
    const blobToUse = s.thumbnailBlob || s.blob;
    let url = "";
    if (blobToUse) {
      try {
        url = URL.createObjectURL(blobToUse);
      } catch {}
    }
    return {
      shotId: s.shotId,
      guestId: s.guestId,
      createdAt: s.createdAt,
      thumbnailUrl: url,
      status: s.status,
      lookId: s.lookId,
    };
  });
}
