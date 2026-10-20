import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { withDriveRetry } from "@/lib/drive/retry";
import { calculateQueueBackoff } from "@/lib/queue/uploader";
import {
  addShot,
  getShot,
  updateShot,
  getPendingShots,
  activeInFlightIds,
  _resetStoreForTesting,
} from "@/lib/queue/store";

describe("Upload Resilience & 500-Guest Spike Protection", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    _resetStoreForTesting();
    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const d of dbs) {
        if (d.name) indexedDB.deleteDatabase(d.name);
      }
    }
  });

  describe("Google Drive Rate-Limit Retry (withDriveRetry)", () => {
    it("retries on HTTP 429 Too Many Requests and succeeds on subsequent attempt", async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          const err = new Error("Rate limit exceeded") as any;
          err.status = 429;
          throw err;
        }
        return "success-file-id";
      });

      const result = await withDriveRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 10,
        maxJitterMs: 5,
      });

      expect(result).toBe("success-file-id");
      expect(attempts).toBe(2);
    });

    it("retries on HTTP 403 when error reason is userRateLimitExceeded", async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          const err = new Error("User Rate Limit Exceeded") as any;
          err.status = 403;
          err.errors = [{ reason: "userRateLimitExceeded" }];
          throw err;
        }
        return "recovered-drive-id";
      });

      const result = await withDriveRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 10,
        maxJitterMs: 5,
      });

      expect(result).toBe("recovered-drive-id");
      expect(attempts).toBe(2);
    });

    it("fails immediately with zero retries when HTTP 403 is storageQuotaExceeded (disk full)", async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        const err = new Error("The user's Drive storage quota has been exceeded") as any;
        err.status = 403;
        err.errors = [{ reason: "storageQuotaExceeded" }];
        throw err;
      });

      await expect(
        withDriveRetry(operation, {
          maxRetries: 3,
          baseDelayMs: 10,
          maxJitterMs: 5,
        })
      ).rejects.toThrow(/quota has been exceeded/i);

      // Must fail fast on attempt 1 without retrying!
      expect(attempts).toBe(1);
    });

    it("retries transient 500 server errors up to maxRetries before throwing", async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        const err = new Error("Google Internal Server Error") as any;
        err.status = 500;
        throw err;
      });

      await expect(
        withDriveRetry(operation, {
          maxRetries: 2,
          baseDelayMs: 5,
          maxJitterMs: 5,
        })
      ).rejects.toThrow(/Internal Server Error/i);

      expect(attempts).toBe(3); // 1 initial + 2 retries
    });
  });

  describe("Client Queue Backoff & Jitter (calculateQueueBackoff)", () => {
    it("respects standard ladder with random jitter between 100ms and 1200ms", () => {
      // Ladder: [2000, 5000, 12000, 25000, 60000]
      const attempt0 = calculateQueueBackoff(0);
      expect(attempt0).toBeGreaterThanOrEqual(2100);
      expect(attempt0).toBeLessThanOrEqual(3200);

      const attempt1 = calculateQueueBackoff(1);
      expect(attempt1).toBeGreaterThanOrEqual(5100);
      expect(attempt1).toBeLessThanOrEqual(6200);

      const attempt4 = calculateQueueBackoff(4);
      expect(attempt4).toBeGreaterThanOrEqual(60100);
      expect(attempt4).toBeLessThanOrEqual(61200);
    });

    it("prioritizes Retry-After response header in seconds if provided", () => {
      const delay = calculateQueueBackoff(0, "45");
      expect(delay).toBe(45000);
    });
  });

  describe("Phone-Lock & Background-Tab Auto-Resume (IndexedDB Stale Lock Detection)", () => {
    const slug = "test-event-resilience";
    const guestId = "guest-resilience-1";

    it("heals a stale >45s 'uploading' lock back to 'queued' when NOT in activeInFlightIds", async () => {
      const blob = new Blob(["dummy photo content"], { type: "image/jpeg" });
      await addShot({
        shotId: "shot-stale-1",
        eventSlug: slug,
        guestId,
        blob,
      });

      // Simulate an abandoned upload from a phone lock 60 seconds ago
      await updateShot("shot-stale-1", {
        status: "uploading",
        uploadStartedAt: Date.now() - 60_000,
      });

      // Ensure it is NOT actively in-flight
      activeInFlightIds.delete("shot-stale-1");

      const pending = await getPendingShots(guestId);
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe("queued");

      const inDb = await getShot("shot-stale-1");
      expect(inDb?.status).toBe("queued");
    });

    it("does NOT reset an uploading shot if it is actively in activeInFlightIds", async () => {
      const blob = new Blob(["dummy photo content"], { type: "image/jpeg" });
      await addShot({
        shotId: "shot-active-1",
        eventSlug: slug,
        guestId,
        blob,
      });

      // Simulate a long transfer on a slow 3G cellular connection (>45s) that is still running
      await updateShot("shot-active-1", {
        status: "uploading",
        uploadStartedAt: Date.now() - 50_000,
      });

      activeInFlightIds.add("shot-active-1");

      const pending = await getPendingShots(guestId);
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe("uploading");

      activeInFlightIds.delete("shot-active-1");
    });

    it("heals a stale >45s originalStatus back to 'queued' when NOT in activeInFlightIds", async () => {
      const blob = new Blob(["filtered photo"], { type: "image/jpeg" });
      const origBlob = new Blob(["raw photo"], { type: "image/jpeg" });
      await addShot({
        shotId: "shot-orig-stale-1",
        eventSlug: slug,
        guestId,
        blob,
        originalBlob: origBlob,
      });

      await updateShot("shot-orig-stale-1", {
        status: "synced",
        originalStatus: "uploading",
        originalUploadStartedAt: Date.now() - 60_000,
      });

      const pending = await getPendingShots(guestId);
      expect(pending.length).toBe(1);
      expect(pending[0].originalStatus).toBe("queued");
    });
  });
});
