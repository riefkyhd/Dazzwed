import { describe, expect, it } from "vitest";
import {
  calculateTiltAngleFromGravity,
  calculateTiltAngleFromOrientation,
  type TiltAngle,
} from "@/lib/camera/useDeviceTilt";
import { cropRect, fitLongestEdge, resolveCaptureAspect } from "@/lib/imaging/geometry";

describe("Gravity Accelerometer Tilt Detection & Zero Reflow Mechanics", () => {
  describe("calculateTiltAngleFromGravity", () => {
    it("detects portrait upright when gravity pulls along y-axis (|y| > |x|)", () => {
      // Normal upright holding: y ≈ 9.8 m/s², x ≈ 0 m/s²
      const result = calculateTiltAngleFromGravity(0.2, 9.8, 1.0, 0);
      expect(result.angle).toBe(0);
      expect(result.isFlat).toBe(false);
    });

    it("detects landscape left (tilt CCW, top of phone points left) when x > 4.5", () => {
      // Phone held horizontally rotated 90° CCW: gravity pulls along positive x-axis
      const result = calculateTiltAngleFromGravity(8.5, 1.2, 0.5, 0);
      expect(result.angle).toBe(90);
      expect(result.isFlat).toBe(false);
    });

    it("detects landscape right (tilt CW, top of phone points right) when x < -4.5", () => {
      // Phone held horizontally rotated 90° CW: gravity pulls along negative x-axis
      const result = calculateTiltAngleFromGravity(-8.5, 1.2, 0.5, 0);
      expect(result.angle).toBe(-90);
      expect(result.isFlat).toBe(false);
    });

    it("detects flat surface (phone resting on table) and preserves current angle", () => {
      // Screen facing ceiling: z ≈ 9.8 m/s², x and y close to 0
      const flatFromPortrait = calculateTiltAngleFromGravity(0.3, 0.4, 9.8, 0);
      expect(flatFromPortrait.isFlat).toBe(true);
      expect(flatFromPortrait.angle).toBe(0);

      const flatFromLandscape = calculateTiltAngleFromGravity(0.2, 0.3, 9.7, 90);
      expect(flatFromLandscape.isFlat).toBe(true);
      expect(flatFromLandscape.angle).toBe(90);
    });

    it("enforces deadzone hysteresis: ambiguous 45° holding angles do not flip jitter", () => {
      // x and y roughly equal (~5.0 m/s² each), not exceeding 1.3x hysteresis ratio
      const ambiguousFrom0 = calculateTiltAngleFromGravity(5.0, 4.8, 1.0, 0);
      expect(ambiguousFrom0.angle).toBe(0); // retains current angle

      const ambiguousFrom90 = calculateTiltAngleFromGravity(5.0, 4.8, 1.0, 90);
      expect(ambiguousFrom90.angle).toBe(90); // retains current angle
    });

    describe("iOS CoreMotion Coordinate Normalization", () => {
      it("detects portrait upright on iOS when raw gravity pulls along negative y-axis (y ≈ -9.8)", () => {
        // iPhone held upright: rawX ≈ 0, rawY ≈ -9.8, rawZ ≈ 0
        const result = calculateTiltAngleFromGravity(0.1, -9.8, 0.5, 0, true);
        expect(result.angle).toBe(0);
        expect(result.isFlat).toBe(false);
      });

      it("detects landscape left on iOS (tilt CCW, top points left) when raw x is negative (x ≈ -9.8)", () => {
        // iPhone held in Landscape Left: rawX ≈ -8.8, rawY ≈ 0.8, rawZ ≈ 0.5
        const result = calculateTiltAngleFromGravity(-8.8, 0.8, 0.5, 0, true);
        expect(result.angle).toBe(90);
        expect(result.isFlat).toBe(false);
      });

      it("detects landscape right on iOS (tilt CW, top points right) when raw x is positive (x ≈ +9.8)", () => {
        // iPhone held in Landscape Right: rawX ≈ +8.8, rawY ≈ 0.8, rawZ ≈ 0.5
        const result = calculateTiltAngleFromGravity(8.8, 0.8, 0.5, 0, true);
        expect(result.angle).toBe(-90);
        expect(result.isFlat).toBe(false);
      });

      it("detects flat surface on iOS (screen facing up, raw z ≈ -9.8)", () => {
        const flatOnTable = calculateTiltAngleFromGravity(0.2, 0.3, -9.8, 0, true);
        expect(flatOnTable.isFlat).toBe(true);
        expect(flatOnTable.angle).toBe(0);
      });

      it("enforces deadzone hysteresis on iOS at 45° holding angles", () => {
        const ambiguous = calculateTiltAngleFromGravity(-5.0, -4.8, 0.5, 0, true);
        expect(ambiguous.angle).toBe(0);
      });
    });
  });

  describe("calculateTiltAngleFromOrientation (DeviceOrientation fallback)", () => {
    it("maps beta ~ 90° to portrait upright (0°)", () => {
      expect(calculateTiltAngleFromOrientation(85, 2, 0)).toBe(0);
    });

    it("maps steep negative gamma to landscape left (90°)", () => {
      expect(calculateTiltAngleFromOrientation(10, -65, 0)).toBe(90);
    });

    it("maps steep positive gamma to landscape right (-90°)", () => {
      expect(calculateTiltAngleFromOrientation(10, 65, 0)).toBe(-90);
    });
  });

  describe("True Landscape Archival Geometry from Portrait Sensor", () => {
    it("produces horizontal dimensions (width > height) when tilted at 90°", () => {
      const portraitSensorW = 3000;
      const portraitSensorH = 4000;
      const isRotated = true; // tiltAngle === 90

      // Effective sensor dimensions in rotated coordinates
      const effectiveW = isRotated ? portraitSensorH : portraitSensorW; // 4000
      const effectiveH = isRotated ? portraitSensorW : portraitSensorH; // 3000

      const targetAspect = resolveCaptureAspect("3:4", isRotated); // "4:3"
      expect(targetAspect).toBe("4:3");

      const crop = cropRect(effectiveW, effectiveH, targetAspect);
      expect(crop.sw).toBe(4000);
      expect(crop.sh).toBe(3000);
      expect(crop.sw).toBeGreaterThan(crop.sh);

      const out = fitLongestEdge(crop.sw, crop.sh, 2560);
      expect(out.width).toBe(2560);
      expect(out.height).toBe(1920);
      expect(out.width).toBeGreaterThan(out.height); // True horizontal landscape!
    });

    it("produces horizontal 16:9 dimensions when tilted in 16:9 mode", () => {
      const portraitSensorW = 3000;
      const portraitSensorH = 4000;
      const isRotated = true;

      const effectiveW = isRotated ? portraitSensorH : portraitSensorW; // 4000
      const effectiveH = isRotated ? portraitSensorW : portraitSensorH; // 3000

      const targetAspect = resolveCaptureAspect("16:9", isRotated); // "16:9"
      const crop = cropRect(effectiveW, effectiveH, targetAspect);

      expect(crop.sw).toBe(4000);
      expect(crop.sh).toBe(2250);
      expect(crop.sw).toBeGreaterThan(crop.sh);

      const out = fitLongestEdge(crop.sw, crop.sh, 2560);
      expect(out.width).toBe(2560);
      expect(out.height).toBe(1440);
      expect(out.width).toBeGreaterThan(out.height);
    });
  });
});
