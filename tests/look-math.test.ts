import { describe, expect, it } from "vitest";
import { evaluateToneCurve, applySplitTone, calculateFlashFalloff, createPRNG, seedFromString } from "@/lib/imaging/looks/math";
import { NEUTRAL_LOOK } from "@/lib/imaging/looks/presets";

describe("Look Engine Math & Pure Functions", () => {
  it("evaluates neutral tone curve as identity", () => {
    for (let x = 0; x <= 1.0; x += 0.1) {
      const y = evaluateToneCurve(x, NEUTRAL_LOOK.curve);
      expect(Math.abs(y - x)).toBeLessThan(0.01);
    }
  });

  it("applies toe lift to shadows", () => {
    const toeCurve = { contrast: 1.0, pivot: 0.5, toe: 0.1, shoulder: 1.0 };
    const black = evaluateToneCurve(0.0, toeCurve);
    expect(black).toBeCloseTo(0.1, 2);
  });

  it("ensures tone curve is strictly monotonic", () => {
    const curve = { contrast: 0.6, pivot: 0.45, toe: 0.05, shoulder: 0.6 };
    let prev = -1;
    for (let x = 0; x <= 1.0; x += 0.02) {
      const y = evaluateToneCurve(x, curve);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });

  it("ensures split-tone fades to zero at neutral axis (low saturation)", () => {
    const split = { shadowHue: 180, shadowSat: 0.8, highlightHue: 40, highlightSat: 0.8, balance: 0 };
    // Pure neutral gray (r = g = b = 0.3)
    const [r, g, b] = applySplitTone(0.3, 0.3, 0.3, split);
    expect(r).toBeCloseTo(0.3, 2);
    expect(g).toBeCloseTo(0.3, 2);
    expect(b).toBeCloseTo(0.3, 2);
  });

  it("calculates flash falloff: brighter at center, darker at edge", () => {
    const falloff = { strength: 0.6, radius: 0.5, centerX: 0.5, centerY: 0.5 };
    const center = calculateFlashFalloff(0.5, 0.5, falloff, 1.0);
    const corner = calculateFlashFalloff(0.0, 0.0, falloff, 1.0);
    expect(center).toBeGreaterThan(corner);
  });

  it("produces deterministic PRNG values given the same seed", () => {
    const seed = seedFromString("shot-uuid-1234");
    const rng1 = createPRNG(seed);
    const rng2 = createPRNG(seed);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });
});
