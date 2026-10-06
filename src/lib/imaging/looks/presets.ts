import type { LookRecipe } from "./types";

/**
 * 1. Neutral (Identity baseline)
 */
export const NEUTRAL_LOOK: LookRecipe = {
  id: "neutral",
  name: "Neutral",
  version: 2,
  exposureEV: 0,
  curve: { contrast: 1.0, pivot: 0.5, toe: 0.0, shoulder: 1.0 },
  lift: [0, 0, 0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  saturation: 1.0,
  splitTone: { shadowHue: 0, shadowSat: 0, highlightHue: 0, highlightSat: 0, balance: 0 },
  softFocus: { amount: 0, radius: 0 },
  sharpen: 0,
  bloom: { threshold: 1.0, strength: 0, radius: 0 },
  halation: { threshold: 1.0, strength: 0, radius: 0 },
  grain: { amount: 0, size: 0.0015, roughness: 0.5, chroma: 0 },
  vignette: { strength: 0, radius: 0.8, softness: 0.5 },
  flashFalloff: { strength: 0, radius: 0.5 },
  lightLeak: { probability: 0, strength: 0 },
  dust: { density: 0, scratches: 0 },
  dateStamp: { enabled: false },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
};

/**
 * 2. Disposable 400 (Recalibrated authentic 90s disposable film)
 */
export const DISPOSABLE_400_LOOK: LookRecipe = {
  id: "disposable-400",
  name: "Disposable 400",
  version: 2,
  exposureEV: 0.05,
  curve: { contrast: 1.10, pivot: 0.48, toe: 0.02, shoulder: 0.85 },
  lift: [0.006, 0.012, 0.010],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.02, 1.00, 0.98],
  saturation: 1.08,
  splitTone: {
    shadowHue: 160,
    shadowSat: 0.06,
    highlightHue: 35,
    highlightSat: 0.05,
    balance: 0.1,
  },
  softFocus: { amount: 0.10, radius: 0.002 },
  sharpen: 0.0,
  bloom: { threshold: 0.85, strength: 0.12, radius: 0.012 },
  halation: {
    threshold: 0.90,
    strength: 0.18,
    radius: 0.015,
    tint: [1.0, 0.35, 0.15],
  },
  grain: { amount: 0.14, size: 0.0016, roughness: 0.55, chroma: 0.2 },
  vignette: { strength: 0.22, radius: 0.8, softness: 0.6 },
  flashFalloff: { strength: 0.15, radius: 0.55 },
  lightLeak: {
    probability: 0.20,
    strength: 0.30,
    palette: ["#ff5500", "#ffaa00", "#ff1144"],
  },
  dust: { density: 0.15, scratches: 0.10 },
  dateStamp: {
    enabled: true,
    format: "'YY MM DD",
    color: "#ff7700",
    glow: true,
    size: 0.028,
    position: "br",
  },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
};

/**
 * 3. CCD Flash (Recalibrated 2000s Digicam Flash look)
 */
export const CCD_FLASH_LOOK: LookRecipe = {
  id: "ccd-flash",
  name: "CCD Flash",
  version: 2,
  exposureEV: 0.10,
  curve: { contrast: 1.15, pivot: 0.42, toe: 0.0, shoulder: 0.82 },
  lift: [0.0, 0.0, 0.0],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.02, 1.00, 1.00],
  saturation: 1.12,
  splitTone: { shadowHue: 240, shadowSat: 0.04, highlightHue: 50, highlightSat: 0.04, balance: 0.2 },
  softFocus: { amount: 0.0, radius: 0.0 },
  sharpen: 0.2,
  bloom: { threshold: 0.82, strength: 0.22, radius: 0.01 },
  halation: { threshold: 1.0, strength: 0, radius: 0 },
  grain: { amount: 0.06, size: 0.0010, roughness: 0.3, chroma: 0.5 },
  vignette: { strength: 0.12, radius: 0.85, softness: 0.6 },
  flashFalloff: { strength: 0.45, radius: 0.45 },
  lightLeak: { probability: 0, strength: 0 },
  dust: { density: 0, scratches: 0 },
  dateStamp: {
    enabled: true,
    format: "'YY MM DD",
    color: "#ffaa00",
    glow: false,
    size: 0.026,
    position: "br",
  },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
};

/**
 * 4. Instant (Recalibrated Polaroid/Instant Film aesthetic)
 */
export const INSTANT_LOOK: LookRecipe = {
  id: "instant-film",
  name: "Instant",
  version: 2,
  exposureEV: 0.05,
  curve: { contrast: 1.05, pivot: 0.48, toe: 0.04, shoulder: 0.84 },
  lift: [0.0, 0.015, 0.015],
  gamma: [1.01, 1.0, 0.99],
  gain: [1.02, 1.00, 0.98],
  saturation: 0.96,
  splitTone: { shadowHue: 185, shadowSat: 0.06, highlightHue: 40, highlightSat: 0.05, balance: 0.0 },
  softFocus: { amount: 0.22, radius: 0.003 },
  sharpen: 0.0,
  bloom: { threshold: 0.82, strength: 0.15, radius: 0.015 },
  halation: { threshold: 0.88, strength: 0.08, radius: 0.012, tint: [1.0, 0.5, 0.2] },
  grain: { amount: 0.08, size: 0.0016, roughness: 0.5, chroma: 0.1 },
  vignette: { strength: 0.16, radius: 0.72, softness: 0.5 },
  flashFalloff: { strength: 0.15, radius: 0.55 },
  lightLeak: { probability: 0.12, strength: 0.20, palette: ["#ffeedd", "#ffaa66"] },
  dust: { density: 0.1, scratches: 0.04 },
  dateStamp: { enabled: false },
  frame: {
    type: "instant",
    border: 0.06,
    caption: "Disposable Cam",
  },
  intensity: 1.0,
  whiteProtect: true,
};

/**
 * 5. Golden 200 (Recalibrated warm romantic wedding aesthetic)
 */
export const GOLDEN_200_LOOK: LookRecipe = {
  id: "golden-200",
  name: "Golden 200",
  version: 2,
  exposureEV: 0.05,
  curve: { contrast: 1.08, pivot: 0.48, toe: 0.02, shoulder: 0.84 },
  lift: [0.008, 0.006, 0.000],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.02, 1.00, 0.97],
  saturation: 1.04,
  splitTone: { shadowHue: 25, shadowSat: 0.05, highlightHue: 42, highlightSat: 0.06, balance: 0.2 },
  softFocus: { amount: 0.08, radius: 0.0015 },
  sharpen: 0.0,
  bloom: { threshold: 0.82, strength: 0.08, radius: 0.012 },
  halation: { threshold: 0.85, strength: 0.12, radius: 0.015, tint: [1.0, 0.45, 0.1] },
  grain: { amount: 0.09, size: 0.0013, roughness: 0.5, chroma: 0.15 },
  vignette: { strength: 0.15, radius: 0.8, softness: 0.6 },
  flashFalloff: { strength: 0.12, radius: 0.6 },
  lightLeak: { probability: 0.08, strength: 0.18, palette: ["#ffaa33", "#ff8811"] },
  dust: { density: 0.08, scratches: 0.0 },
  dateStamp: { enabled: false },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
};

export const BUILTIN_LOOKS: LookRecipe[] = [
  DISPOSABLE_400_LOOK,
  CCD_FLASH_LOOK,
  INSTANT_LOOK,
  GOLDEN_200_LOOK,
  NEUTRAL_LOOK,
];

export function getLookById(id: string): LookRecipe {
  return BUILTIN_LOOKS.find((l) => l.id === id) || DISPOSABLE_400_LOOK;
}
