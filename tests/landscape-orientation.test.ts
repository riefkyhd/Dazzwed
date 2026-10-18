import { describe, expect, it } from "vitest";
import { calculateControlRotation } from "@/lib/camera/useOrientation";
import { resolveCaptureAspect, cropRect, cropForAspectAndZoom, mapCropUvCoordinates } from "@/lib/imaging/geometry";

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

  describe("mapCropUvCoordinates (WebGL Shader Transformation)", () => {
    const fullCropRect = { x: 0, y: 0, width: 1, height: 1 };

    it("Portrait Rear: maps (0,0) -> (0,0), (1,1) -> (1,1) upright unmirrored", () => {
      const topLeft = mapCropUvCoordinates({ x: 0, y: 0 }, fullCropRect, 0, false);
      const bottomRight = mapCropUvCoordinates({ x: 1, y: 1 }, fullCropRect, 0, false);
      expect(topLeft).toEqual({ s: 0, t: 0 });
      expect(bottomRight).toEqual({ s: 1, t: 1 });
    });

    it("Portrait Front: maps (0,0) -> (1,0) (mirrored X, upright Y)", () => {
      const topLeft = mapCropUvCoordinates({ x: 0, y: 0 }, fullCropRect, 0, true);
      const topRight = mapCropUvCoordinates({ x: 1, y: 0 }, fullCropRect, 0, true);
      const bottomCenter = mapCropUvCoordinates({ x: 0.5, y: 1 }, fullCropRect, 0, true);
      expect(topLeft).toEqual({ s: 1, t: 0 });
      expect(topRight).toEqual({ s: 0, t: 0 });
      expect(bottomCenter.t).toBe(1); // Y/T is bottom
    });

    it("Landscape Left Rear (90 deg): ceiling (y=0) maps to s=1 (right edge of phone)", () => {
      const topCenter = mapCropUvCoordinates({ x: 0.5, y: 0 }, fullCropRect, 90, false);
      const bottomCenter = mapCropUvCoordinates({ x: 0.5, y: 1 }, fullCropRect, 90, false);
      expect(topCenter.s).toBe(1); // Ceiling at top
      expect(bottomCenter.s).toBe(0); // Floor at bottom
    });

    it("Landscape Right Rear (-90 deg): ceiling (y=0) maps to s=0 (left edge of phone)", () => {
      const topCenter = mapCropUvCoordinates({ x: 0.5, y: 0 }, fullCropRect, -90, false);
      const bottomCenter = mapCropUvCoordinates({ x: 0.5, y: 1 }, fullCropRect, -90, false);
      expect(topCenter.s).toBe(0); // Ceiling at top
      expect(bottomCenter.s).toBe(1); // Floor at bottom
    });

    it("Landscape Left Front (90 deg, mirror): ceiling / head (y=0) maps to s=0 (upright!) and NEVER inverted", () => {
      const topLeft = mapCropUvCoordinates({ x: 0, y: 0 }, fullCropRect, 90, true);
      const topRight = mapCropUvCoordinates({ x: 1, y: 0 }, fullCropRect, 90, true);
      const bottomLeft = mapCropUvCoordinates({ x: 0, y: 1 }, fullCropRect, 90, true);
      const bottomRight = mapCropUvCoordinates({ x: 1, y: 1 }, fullCropRect, 90, true);

      // Top of output photo must sample user's head (s = 0), NOT inverted floor (s = 1)!
      expect(topLeft.s).toBe(0);
      expect(topRight.s).toBe(0);
      // Bottom of output photo must sample user's torso (s = 1)
      expect(bottomLeft.s).toBe(1);
      expect(bottomRight.s).toBe(1);

      // Left of photo (x=0) must sample user's left (t=0)
      expect(topLeft.t).toBe(0);
      // Right of photo (x=1) must sample user's right (t=1)
      expect(topRight.t).toBe(1);
    });

    it("Landscape Right Front (-90 deg, mirror): ceiling / head (y=0) maps to s=1 (upright!) and NEVER inverted", () => {
      const topLeft = mapCropUvCoordinates({ x: 0, y: 0 }, fullCropRect, -90, true);
      const topRight = mapCropUvCoordinates({ x: 1, y: 0 }, fullCropRect, -90, true);
      const bottomLeft = mapCropUvCoordinates({ x: 0, y: 1 }, fullCropRect, -90, true);
      const bottomRight = mapCropUvCoordinates({ x: 1, y: 1 }, fullCropRect, -90, true);

      // Top of output photo must sample user's head (s = 1), NOT inverted floor (s = 0)!
      expect(topLeft.s).toBe(1);
      expect(topRight.s).toBe(1);
      // Bottom of output photo must sample user's torso (s = 0)
      expect(bottomLeft.s).toBe(0);
      expect(bottomRight.s).toBe(0);

      // Mirror reflection in landscape right:
      expect(topLeft.t).toBe(1);
      expect(topRight.t).toBe(0);
    });
  });
});
