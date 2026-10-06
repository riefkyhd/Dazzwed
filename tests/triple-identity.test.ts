import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  saveSession,
  loadSession,
  saveSessionTriple,
  loadSessionTriple,
  computeRollCodeFromGuestId,
  type Session,
} from "@/lib/guest/session";

describe("Triple-Healed Guest Session Resilience", () => {
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

  it("stores and restores session with auto-derived roll code", () => {
    const slug = "wedding-2026";
    const guestId = "51b624e2-d226-4c83-916b-e695c5f69a84";
    const initialSession: Session = {
      guestId,
      name: "Uncle Bob",
      lang: "en",
    };

    saveSession(slug, initialSession);

    const loaded = loadSession(slug);
    expect(loaded).not.toBeNull();
    expect(loaded?.guestId).toBe(guestId);
    expect(loaded?.name).toBe("Uncle Bob");
    expect(loaded?.rollCode).toBe(computeRollCodeFromGuestId(guestId));
    expect(loaded?.rollCode).toHaveLength(6);
  });

  it("survives and recovers when rollCode was explicitly set", () => {
    const slug = "wedding-2026";
    const guestId = "ec1088a2-ba41-42f0-abe0-ffffe2dc4ade";
    const explicitCode = "7K9X2B";

    saveSession(slug, {
      guestId,
      name: "Riefky",
      lang: "id",
      rollCode: explicitCode,
    });

    const loaded = loadSession(slug);
    expect(loaded?.rollCode).toBe(explicitCode);
  });

  it("heals localStorage from IndexedDB when localStorage was cleared", async () => {
    const slug = "our-wedding";
    const guestId = "d4f6a019-a95c-4cc3-944b-3602fff1f39a";

    // 1. Save via triple-healing (writes to localStorage & IndexedDB)
    await saveSessionTriple(slug, {
      guestId,
      name: "Guestyyy",
      lang: "en",
      rollCode: computeRollCodeFromGuestId(guestId),
    });

    // 2. Simulate user clearing cookies / localStorage
    memoryStore.clear();
    expect(loadSession(slug)).toBeNull();

    // 3. loadSessionTriple reads from IndexedDB and heals localStorage
    const restored = await loadSessionTriple(slug);
    expect(restored).not.toBeNull();
    expect(restored?.guestId).toBe(guestId);

    // 4. Verify localStorage has now been healed
    const healed = loadSession(slug);
    expect(healed?.guestId).toBe(guestId);
  });
});
