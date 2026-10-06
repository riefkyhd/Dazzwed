import type { LookRecipe } from "./types";

/**
 * 1. Neutral (Identity for exact tests and baseline)
 */
export const NEUTRAL_LOOK: LookRecipe = {
  id: "neutral",
  name: "Neutral",
  version: 1,
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
};

/**
 * 2. Disposable 400 (Default disposable camera vibe)
 */
export const DISPOSABLE_400_LOOK: LookRecipe = {
  id: "disposable-400",
  name: "Disposable 400",
  version: 1,
  exposureEV: 0.15,
  curve: { contrast: 0.55, pivot: 0.45, toe: 0.04, shoulder: 0.5 },
  lift: [0.01, 0.025, 0.015], // slightly green/teal shadows
  gamma: [1.0, 1.0, 1.0],
  gain: [1.05, 1.0, 0.92], // warm amber highlights
  saturation: 1.12,
  splitTone: {
    shadowHue: 160,
    shadowSat: 0.1,
    highlightHue: 35,
    highlightSat: 0.12,
    balance: 0.1,
  },
  softFocus: { amount: 0.15, radius: 0.002 },
  sharpen: 0.0,
  bloom: { threshold: 0.8, strength: 0.15, radius: 0.012 },
  halation: {
    threshold: 0.85,
    strength: 0.25,
    radius: 0.015,
    tint: [1.0, 0.35, 0.15], // red-orange edge halation
  },
  grain: { amount: 0.16, size: 0.0016, roughness: 0.55, chroma: 0.25 },
  vignette: { strength: 0.35, radius: 0.75, softness: 0.5 },
  flashFalloff: { strength: 0.25, radius: 0.55 },
  lightLeak: {
    probability: 0.25,
    strength: 0.35,
    palette: ["#ff5500", "#ffaa00", "#ff1144"],
  },
  dust: { density: 0.2, scratches: 0.15 },
  dateStamp: {
    enabled: true,
    format: "'YY MM DD",
    color: "#ff7700",
    glow: true,
    size: 0.028,
    position: "br",
  },
  frame: { type: "none" },
};

/**
 * 3. CCD Flash (2000s Digicam Flash look)
 */
export const CCD_FLASH_LOOK: LookRecipe = {
  id: "ccd-flash",
  name: "CCD Flash",
  version: 1,
  exposureEV: 0.25,
  curve: { contrast: 0.7, pivot: 0.4, toe: 0.0, shoulder: 0.2 }, // harder clipping
  lift: [0.0, 0.0, 0.0],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.04, 0.98, 1.0], // slight magenta-warm cast
  saturation: 1.2,
  splitTone: { shadowHue: 240, shadowSat: 0.05, highlightHue: 50, highlightSat: 0.08, balance: 0.2 },
  softFocus: { amount: 0.05, radius: 0.001 },
  sharpen: 0.3, // digital CCD edge sharpening
  bloom: { threshold: 0.75, strength: 0.3, radius: 0.01 }, // specular flash bloom
  halation: { threshold: 1.0, strength: 0, radius: 0 },
  grain: { amount: 0.07, size: 0.001, roughness: 0.3, chroma: 0.6 }, // colored sensor noise
  vignette: { strength: 0.15, radius: 0.85, softness: 0.6 },
  flashFalloff: { strength: 0.6, radius: 0.45 }, // strong flashlight center falloff
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
};

/**
 * 4. Instant (Polaroid/Instant Film aesthetic)
 */
export const INSTANT_LOOK: LookRecipe = {
  id: "instant-film",
  name: "Instant",
  version: 1,
  exposureEV: 0.1,
  curve: { contrast: 0.35, pivot: 0.5, toe: 0.07, shoulder: 0.6 }, // lifted milky blacks
  lift: [0.0, 0.03, 0.03], // cyan-green shadows
  gamma: [1.02, 1.0, 0.98],
  gain: [1.04, 1.0, 0.94],
  saturation: 0.92, // muted instant colors
  splitTone: { shadowHue: 190, shadowSat: 0.08, highlightHue: 40, highlightSat: 0.06, balance: 0.0 },
  softFocus: { amount: 0.3, radius: 0.003 }, // soft plastic lens
  sharpen: 0.0,
  bloom: { threshold: 0.82, strength: 0.2, radius: 0.015 },
  halation: { threshold: 0.88, strength: 0.1, radius: 0.012, tint: [1.0, 0.5, 0.2] },
  grain: { amount: 0.09, size: 0.0016, roughness: 0.5, chroma: 0.1 },
  vignette: { strength: 0.25, radius: 0.7, softness: 0.5 },
  flashFalloff: { strength: 0.2, radius: 0.55 },
  lightLeak: { probability: 0.15, strength: 0.25, palette: ["#ffeedd", "#ffaa66"] },
  dust: { density: 0.1, scratches: 0.05 },
  dateStamp: { enabled: false },
  frame: {
    type: "instant",
    border: 0.06,
    caption: "Disposable Cam",
  },
};

/**
 * 5. Golden 200 (Warm romantic wedding aesthetic)
 */
export const GOLDEN_200_LOOK: LookRecipe = {
  id: "golden-200",
  name: "Golden 200",
  version: 1,
  exposureEV: 0.1,
  curve: { contrast: 0.45, pivot: 0.48, toe: 0.03, shoulder: 0.6 },
  lift: [0.015, 0.01, 0.0],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.06, 1.0, 0.88], // golden sunlight
  saturation: 1.05,
  splitTone: { shadowHue: 25, shadowSat: 0.06, highlightHue: 42, highlightSat: 0.18, balance: 0.2 },
  softFocus: { amount: 0.1, radius: 0.0015 },
  sharpen: 0.0,
  bloom: { threshold: 0.82, strength: 0.1, radius: 0.012 },
  halation: { threshold: 0.85, strength: 0.15, radius: 0.015, tint: [1.0, 0.45, 0.1] },
  grain: { amount: 0.1, size: 0.0013, roughness: 0.5, chroma: 0.15 },
  vignette: { strength: 0.2, radius: 0.8, softness: 0.6 },
  flashFalloff: { strength: 0.15, radius: 0.6 },
  lightLeak: { probability: 0.1, strength: 0.2, palette: ["#ffaa33", "#ff8811"] },
  dust: { density: 0.1, scratches: 0.0 },
  dateStamp: { enabled: false },
  frame: { type: "none" },
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
