import { describe, it, expect } from "vitest";
import {
  linearSrgbToOklab,
  oklabToLinearSrgb,
  oklabToOklch,
  oklchToOklab,
  fitOklchToGamut,
  evaluateHueTable,
  calculateSkinDamping,
  evaluateToneCurve,
} from "../src/lib/imaging/looks/math";
import type { HueNode } from "../src/lib/imaging/looks/types";
import { CLASSIC_NEG_LOOK, CPM35_LOOK } from "../src/lib/imaging/looks/presets";

describe("Look Engine v2 Color & Math Engine", () => {
  it("converts round-trip sRGB -> OKLab -> sRGB accurately", () => {
    const testColors: [number, number, number][] = [
      [1.0, 1.0, 1.0], // White
      [0.0, 0.0, 0.0], // Black
      [0.5, 0.5, 0.5], // Neutral gray
      [0.9, 0.2, 0.1], // Saturated red
      [0.1, 0.8, 0.3], // Saturated green
      [0.1, 0.2, 0.9], // Saturated blue
      [0.9, 0.7, 0.5], // Skin tone base
    ];

    for (const [r, g, b] of testColors) {
      const [L, a, b_] = linearSrgbToOklab(r, g, b);
      expect(Number.isFinite(L)).toBe(true);
      expect(Number.isFinite(a)).toBe(true);
      expect(Number.isFinite(b_)).toBe(true);

      const [rRec, gRec, bRec] = oklabToLinearSrgb(L, a, b_);
      expect(Math.abs(rRec - r)).toBeLessThan(1e-3);
      expect(Math.abs(gRec - g)).toBeLessThan(1e-3);
      expect(Math.abs(bRec - b)).toBeLessThan(1e-3);
    }
  });

  it("converts round-trip OKLab -> OKLCH -> OKLab", () => {
    const [L, a, b_] = [0.7, 0.12, -0.08];
    const [cL, C, h] = oklabToOklch(L, a, b_);
    expect(cL).toBeCloseTo(L, 4);
    expect(C).toBeGreaterThan(0);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);

    const [recL, recA, recB] = oklchToOklab(cL, C, h);
    expect(recL).toBeCloseTo(L, 4);
    expect(recA).toBeCloseTo(a, 4);
    expect(recB).toBeCloseTo(b_, 4);
  });

  it("fitOklchToGamut maps extreme out-of-gamut colors strictly into [0, 1]^3 without clipping", () => {
    // Extreme chroma that definitely exceeds sRGB gamut
    const [L, extremeC, h] = [0.8, 0.45, 140]; // Super bright green-cyan
    const [r, g, b] = fitOklchToGamut(L, extremeC, h);

    expect(r).toBeGreaterThanOrEqual(0.0);
    expect(r).toBeLessThanOrEqual(1.0);
    expect(g).toBeGreaterThanOrEqual(0.0);
    expect(g).toBeLessThanOrEqual(1.0);
    expect(b).toBeGreaterThanOrEqual(0.0);
    expect(b).toBeLessThanOrEqual(1.0);
    expect(Number.isNaN(r)).toBe(false);
  });

  it("evaluates 24-node hue table with seamless circular wrap at 360/0 degrees", () => {
    const hueTable: HueNode[] = Array.from({ length: 24 }, (_, i) => ({
      hue: (i * 360) / 24,
      dHue: (i % 2 === 0 ? 5 : -5),
      dChroma: 1.0,
      dLightness: 0.0,
    }));

    const at359 = evaluateHueTable(359, hueTable);
    const at0 = evaluateHueTable(0, hueTable);
    const at1 = evaluateHueTable(1, hueTable);

    expect(Number.isFinite(at359.dHue)).toBe(true);
    expect(Number.isFinite(at0.dHue)).toBe(true);
    expect(Number.isFinite(at1.dHue)).toBe(true);
    // Smooth transition across 0 degrees wrap
    expect(Math.abs(at359.dHue - at0.dHue)).toBeLessThan(5);
    expect(Math.abs(at0.dHue - at1.dHue)).toBeLessThan(5);
  });

  it("calculateSkinDamping protects human skin tones in [20, 55] degrees", () => {
    const skinConfig = { enabled: true, minHue: 20, maxHue: 55, strength: 0.8 };
    const dampingAt35 = calculateSkinDamping(35, skinConfig); // Center of skin
    const dampingAt180 = calculateSkinDamping(180, skinConfig); // Cyan/sky

    expect(dampingAt35).toBeLessThan(0.5); // Heavily damped
    expect(dampingAt180).toBe(1.0); // Full shift allowed
  });

  it("handles soft vs hard tone curve shoulders properly", () => {
    const softCurve = { contrast: 1.1, pivot: 0.5, toe: 0.02, shoulder: 0.8, type: "soft" as const };
    const hardCurve = { contrast: 1.1, pivot: 0.5, toe: 0.02, shoulder: 0.8, type: "hard" as const };

    const softVal = evaluateToneCurve(0.95, softCurve);
    const hardVal = evaluateToneCurve(0.95, hardCurve);

    expect(softVal).toBeGreaterThan(0.8);
    expect(softVal).toBeLessThanOrEqual(1.0);
    expect(hardVal).toBeGreaterThan(0.8);
    expect(hardVal).toBeLessThanOrEqual(1.0);
  });

  describe("Fujifilm & Dazz Cam Color Science Recipes", () => {
    it("Classic Neg produces signature teal foliage greens while protecting skin", () => {
      expect(CLASSIC_NEG_LOOK.id).toBe("classic-neg");
      expect(CLASSIC_NEG_LOOK.color.hueTable).toHaveLength(24);

      // Evaluate green foliage hue (~105 degrees)
      const foliageNode = evaluateHueTable(105, CLASSIC_NEG_LOOK.color.hueTable);
      // Foliage shifted toward teal/cyan (negative hue shift)
      expect(foliageNode.dHue).toBeLessThan(-10);
      expect(foliageNode.dChroma).toBeLessThan(1.0); // Muted organic greens

      // Skin tones (~35 degrees) must be preserved
      const skinDamping = calculateSkinDamping(35, CLASSIC_NEG_LOOK.color.skinProtection);
      expect(skinDamping).toBeLessThan(0.3); // Heavily protected from aggressive green shift
    });

    it("CPM 35 produces warm rangefinder palette with golden undertones and soft rolloff", () => {
      expect(CPM35_LOOK.id).toBe("cpm-35");
      expect(CPM35_LOOK.response.curveR.type).toBe("soft");
      expect(CPM35_LOOK.response.curveR.shoulder).toBeLessThanOrEqual(0.82); // Soft highlight compression

      // Golden warmth in highlights
      expect(CPM35_LOOK.color.highlightWarmth).toBeGreaterThan(0.15);

      // Evaluate green hues (~105 degrees): CPM35 shifts warm positive
      const foliageNode = evaluateHueTable(105, CPM35_LOOK.color.hueTable);
      expect(foliageNode.dHue).toBeGreaterThan(0);

      // Cyan-teal shift on blue sky (~225 degrees)
      const blueNode = evaluateHueTable(225, CPM35_LOOK.color.hueTable);
      expect(blueNode.dHue).toBeLessThan(0);
    });
  });
});
