import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { addShot, getShot, getPendingShots } from "@/lib/queue/store";
import { uploadQueue } from "@/lib/queue/uploader";

describe("Upload Queue Engine", () => {
  const guestId = "guest-queue-1";
  const slug = "wedding-slug";

  beforeEach(async () => {
    vi.restoreAllMocks();
    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const d of dbs) {
        if (d.name) indexedDB.deleteDatabase(d.name);
      }
    }
  });

  it("uploads queued shots and drops blob after confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, duplicate: true, driveFileId: "drive-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock;

    const blob = new Blob(["sample-photo-bytes"], { type: "image/jpeg" });
    await addShot({ shotId: "shot-queue-1", eventSlug: slug, guestId, blob });

    const initialPending = await getPendingShots(guestId);
    expect(initialPending.length).toBe(1);

    // Trigger queue drain and wait for in-flight tasks
    uploadQueue.drain();
    await new Promise((r) => setTimeout(r, 60));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const shot = await getShot("shot-queue-1");
    expect(shot?.status).toBe("synced");
    expect(shot?.blob).toBeNull(); // Blob dropped to free memory

    const pendingAfter = await getPendingShots(guestId);
    expect(pendingAfter.length).toBe(0);
  });

  it("strictly enforces max 2 concurrent uploads", async () => {
    let activeFetches = 0;
    let maxSeenParallel = 0;

    const fetchMock = vi.fn().mockImplementation(async () => {
      activeFetches++;
      maxSeenParallel = Math.max(maxSeenParallel, activeFetches);
      // Simulate network latency
      await new Promise((r) => setTimeout(r, 40));
      activeFetches--;
      return new Response(JSON.stringify({ ok: true, duplicate: true, driveFileId: "drive-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    global.fetch = fetchMock;

    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    for (let i = 1; i <= 6; i++) {
      await addShot({ shotId: `concurrency-shot-${i}`, eventSlug: slug, guestId, blob });
    }

    uploadQueue.drain();

    // Wait until all 6 shots complete
    for (let check = 0; check < 40; check++) {
      await new Promise((r) => setTimeout(r, 30));
      const remaining = await getPendingShots(guestId);
      if (remaining.length === 0) break;
    }

    expect(maxSeenParallel).toBeLessThanOrEqual(2);
    expect(fetchMock).toHaveBeenCalledTimes(6);

    const remaining = await getPendingShots(guestId);
    expect(remaining.length).toBe(0);
  });

  it("retries with backoff and Retry-After header on HTTP 503", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Storage unavailable" }), {
        status: 503,
        headers: { "Retry-After": "10" },
      }),
    );
    global.fetch = fetchMock;

    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    await addShot({ shotId: "retry-shot-1", eventSlug: slug, guestId, blob });

    uploadQueue.drain();
    await new Promise((r) => setTimeout(r, 60));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const shot = await getShot("retry-shot-1");
    expect(shot?.status).toBe("queued");
    expect(shot?.attempts).toBe(1);
    // Respects Retry-After 10 seconds => nextAttemptAt >= Date.now() + 9000
    expect(shot?.nextAttemptAt).toBeGreaterThan(Date.now() + 8000);
  });

  it("handles offline network error and immediately retries upon resetDelaysAndDrain()", async () => {
    let networkOnline = false;

    const fetchMock = vi.fn().mockImplementation(() => {
      if (!networkOnline) {
        return Promise.reject(new TypeError("Failed to fetch (offline)"));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, duplicate: true, driveFileId: "drive-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    global.fetch = fetchMock;

    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    await addShot({ shotId: "offline-shot-1", eventSlug: slug, guestId, blob });

    // 1. Initial attempt while offline fails
    uploadQueue.drain();
    await new Promise((r) => setTimeout(r, 60));

    const failedShot = await getShot("offline-shot-1");
    expect(failedShot?.attempts).toBe(1);
    expect(failedShot?.nextAttemptAt).toBeGreaterThan(Date.now());

    // 2. Device comes back online -> triggers resetDelaysAndDrain()
    networkOnline = true;
    await uploadQueue.resetDelaysAndDrain();
    await new Promise((r) => setTimeout(r, 60));

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const recoveredShot = await getShot("offline-shot-1");
    expect(recoveredShot?.status).toBe("synced");
    expect(recoveredShot?.blob).toBeNull();
  });

  it("drops shot and unblocks queue on permanent rejection (403 shot limit reached)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Shot limit reached" }), {
        status: 403,
      }),
    );
    global.fetch = fetchMock;

    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    await addShot({ shotId: "limit-shot-1", eventSlug: slug, guestId, blob });

    uploadQueue.drain();
    await new Promise((r) => setTimeout(r, 60));

    const shot = await getShot("limit-shot-1");
    // Marked synced and unblocked so it won't retry infinitely
    expect(shot?.status).toBe("synced");
    expect(shot?.blob).toBeNull();

    const pending = await getPendingShots(guestId);
    expect(pending.length).toBe(0);
  });
});
