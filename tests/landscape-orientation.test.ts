import { describe, expect, it } from "vitest";
import { calculateControlRotation } from "@/lib/camera/useOrientation";
import { resolveCaptureAspect, cropRect, cropForAspectAndZoom } from "@/lib/imaging/geometry";

describe("Landscape Orientation & Capture Mechanics", () => {
  describe("calculateControlRotation", () => {
    it("returns 0° for standard portrait (0° screen orientation)", () => {
      expect(calculateControlRotation(0, false)).toBe(0);
      expect(calculateControlRotation(0, true)).toBe(0);
    });

    it("handles 90° landscape-primary correctly", () => {
      // In portrait viewport with orientation angle 90, rotate icons 90°
      expect(calculateControlRotation(90, false)).toBe(90);
      // In native landscape viewport, side rail is already aligned (0°)
      expect(calculateControlRotation(90, true)).toBe(0);
    });

    it("handles 270° (or -90°) landscape-secondary correctly", () => {
      // In portrait viewport with orientation angle 270, rotate icons -90°
      expect(calculateControlRotation(270, false)).toBe(-90);
      expect(calculateControlRotation(-90, false)).toBe(-90);
      // In native landscape viewport, inverted 180°
      expect(calculateControlRotation(270, true)).toBe(180);
    });

    it("returns 180° for upside down portrait (180°)", () => {
      expect(calculateControlRotation(180, false)).toBe(180);
      expect(calculateControlRotation(180, true)).toBe(180);
    });

    it("defaults safely to 0° on unknown angle", () => {
      expect(calculateControlRotation(null as unknown as number, false)).toBe(0);
    });
  });

  describe("resolveCaptureAspect", () => {
    it("preserves original aspects when in portrait mode", () => {
      expect(resolveCaptureAspect("3:4", false)).toBe("3:4");
      expect(resolveCaptureAspect("16:9", false)).toBe("16:9");
      expect(resolveCaptureAspect("1:1", false)).toBe("1:1");
    });

    it("maps portrait 3:4 to landscape 4:3 when in landscape mode", () => {
      expect(resolveCaptureAspect("3:4", true)).toBe("4:3");
    });

    it("keeps 4:3 as 4:3 in landscape mode", () => {
      expect(resolveCaptureAspect("4:3", true)).toBe("4:3");
    });

    it("keeps 16:9 and 1:1 in landscape mode", () => {
      expect(resolveCaptureAspect("16:9", true)).toBe("16:9");
      expect(resolveCaptureAspect("1:1", true)).toBe("1:1");
    });
  });

  describe("cropRect & cropForAspectAndZoom in landscape capture", () => {
    const landscapeW = 4000;
    const landscapeH = 3000;

    it("produces full-sensor 4:3 landscape crop with sw > sh", () => {
      const rect = cropRect(landscapeW, landscapeH, "4:3");
      expect(rect.sw).toBe(4000);
      expect(rect.sh).toBe(3000);
      expect(rect.sw).toBeGreaterThan(rect.sh);
      expect(rect.sx).toBe(0);
      expect(rect.sy).toBe(0);
    });

    it("produces 16:9 landscape crop with sw > sh", () => {
      const rect = cropRect(landscapeW, landscapeH, "16:9");
      expect(rect.sw).toBe(4000);
      expect(rect.sh).toBe(2250);
      expect(rect.sw).toBeGreaterThan(rect.sh);
      expect(rect.sx).toBe(0);
      expect(rect.sy).toBe(375);
    });

    it("produces square 1:1 crop centered on landscape sensor", () => {
      const rect = cropRect(landscapeW, landscapeH, "1:1");
      expect(rect.sw).toBe(3000);
      expect(rect.sh).toBe(3000);
      expect(rect.sx).toBe(500);
      expect(rect.sy).toBe(0);
    });

    it("correctly handles 4:3 landscape crop on portrait stream", () => {
      const portraitW = 3000;
      const portraitH = 4000;
      const rect = cropRect(portraitW, portraitH, "4:3");
      expect(rect.sw).toBe(3000);
      expect(rect.sh).toBe(2250);
      expect(rect.sw).toBeGreaterThan(rect.sh);
      expect(rect.sx).toBe(0);
      expect(rect.sy).toBe(875);
    });

    it("supports 2x digital zoom on 4:3 landscape sensor", () => {
      const crop2x = cropForAspectAndZoom(landscapeW, landscapeH, "4:3", 2);
      expect(crop2x.sw).toBe(2000);
      expect(crop2x.sh).toBe(1500);
      expect(crop2x.sx).toBe(1000);
      expect(crop2x.sy).toBe(750);
    });
  });
});
