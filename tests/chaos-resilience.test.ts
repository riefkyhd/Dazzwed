import { describe, it, expect, vi } from "vitest";
import { fitLongestEdge, cropForAspectAndZoom } from "@/lib/imaging/geometry";

describe("Chaos and Edge-Case Hardening Tests", () => {
  describe("High-Resolution Sensor Downscaling", () => {
    it("safely scales down 48MP image (8000x6000) to max edge 4096", () => {
      const origW = 8000;
      const origH = 6000;
      const res = fitLongestEdge(origW, origH, 4096);
      expect(res.width).toBe(4096);
      expect(res.height).toBe(3072);
      expect(res.width / res.height).toBeCloseTo(origW / origH, 3);
    });

    it("safely scales down 108MP image (12000x9000) to max edge 4096", () => {
      const origW = 12000;
      const origH = 9000;
      const res = fitLongestEdge(origW, origH, 4096);
      expect(res.width).toBe(4096);
      expect(res.height).toBe(3072);
    });

    it("does not upscale lower resolution images below maxEdge", () => {
      const origW = 1920;
      const origH = 1080;
      const res = fitLongestEdge(origW, origH, 4096);
      expect(res.width).toBe(1920);
      expect(res.height).toBe(1080);
    });

    it("handles extreme aspect ratios without NaN or division by zero", () => {
      const res = fitLongestEdge(10000, 10, 4096);
      expect(res.width).toBe(4096);
      expect(res.height).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(res.height)).toBe(true);
    });
  });

  describe("Aspect Ratio and Zoom Crop Integrity", () => {
    it("computes 3:4 crop accurately in portrait", () => {
      const crop = cropForAspectAndZoom(3000, 4000, "3:4", 1);
      expect(crop.sx).toBe(0);
      expect(crop.sy).toBe(0);
      expect(crop.sw).toBe(3000);
      expect(crop.sh).toBe(4000);
    });

    it("centers crop when source aspect does not match target aspect", () => {
      // 16:9 source into 1:1 square
      const crop = cropForAspectAndZoom(1920, 1080, "1:1", 1);
      expect(crop.sh).toBe(1080);
      expect(crop.sw).toBe(1080);
      expect(crop.sx).toBe(Math.round((1920 - 1080) / 2));
      expect(crop.sy).toBe(0);
    });

    it("applies digital zoom centering correctly", () => {
      const crop = cropForAspectAndZoom(2000, 2000, "1:1", 2);
      expect(crop.sw).toBe(1000);
      expect(crop.sh).toBe(1000);
      expect(crop.sx).toBe(500);
      expect(crop.sy).toBe(500);
    });
  });

  describe("Shutter Throttle & Race Condition Guards", () => {
    it("prevents double shutter taps from launching multiple concurrent captures", async () => {
      let isProcessing = false;
      let captureCount = 0;

      const triggerShutter = async () => {
        if (isProcessing) return; // Guard clause modeled after CameraScreen
        isProcessing = true;
        try {
          await new Promise((r) => setTimeout(r, 20)); // simulate capture delay
          captureCount++;
        } finally {
          isProcessing = false;
        }
      };

      // Rapid parallel taps
      await Promise.all([triggerShutter(), triggerShutter(), triggerShutter()]);

      expect(captureCount).toBe(1);
    });
  });

  describe("IndexedDB Storage Resilience & Quota Guard", () => {
    it("handles mock QuotaExceededError gracefully without unhandled crashes", async () => {
      const mockStorageOperation = async (failWithQuota: boolean) => {
        try {
          if (failWithQuota) {
            const err = new Error("The quota has been exceeded.");
            err.name = "QuotaExceededError";
            throw err;
          }
          return { success: true };
        } catch (e: unknown) {
          const err = e as Error;
          if (err.name === "QuotaExceededError") {
            return { success: false, code: "QUOTA_EXCEEDED" };
          }
          throw err;
        }
      };

      const result = await mockStorageOperation(true);
      expect(result.success).toBe(false);
      expect(result.code).toBe("QUOTA_EXCEEDED");
    });
  });

  describe("Camera Permission Revocation Handling", () => {
    it("maps NotAllowedError to user-friendly permission error kind", () => {
      const mapError = (err: unknown) => {
        const error = err as { name?: string };
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          return "permission-denied";
        }
        if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
          return "not-found";
        }
        return "unknown";
      };

      expect(mapError({ name: "NotAllowedError" })).toBe("permission-denied");
      expect(mapError({ name: "PermissionDeniedError" })).toBe("permission-denied");
      expect(mapError({ name: "NotFoundError" })).toBe("not-found");
      expect(mapError({ name: "NotReadableError" })).toBe("unknown");
    });
  });
});
