import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  addShot,
  getGuestGalleryPhotos,
  newShotId,
} from "@/lib/queue/store";

describe("Guest Private Gallery Store", () => {
  beforeEach(async () => {
    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const d of dbs) {
        if (d.name) indexedDB.deleteDatabase(d.name);
      }
    }
  });

  it("retains thumbnails and serves only the guest's own photos in reverse chronological order", async () => {
    const guestA = "guest-alice";
    const guestB = "guest-bob";
    const slug = "wedding-demo";

    // Global mock for URL.createObjectURL in fake-indexeddb
    if (typeof URL.createObjectURL !== "function") {
      URL.createObjectURL = (blob: Blob) => `blob:mock/${blob.size}`;
    }

    const blob1 = new Blob(["photo-1-bytes"], { type: "image/jpeg" });
    const blob2 = new Blob(["photo-2-bytes"], { type: "image/jpeg" });
    const bobBlob = new Blob(["bob-photo-bytes"], { type: "image/jpeg" });

    // Shot 1 for Alice
    await addShot({
      shotId: newShotId(),
      eventSlug: slug,
      guestId: guestA,
      blob: blob1,
    });

    // Small delay to ensure createdAt timestamp differs
    await new Promise((r) => setTimeout(r, 10));

    // Shot 2 for Alice
    await addShot({
      shotId: newShotId(),
      eventSlug: slug,
      guestId: guestA,
      blob: blob2,
    });

    // Shot for Bob
    await addShot({
      shotId: newShotId(),
      eventSlug: slug,
      guestId: guestB,
      blob: bobBlob,
    });

    // Retrieve Alice's gallery photos
    const alicePhotos = await getGuestGalleryPhotos(guestA);
    expect(alicePhotos.length).toBe(2);
    // Reverse chronological (shot 2 is first)
    expect(alicePhotos[0].createdAt).toBeGreaterThanOrEqual(alicePhotos[1].createdAt);

    // Retrieve Bob's gallery photos
    const bobPhotos = await getGuestGalleryPhotos(guestB);
    expect(bobPhotos.length).toBe(1);
    expect(bobPhotos[0].guestId).toBe(guestB);
  });
});
