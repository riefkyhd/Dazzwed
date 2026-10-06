import type { ToneCurve, SplitTone, FlashFalloff } from "./types";

/**
 * Pure math implementation of filmic tone curve.
 * Evaluates in [0, 1] range:
 * 1. Pivot contrast: (x / pivot)^contrast * pivot (or sigmoidal)
 * 2. Toe lift: lifts deep blacks
 * 3. Shoulder compression: rolls off high specular values smoothly
 */
export function evaluateToneCurve(x: number, curve: ToneCurve): number {
  const clamped = Math.max(0, Math.min(1, x));

  // 1. Toe lift
  let val = curve.toe + clamped * (1 - curve.toe);

  // 2. Contrast around pivot
  const pivot = Math.max(0.01, Math.min(0.99, curve.pivot));
  if (val <= pivot) {
    val = pivot * Math.pow(val / pivot, curve.contrast);
  } else {
    val = 1 - (1 - pivot) * Math.pow((1 - val) / (1 - pivot), curve.contrast);
  }

  // 3. Shoulder rolloff
  if (curve.shoulder < 0.99) {
    const s = Math.max(0.1, curve.shoulder);
    if (val > s) {
      const over = (val - s) / (1 - s);
      val = s + (1 - s) * (1 - Math.exp(-over * 1.5));
    }
  }

  return Math.max(0, Math.min(1, val));
}

/**
 * Split toning with neutral-axis fadeout.
 * Near grayscale (low saturation), the hue adjustment fades to zero
 * to avoid color banding on skies, white walls, and skin highlights.
 */
export function applySplitTone(
  r: number,
  g: number,
  b: number,
  split: SplitTone
): [number, number, number] {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxChroma = Math.max(r, g, b) - Math.min(r, g, b);
  // Neutral axis weight: 0 when pure grayscale, 1 when saturated
  const saturationWeight = Math.min(1, maxChroma * 3.0);

  // Shadow vs Highlight balance threshold
  const mid = 0.5 + split.balance * 0.25;

  let outR = r;
  let outG = g;
  let outB = b;

  if (luma < mid && split.shadowSat > 0) {
    const t = (1 - luma / mid) * split.shadowSat * saturationWeight;
    const rad = (split.shadowHue * Math.PI) / 180;
    const tintR = 0.5 + 0.5 * Math.cos(rad);
    const tintG = 0.5 + 0.5 * Math.cos(rad - (2 * Math.PI) / 3);
    const tintB = 0.5 + 0.5 * Math.cos(rad + (2 * Math.PI) / 3);
    outR = outR * (1 - t) + outR * tintR * 2 * t;
    outG = outG * (1 - t) + outG * tintG * 2 * t;
    outB = outB * (1 - t) + outB * tintB * 2 * t;
  } else if (luma >= mid && split.highlightSat > 0) {
    const t = ((luma - mid) / (1 - mid)) * split.highlightSat * saturationWeight;
    const rad = (split.highlightHue * Math.PI) / 180;
    const tintR = 0.5 + 0.5 * Math.cos(rad);
    const tintG = 0.5 + 0.5 * Math.cos(rad - (2 * Math.PI) / 3);
    const tintB = 0.5 + 0.5 * Math.cos(rad + (2 * Math.PI) / 3);
    outR = outR * (1 - t) + outR * tintR * 2 * t;
    outG = outG * (1 - t) + outG * tintG * 2 * t;
    outB = outB * (1 - t) + outB * tintB * 2 * t;
  }

  return [Math.max(0, Math.min(1, outR)), Math.max(0, Math.min(1, outG)), Math.max(0, Math.min(1, outB))];
}

/**
 * Flash falloff math: boosts light near flash center and darkens distant background.
 */
export function calculateFlashFalloff(
  u: number,
  v: number,
  falloff: FlashFalloff,
  aspectRatio: number
): number {
  if (falloff.strength <= 0) return 1.0;
  const cx = falloff.centerX ?? 0.5;
  const cy = falloff.centerY ?? 0.5;

  const dx = (u - cx) * aspectRatio;
  const dy = v - cy;
  const dist = Math.hypot(dx, dy);

  const rad = Math.max(0.1, falloff.radius);
  const att = Math.max(0, 1 - dist / rad);
  const flashBoost = 1.0 + falloff.strength * (att * att - 0.3);
  return Math.max(0.2, flashBoost);
}

/**
 * Fast deterministic integer hash from a shot string / seed
 */
export function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Simple linear congruential PRNG
 */
export function createPRNG(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
