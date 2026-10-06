import type { Lang } from "@/lib/i18n";

export interface Session {
  guestId: string;
  name: string | null;
  lang: Lang;
  rollCode?: string;
}

const key = (slug: string) => `dc:session:${slug}`;
const nativeKey = (slug: string) => `dc:native:${slug}`;
const uncleanKey = (slug: string) => `dc:active:${slug}`;

// Crockford Base32 alphabet: 32 chars without 0, 1, I, O
export const ROLL_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates or derives a deterministic, collision-resistant 6-character roll code
 * from a guest UUID.
 */
export function computeRollCodeFromGuestId(guestId: string): string {
  const clean = guestId.replace(/-/g, "");
  let code = "";
  for (let i = 0; i < 6; i++) {
    const chunk = clean.slice(i * 5, (i + 1) * 5) || clean.slice(0, 5);
    let val = 0;
    for (let j = 0; j < chunk.length; j++) {
      val = (val * 31 + chunk.charCodeAt(j)) >>> 0;
    }
    code += ROLL_CHARS[val % 32];
  }
  return code;
}

/**
 * Normalizes user-entered roll code:
 * - uppercase
 * - strips dashes/spaces
 * - heals common typos: '0' -> 'O', '1' -> 'L', 'I' -> 'L'
 */
export function normalizeRollCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/0/g, "O")
    .replace(/[1I]/g, "L")
    .slice(0, 6);
}

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode / blocked storage
  }
}

export function loadSession(slug: string): Session | null {
  try {
    const raw = ls()?.getItem(key(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (typeof s.guestId === "string") {
      if (!s.rollCode) {
        s.rollCode = computeRollCodeFromGuestId(s.guestId);
      }
      return s;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(slug: string, s: Session): void {
  try {
    if (!s.rollCode && s.guestId) {
      s.rollCode = computeRollCodeFromGuestId(s.guestId);
    }
    ls()?.setItem(key(slug), JSON.stringify(s));
  } catch {
    /* storage full/blocked: server cookie still identifies the guest */
  }
}

// IndexedDB session backup store
const DB_NAME = "disposable-cam";
const STORE_SESSIONS = "sessions";

function openSessionDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: "slug" });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // If store didn't exist in existing version, handle gracefully
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const v = db.version + 1;
          db.close();
          const upReq = indexedDB.open(DB_NAME, v);
          upReq.onupgradeneeded = () => {
            if (!upReq.result.objectStoreNames.contains(STORE_SESSIONS)) {
              upReq.result.createObjectStore(STORE_SESSIONS, { keyPath: "slug" });
            }
          };
          upReq.onsuccess = () => resolve(upReq.result);
          upReq.onerror = () => resolve(null);
        } else {
          resolve(db);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Triple-healing save: writes to localStorage and IndexedDB.
 */
export async function saveSessionTriple(slug: string, s: Session): Promise<void> {
  saveSession(slug, s);
  try {
    const db = await openSessionDb();
    if (!db) return;
    const t = db.transaction(STORE_SESSIONS, "readwrite");
    t.objectStore(STORE_SESSIONS).put({ slug, ...s });
  } catch {
    // Non-critical background failure
  }
}

/**
 * Triple-healing load: if localStorage is missing, reads from IndexedDB and heals localStorage.
 */
export async function loadSessionTriple(slug: string): Promise<Session | null> {
  const fromLs = loadSession(slug);
  if (fromLs) {
    // Background heal to IndexedDB
    void saveSessionTriple(slug, fromLs);
    return fromLs;
  }

  // Attempt reading from IndexedDB
  try {
    const db = await openSessionDb();
    if (!db) return null;
    return await new Promise<Session | null>((resolve) => {
      const t = db.transaction(STORE_SESSIONS, "readonly");
      const req = t.objectStore(STORE_SESSIONS).get(slug);
      req.onsuccess = () => {
        if (req.result && typeof req.result.guestId === "string") {
          const s: Session = {
            guestId: req.result.guestId,
            name: req.result.name ?? null,
            lang: req.result.lang ?? "en",
            rollCode: req.result.rollCode || computeRollCodeFromGuestId(req.result.guestId),
          };
          // Heal localStorage
          saveSession(slug, s);
          resolve(s);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function markNativePending(slug: string): void {
  try {
    ls()?.setItem(nativeKey(slug), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearNativePending(slug: string): void {
  try {
    ls()?.removeItem(nativeKey(slug));
  } catch {
    /* ignore */
  }
}

export function wasNativePending(slug: string): boolean {
  try {
    return !!ls()?.getItem(nativeKey(slug));
  } catch {
    return false;
  }
}

/** Records active session so OS kills/crashes can display welcome back banner */
export function markSessionActive(slug: string): void {
  try {
    ls()?.setItem(uncleanKey(slug), "1");
  } catch {}
}

export function clearSessionActive(slug: string): void {
  try {
    ls()?.removeItem(uncleanKey(slug));
  } catch {}
}

export function wasUncleanExit(slug: string): boolean {
  try {
    const val = ls()?.getItem(uncleanKey(slug));
    return val === "1";
  } catch {
    return false;
  }
}
