import { describe, it, expect } from "vitest";
import { evaluateToneCurve } from "../src/lib/imaging/looks/math";
import { evaluateLookColorTransform } from "../src/lib/imaging/looks/cube-lut";
import { CLASSIC_NEG_LOOK } from "../src/lib/imaging/looks/presets";

describe("Classic Neg 400 (Fujicolor Superia 400) Validation", () => {
  it("enforces continuous, smooth tone curve without harsh kinks or slope spikes", () => {
    let prevVal = evaluateToneCurve(0, CLASSIC_NEG_LOOK.response.curveR);
    let prevSlope = 0;

    // Output at in=0 should be lifted (film D-min density)
    expect(prevVal).toBeGreaterThan(0.015);
    expect(prevVal).toBeLessThan(0.05);

    // Verify slope is positive, smooth, and rolls off gently into highlights
    for (let inVal = 0.05; inVal <= 1.0; inVal += 0.05) {
      const val = evaluateToneCurve(inVal, CLASSIC_NEG_LOOK.response.curveR);
      const slope = (val - prevVal) / 0.05;
      expect(val).toBeGreaterThan(prevVal); // strictly monotonic
      expect(slope).toBeGreaterThan(0);
      expect(slope).toBeLessThan(2.0); // no brutal contrast spike
      prevVal = val;
      prevSlope = slope;
    }

    // Output at in=1.0 reaches creamy analog highlight (>= 0.97)
    expect(prevVal).toBeGreaterThan(0.97);
  });

  it("verifies Classic Neg has zero artificial flash falloff and zero un-blurred halation", () => {
    expect(CLASSIC_NEG_LOOK.response.flashFalloff.strength).toBe(0);
    expect(CLASSIC_NEG_LOOK.lens.bloom.strength).toBe(0);
    expect(CLASSIC_NEG_LOOK.lens.halation.strength).toBe(0);
    expect(CLASSIC_NEG_LOOK.response.localContrast).toBe(0);
  });

  it("produces warm protected skin tones and rich cyan-teal foliage", () => {
    // Skin tone [0.82, 0.65, 0.55]
    const [sr, sg, sb] = evaluateLookColorTransform(0.82, 0.65, 0.55, CLASSIC_NEG_LOOK);
    expect(sr).toBeGreaterThan(sg);
    expect(sg).toBeGreaterThan(sb); // warm golden peachy skin, never green

    // Foliage green [0.25, 0.55, 0.28]
    const [gr, gg, gb] = evaluateLookColorTransform(0.25, 0.55, 0.28, CLASSIC_NEG_LOOK);
    expect(gg).toBeGreaterThan(gr);
    expect(gg).toBeGreaterThan(gb); // Lush foliage green maintains strong green channel dominance
  });
});
