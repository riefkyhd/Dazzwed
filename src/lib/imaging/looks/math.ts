import type { ToneCurve, SplitTone, FlashFalloff, HueNode, ColorGrading, Matrix3x3 } from "./types";

/**
 * Linear Color Space conversions with guarded thresholds
 */
export function srgbToLinear(c: number): number {
  return c <= 0.04045
    ? c / 12.92
    : Math.pow(Math.max(1e-4, (c + 0.055) / 1.055), 2.4);
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308
    ? c * 12.92
    : 1.055 * Math.pow(Math.max(1e-4, c), 1.0 / 2.4) - 0.055;
}

/**
 * OKLab & OKLCH Color Space Implementation
 * Designed with numeric guards:
 * - Safe cube roots and pows
 * - Safe atan2 and angle normalization
 * - Constant-hue, constant-lightness chroma gamut compression
 */
export function linearSrgbToOklab(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(Math.max(1e-5, l));
  const m_ = Math.cbrt(Math.max(1e-5, m));
  const s_ = Math.cbrt(Math.max(1e-5, s));

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  return [L, a, b_];
}

export function oklabToLinearSrgb(
  L: number,
  a: number,
  b_: number
): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b_;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b_;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b_;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [r, g, b];
}

export function oklabToOklch(
  L: number,
  a: number,
  b_: number
): [number, number, number] {
  const C = Math.hypot(a, b_);
  let h = (Math.atan2(b_, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, C, h];
}

export function oklchToOklab(
  L: number,
  C: number,
  hDeg: number
): [number, number, number] {
  const rad = (hDeg * Math.PI) / 180;
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

/**
 * Chroma-based Gamut Compression:
 * If a color exceeds sRGB gamut, compress chroma C along constant hue and lightness.
 * Eliminates channel clipping, hue flips, and black overshoot artifacts.
 */
export function fitOklchToGamut(
  L: number,
  C: number,
  hDeg: number
): [number, number, number] {
  if (L <= 0) return [0, 0, 0];
  if (L >= 1) return [1, 1, 1];

  const [a, b_] = [C * Math.cos((hDeg * Math.PI) / 180), C * Math.sin((hDeg * Math.PI) / 180)];
  const [r, g, b] = oklabToLinearSrgb(L, a, b_);

  if (r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1) {
    return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
  }

  // Binary search for max in-gamut chroma
  let low = 0;
  let high = C;
  for (let i = 0; i < 8; i++) {
    const mid = (low + high) * 0.5;
    const testA = mid * Math.cos((hDeg * Math.PI) / 180);
    const testB = mid * Math.sin((hDeg * Math.PI) / 180);
    const [tr, tg, tb] = oklabToLinearSrgb(L, testA, testB);
    if (tr >= 0 && tr <= 1 && tg >= 0 && tg <= 1 && tb >= 0 && tb <= 1) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const finalA = low * Math.cos((hDeg * Math.PI) / 180);
  const finalB = low * Math.sin((hDeg * Math.PI) / 180);
  const [fr, fg, fb] = oklabToLinearSrgb(L, finalA, finalB);
  return [Math.max(0, Math.min(1, fr)), Math.max(0, Math.min(1, fg)), Math.max(0, Math.min(1, fb))];
}

/**
 * Interpolate 24-node hue LUT smoothly with circular wrap
 */
export function evaluateHueTable(
  hDeg: number,
  table: HueNode[]
): { dHue: number; dChroma: number; dLightness: number } {
  if (!table || table.length === 0) {
    return { dHue: 0, dChroma: 1, dLightness: 0 };
  }

  const normalizedH = ((hDeg % 360) + 360) % 360;
  const n = table.length;

  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    const h1 = table[i].hue;
    let h2 = table[nextIdx].hue;
    if (h2 <= h1) h2 += 360;

    let targetH = normalizedH;
    if (targetH < h1) targetH += 360;

    if (targetH >= h1 && targetH <= h2) {
      const t = (targetH - h1) / Math.max(1e-4, h2 - h1);
      // Smoothstep interpolation
      const st = t * t * (3 - 2 * t);
      const nodeA = table[i];
      const nodeB = table[nextIdx];

      return {
        dHue: nodeA.dHue * (1 - st) + nodeB.dHue * st,
        dChroma: nodeA.dChroma * (1 - st) + nodeB.dChroma * st,
        dLightness: nodeA.dLightness * (1 - st) + nodeB.dLightness * st,
      };
    }
  }

  return { dHue: table[0].dHue, dChroma: table[0].dChroma, dLightness: table[0].dLightness };
}

/**
 * Skin hue protection factor: returns damping weight (0.0 to 1.0)
 * Inside 20 deg to 55 deg, hue shifts are reduced to protect human skin tones.
 */
export function calculateSkinDamping(
  hDeg: number,
  skinProtection: ColorGrading["skinProtection"]
): number {
  if (!skinProtection?.enabled) return 1.0;
  const { minHue, maxHue, strength } = skinProtection;
  const h = ((hDeg % 360) + 360) % 360;

  if (h >= minHue && h <= maxHue) {
    const center = (minHue + maxHue) * 0.5;
    const halfWidth = (maxHue - minHue) * 0.5;
    const dist = Math.abs(h - center) / Math.max(1e-4, halfWidth);
    const weight = 1.0 - Math.min(1, dist);
    return Math.max(0.1, 1.0 - weight * strength);
  }
  return 1.0;
}

/**
 * Filmic tone curve evaluation supporting soft shoulder and hard CCD shoulder
 */
export function evaluateToneCurve(x: number, curve: ToneCurve): number {
  const clamped = Math.max(0, Math.min(1, x));

  // 1. Toe lift
  const toe = Math.max(0, Math.min(0.5, curve.toe));
  let val = Math.max(0, Math.min(1, toe + clamped * (1 - toe)));

  // 2. Contrast around pivot
  const pivot = Math.max(0.01, Math.min(0.99, curve.pivot));
  const contrast = Math.max(0.1, curve.contrast);
  if (val <= pivot) {
    val = pivot * Math.pow(Math.max(1e-4, val / pivot), contrast);
  } else {
    const highBase = Math.max(0, Math.min(1, (1 - val) / Math.max(1e-4, 1 - pivot)));
    val = 1 - (1 - pivot) * Math.pow(Math.max(1e-4, highBase), contrast);
  }

  // 3. Shoulder rolloff (soft film rolloff vs hard CCD shoulder)
  if (curve.shoulder < 0.99) {
    const s = Math.max(0.1, curve.shoulder);
    if (val > s) {
      if (curve.type === "hard") {
        // Sharp knee for CCD sensor clipping
        val = s + (1 - s) * Math.min(1, (val - s) / Math.max(1e-4, 1 - s) * 0.6);
      } else {
        // Smooth asymptotic shoulder for film
        const over = (val - s) / Math.max(1e-4, 1 - s);
        val = s + (1 - s) * (1 - Math.exp(-over * 1.5));
      }
    }
  }

  return Math.max(0, Math.min(1, val));
}

/**
 * 3x3 Matrix Multiplication on 3D Vector
 */
export function multiplyMatrix3x3(m: Matrix3x3, v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/**
 * Split toning with neutral-axis fadeout
 */
export function applySplitTone(
  r: number,
  g: number,
  b: number,
  split: SplitTone
): [number, number, number] {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxChroma = Math.max(r, g, b) - Math.min(r, g, b);
  const saturationWeight = Math.min(1, maxChroma * 3.0);
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
    const t = ((luma - mid) / Math.max(1e-4, 1 - mid)) * split.highlightSat * saturationWeight;
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
 * Calculate OKLab delta E difference
 */
export function calculateDeltaE(
  c1: [number, number, number],
  c2: [number, number, number]
): number {
  const [L1, a1, b1] = linearSrgbToOklab(c1[0], c1[1], c1[2]);
  const [L2, a2, b2] = linearSrgbToOklab(c2[0], c2[1], c2[2]);
  return Math.hypot(L1 - L2, a1 - a2, b1 - b2);
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
