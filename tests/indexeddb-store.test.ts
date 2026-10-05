import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  addShot,
  countShots,
  listShots,
  pendingCount,
  updateShot,
} from "@/lib/queue/store";

describe("IndexedDB shot queue store", () => {
  const guestId = "guest-100";
  const slug = "test-wedding";

  beforeEach(async () => {
    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const d of dbs) {
        if (d.name) indexedDB.deleteDatabase(d.name);
      }
    }
  });

  it("stores a shot and tracks queue count", async () => {
    const blob = new Blob(["mock-image-data"], { type: "image/jpeg" });
    const shot = await addShot({
      shotId: "shot-1",
      eventSlug: slug,
      guestId,
      blob,
    });

    expect(shot.shotId).toBe("shot-1");
    expect(shot.status).toBe("queued");

    const total = await countShots(guestId);
    expect(total).toBe(1);

    const pending = await pendingCount(guestId);
    expect(pending).toBe(1);

    const list = await listShots(guestId);
    expect(list.length).toBe(1);
    expect(list[0].shotId).toBe("shot-1");
  });

  it("updates shot status and pending count reflects synced state", async () => {
    const blob = new Blob(["mock-image-2"], { type: "image/jpeg" });
    await addShot({ shotId: "shot-2", eventSlug: slug, guestId, blob });

    expect(await pendingCount(guestId)).toBe(1);

    await updateShot("shot-2", { status: "synced", blob: null });

    expect(await pendingCount(guestId)).toBe(0);
    expect(await countShots(guestId)).toBe(1); // Still counts towards taken shots
  });

  it("isolates shots between multiple guests", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    await addShot({ shotId: "shot-g1", eventSlug: slug, guestId: "g1", blob });
    await addShot({ shotId: "shot-g2", eventSlug: slug, guestId: "g2", blob });

    expect(await countShots("g1")).toBe(1);
    expect(await countShots("g2")).toBe(1);
  });
});
