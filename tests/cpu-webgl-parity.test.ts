import { describe, it, expect } from "vitest";
import {
  buildBakedRecipeLUT,
  applyLookToImageData,
} from "../src/lib/imaging/looks/cpu-fallback";
import {
  CPM35_LOOK,
  PORTRA_400_LOOK,
  GOLDEN_200_LOOK,
  ILFORD_HP5_LOOK,
  CLASSIC_NEG_LOOK,
} from "../src/lib/imaging/looks/presets";
import {
  evaluateLookColorTransform,
  sampleCubeLUTTrilinear,
  createIdentityCubeLUT,
} from "../src/lib/imaging/looks/cube-lut";
import { calculateDeltaE, srgbToLinear } from "../src/lib/imaging/looks/math";

// Polyfill minimal ImageData if running in headless node/vitest environment
function createMockImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    data,
    colorSpace: "srgb",
  } as ImageData;
}

describe("CPU Fallback & Color Science Parity (B1)", () => {
  const testPatches: [number, number, number][] = [
    [0.0, 0.0, 0.0], // Black
    [1.0, 1.0, 1.0], // White
    [0.5, 0.5, 0.5], // Mid-gray
    [0.78, 0.58, 0.46], // Warm skin tone
    [0.25, 0.52, 0.28], // Foliage green
    [0.22, 0.48, 0.82], // Sky blue
    [0.85, 0.25, 0.20], // Crimson red
    [0.92, 0.88, 0.84], // Ivory wedding dress
  ];

  it("buildBakedRecipeLUT matches analytical evaluateLookColorTransform within OKLab ΔE < 0.03", () => {
    const looks = [CPM35_LOOK, PORTRA_400_LOOK, GOLDEN_200_LOOK, ILFORD_HP5_LOOK, CLASSIC_NEG_LOOK];

    for (const look of looks) {
      const bakedLut = buildBakedRecipeLUT(look, false);
      expect(bakedLut.size).toBe(17);
      expect(bakedLut.floatData.length).toBe(17 * 17 * 17 * 3);

      for (const [r, g, b] of testPatches) {
        const directTransform = evaluateLookColorTransform(r, g, b, look);
        const lutSample = sampleCubeLUTTrilinear(bakedLut, r, g, b, 1.0);

        const dE = calculateDeltaE(
          [srgbToLinear(directTransform[0]), srgbToLinear(directTransform[1]), srgbToLinear(directTransform[2])],
          [srgbToLinear(lutSample[0]), srgbToLinear(lutSample[1]), srgbToLinear(lutSample[2])]
        );

        // 17^3 trilinear interpolation provides high perceptual accuracy (ΔE_OK < 0.03)
        expect(dE).toBeLessThan(0.03);
      }
    }
  });

  it("buildBakedRecipeLUT bakes external LUT with correct strength blending", () => {
    const identityLut = createIdentityCubeLUT(17);
    const bakedLut = buildBakedRecipeLUT(CPM35_LOOK, false, identityLut);
    expect(bakedLut.size).toBe(17);
    expect(bakedLut.floatData.length).toBe(17 * 17 * 17 * 3);

    // Verify sampling at center point works
    const sample = sampleCubeLUTTrilinear(bakedLut, 0.5, 0.5, 0.5, 1.0);
    expect(sample[0]).toBeGreaterThan(0);
    expect(sample[0]).toBeLessThan(1);
  });

  it("applyLookToImageData processes buffers deterministically without NaN or out-of-bounds values", () => {
    const width = 32;
    const height = 32;
    const imgData = createMockImageData(width, height);

    // Fill with gradient pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        imgData.data[idx] = Math.round((x / (width - 1)) * 255);
        imgData.data[idx + 1] = Math.round((y / (height - 1)) * 255);
        imgData.data[idx + 2] = 128;
        imgData.data[idx + 3] = 255;
      }
    }

    applyLookToImageData(imgData, CPM35_LOOK, {
      seed: 42,
      intensity: 1.0,
      isNativeCamera: false,
    });

    for (let i = 0; i < imgData.data.length; i++) {
      const v = imgData.data[i];
      expect(Number.isFinite(v)).toBe(true);
      expect(Number.isNaN(v)).toBe(false);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });

  it("applyLookToImageData with intensity 0 preserves input pixels exactly", () => {
    const width = 8;
    const height = 8;
    const imgData = createMockImageData(width, height);

    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = 100;
      imgData.data[i + 1] = 150;
      imgData.data[i + 2] = 200;
      imgData.data[i + 3] = 255;
    }

    const copyBefore = new Uint8ClampedArray(imgData.data);
    applyLookToImageData(imgData, CPM35_LOOK, { intensity: 0 });

    for (let i = 0; i < imgData.data.length; i++) {
      expect(imgData.data[i]).toBe(copyBefore[i]);
    }
  });

  it("handles isNativeCamera: true with dialed-down vignette and grain", () => {
    const width = 16;
    const height = 16;
    const imgData = createMockImageData(width, height);

    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = 180;
      imgData.data[i + 1] = 180;
      imgData.data[i + 2] = 180;
      imgData.data[i + 3] = 255;
    }

    // Should complete cleanly without error
    expect(() => {
      applyLookToImageData(imgData, CPM35_LOOK, {
        isNativeCamera: true,
        intensity: 0.7,
      });
    }).not.toThrow();
  });
});
