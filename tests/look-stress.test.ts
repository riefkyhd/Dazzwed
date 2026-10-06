import { describe, it, expect } from "vitest";
import { evaluateToneCurve, applySplitTone } from "../src/lib/imaging/looks/math";
import {
  BUILTIN_LOOKS,
  DISPOSABLE_400_LOOK,
  CCD_FLASH_LOOK,
  INSTANT_LOOK,
  GOLDEN_200_LOOK,
  NEUTRAL_LOOK,
} from "../src/lib/imaging/looks/presets";
import type { LookRecipe } from "../src/lib/imaging/looks/types";

// CPU simulation matching exact GLSL logic in pipeline.ts
function simulateGlslPixel(
  rgbIn: [number, number, number],
  look: LookRecipe
): [number, number, number] {
  let [r, g, b] = rgbIn;

  // 1. sRGB to Linear
  const srgbToLin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow(Math.max(1e-4, (c + 0.055) / 1.055), 2.4);
  let linR = srgbToLin(r);
  let linG = srgbToLin(g);
  let linB = srgbToLin(b);

  // 2. Exposure in Linear space
  if (look.exposureEV !== 0) {
    const evFactor = Math.pow(2.0, look.exposureEV);
    linR *= evFactor;
    linG *= evFactor;
    linB *= evFactor;
  }

  // Linear to sRGB
  const linToSrgb = (c: number) =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(1e-4, c), 1.0 / 2.4) - 0.055;
  r = Math.max(0, Math.min(1, linToSrgb(linR)));
  g = Math.max(0, Math.min(1, linToSrgb(linG)));
  b = Math.max(0, Math.min(1, linToSrgb(linB)));

  // 3. Filmic Curve
  r = evaluateToneCurve(r, look.curve);
  g = evaluateToneCurve(g, look.curve);
  b = evaluateToneCurve(b, look.curve);

  // 4. Lift / Gamma / Gain
  r = Math.max(0, Math.min(1, r + look.lift[0]));
  g = Math.max(0, Math.min(1, g + look.lift[1]));
  b = Math.max(0, Math.min(1, b + look.lift[2]));

  r = Math.pow(Math.max(1e-4, r), 1.0 / Math.max(0.1, look.gamma[0]));
  g = Math.pow(Math.max(1e-4, g), 1.0 / Math.max(0.1, look.gamma[1]));
  b = Math.pow(Math.max(1e-4, b), 1.0 / Math.max(0.1, look.gamma[2]));

  r = Math.max(0, Math.min(1, r * look.gain[0]));
  g = Math.max(0, Math.min(1, g * look.gain[1]));
  b = Math.max(0, Math.min(1, b * look.gain[2]));

  // 5. Split-Toning
  const [stR, stG, stB] = applySplitTone(r, g, b, look.splitTone);
  r = stR;
  g = stG;
  b = stB;

  // Saturation
  let luma = 0.299 * r + 0.587 * g + 0.114 * b;
  r = Math.max(0, Math.min(1, luma + look.saturation * (r - luma)));
  g = Math.max(0, Math.min(1, luma + look.saturation * (g - luma)));
  b = Math.max(0, Math.min(1, luma + look.saturation * (b - luma)));

  // White Protect: For highlights (luma > 0.85), pull tint smoothly back toward neutral white
  luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if ((look.whiteProtect ?? true) && luma > 0.85) {
    const t = Math.max(0, Math.min(1, (luma - 0.85) / (0.98 - 0.85)));
    const smoothT = t * t * (3 - 2 * t) * 0.96;
    r = r * (1 - smoothT) + luma * smoothT;
    g = g * (1 - smoothT) + luma * smoothT;
    b = b * (1 - smoothT) + luma * smoothT;
  }

  // Intensity blend
  const intensity = look.intensity ?? 1.0;
  r = rgbIn[0] * (1 - intensity) + r * intensity;
  g = rgbIn[1] * (1 - intensity) + g * intensity;
  b = rgbIn[2] * (1 - intensity) + b * intensity;

  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

describe("Look Engine Stress Tests & Recalibration", () => {
  it("never outputs NaN or Infinity across full range [0.0 .. 2.0]", () => {
    for (const look of BUILTIN_LOOKS) {
      for (let v = 0.0; v <= 2.0; v += 0.05) {
        const [r, g, b] = simulateGlslPixel([v, v, v], look);
        expect(Number.isNaN(r)).toBe(false);
        expect(Number.isNaN(g)).toBe(false);
        expect(Number.isNaN(b)).toBe(false);
        expect(Number.isFinite(r)).toBe(true);
        expect(Number.isFinite(g)).toBe(true);
        expect(Number.isFinite(b)).toBe(true);
      }
    }
  });

  it("ensures monotonic non-decreasing output along the grayscale ramp", () => {
    for (const look of BUILTIN_LOOKS) {
      let prevLuma = -0.001;
      // 50 step ramp
      for (let i = 0; i <= 50; i++) {
        const input = i / 50;
        const [r, g, b] = simulateGlslPixel([input, input, input], look);
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        expect(luma).toBeGreaterThanOrEqual(prevLuma - 0.005); // Monotonic within 0.5% tolerance
        prevLuma = luma;
      }
    }
  });

  it("guarantees pixels with input luma > 0.9 have output luma > 0.8 (no highlight collapse to black)", () => {
    for (const look of BUILTIN_LOOKS) {
      for (let input = 0.90; input <= 1.0; input += 0.02) {
        const [r, g, b] = simulateGlslPixel([input, input, input], look);
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luma <= 0.80) {
          console.error(`Look ${look.name} failed at input ${input}: luma=${luma}`);
        }
        expect(luma).toBeGreaterThan(0.80);
      }
    }
  });

  it("keeps neutral white patches near white (within 6% shift in any channel)", () => {
    for (const look of [DISPOSABLE_400_LOOK, CCD_FLASH_LOOK, INSTANT_LOOK, GOLDEN_200_LOOK]) {
      const [r, g, b] = simulateGlslPixel([1.0, 1.0, 1.0], look);
      console.log(`White patch for ${look.name}: r=${r.toFixed(3)}, g=${g.toFixed(3)}, b=${b.toFixed(3)}`);
      expect(r).toBeGreaterThan(0.85);
      expect(g).toBeGreaterThan(0.85);
      expect(b).toBeGreaterThan(0.85);
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      expect(maxDiff).toBeLessThanOrEqual(0.06);
    }
  });

  it("Neutral look is identity within 1/255 for all inputs", () => {
    for (let i = 0; i <= 255; i += 16) {
      const input = i / 255;
      const [r, g, b] = simulateGlslPixel([input, input, input], NEUTRAL_LOOK);
      expect(Math.abs(r - input)).toBeLessThanOrEqual(1 / 255 + 0.001);
      expect(Math.abs(g - input)).toBeLessThanOrEqual(1 / 255 + 0.001);
      expect(Math.abs(b - input)).toBeLessThanOrEqual(1 / 255 + 0.001);
    }
  });
});
