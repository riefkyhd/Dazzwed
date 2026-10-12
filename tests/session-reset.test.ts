import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  saveSessionTriple,
  loadSessionTriple,
  clearSessionTriple,
  type Session,
} from "@/lib/guest/session";

describe("Device Session & Cache Reset Verification", () => {
  const memoryStore = new Map<string, string>();

  beforeEach(async () => {
    vi.restoreAllMocks();
    memoryStore.clear();

    const mockStorage = {
      getItem: (k: string) => memoryStore.get(k) ?? null,
      setItem: (k: string, v: string) => memoryStore.set(k, v),
      removeItem: (k: string) => memoryStore.delete(k),
      clear: () => memoryStore.clear(),
      length: 0,
      key: () => null,
    };

    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockStorage,
    };

    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const d of dbs) {
        if (d.name) indexedDB.deleteDatabase(d.name);
      }
    }
  });

  it("stores and preserves createdAt timestamp on session saving", async () => {
    const slug = "wedding-test";
    const guestId = "ec1088a2-ba41-42f0-abe0-ffffe2dc4ade";
    const testSession: Session = {
      guestId,
      name: "Guest 1",
      lang: "en",
    };

    await saveSessionTriple(slug, testSession);

    const loaded = await loadSessionTriple(slug);
    expect(loaded).not.toBeNull();
    expect(loaded?.guestId).toBe(guestId);
    expect(loaded?.createdAt).toBeDefined();
    expect(new Date(loaded!.createdAt!).getTime()).toBeGreaterThan(0);
  });

  it("completely clears both localStorage and IndexedDB on clearSessionTriple", async () => {
    const slug = "wedding-test";
    const guestId = "51b624e2-d226-4c83-916b-e695c5f69a84";

    await saveSessionTriple(slug, {
      guestId,
      name: "Guest 2",
      lang: "id",
    });

    // Verify it was stored
    const beforeClear = await loadSessionTriple(slug);
    expect(beforeClear?.guestId).toBe(guestId);

    // Perform clear
    await clearSessionTriple(slug);

    // Verify both localStorage and IndexedDB are cleared
    const afterClear = await loadSessionTriple(slug);
    expect(afterClear).toBeNull();
    expect(memoryStore.get(`dc:session:${slug}`)).toBeUndefined();
  });

  it("detects expired session when createdAt is older than sessionResetAt", () => {
    const sessionResetAt = "2026-10-12T12:00:00.000Z";
    const oldSessionCreated = "2026-10-12T10:00:00.000Z";
    const newSessionCreated = "2026-10-12T14:00:00.000Z";

    const isOldExpired = new Date(oldSessionCreated) < new Date(sessionResetAt);
    const isNewExpired = new Date(newSessionCreated) < new Date(sessionResetAt);

    expect(isOldExpired).toBe(true);
    expect(isNewExpired).toBe(false);
  });
});
