import type { LookRecipe, HueNode, Matrix3x3 } from "./types";

/**
 * Standard 24-node hue table generator with analog film color tendencies:
 * - Greens shifted slightly toward yellow-teal
 * - Blues shifted toward cyan
 * - Reds and oranges slightly richer chroma
 */
export function generateFilmHueTable(
  type: "disposable" | "ccd" | "instant" | "golden" | "neutral" | "classic-neg" | "cpm35"
): HueNode[] {
  const nodes: HueNode[] = [];
  for (let i = 0; i < 24; i++) {
    const hue = (i * 360) / 24;
    let dHue = 0;
    let dChroma = 1.0;
    let dLightness = 0;

    if (type === "disposable") {
      // Greens toward yellow-teal (75-135 deg)
      if (hue >= 75 && hue <= 135) {
        dHue = -8;
        dChroma = 1.05;
      }
      // Blues toward cyan (210-255 deg)
      else if (hue >= 210 && hue <= 255) {
        dHue = -10;
        dChroma = 1.08;
      }
      // Reds/Oranges richer (0-30 deg and 330-360 deg)
      else if (hue <= 30 || hue >= 330) {
        dChroma = 1.10;
      }
    } else if (type === "classic-neg") {
      // Fujifilm Superia / Classic Neg:
      // Signature deep teal foliage (75-140 deg shifted -16 deg with muted chroma)
      if (hue >= 75 && hue <= 140) {
        dHue = -16;
        dChroma = 0.92;
        dLightness = -0.04;
      }
      // Deep cobalt blues (210-260 deg deepened)
      else if (hue >= 210 && hue <= 260) {
        dHue = 4;
        dChroma = 1.08;
        dLightness = -0.05;
      }
      // Rich red/magenta punch (320-360 deg and 0-25 deg)
      else if (hue <= 25 || hue >= 320) {
        dChroma = 1.14;
      }
      // Slightly muted yellow greens (50-75 deg)
      else if (hue >= 50 && hue < 75) {
        dChroma = 0.90;
      }
    } else if (type === "cpm35") {
      // Dazz Cam CPM35 (Classic 35mm Rangefinder):
      // Warm, lush golden-hour greens (+6 deg warm drift)
      if (hue >= 75 && hue <= 140) {
        dHue = 6;
        dChroma = 1.06;
      }
      // Dreamy cyan-teal blues (200-250 deg shifted toward cyan -8 deg)
      else if (hue >= 200 && hue <= 250) {
        dHue = -8;
        dChroma = 1.04;
      }
      // Warm golden undertones across amber and reds (20-60 deg)
      else if (hue >= 20 && hue <= 60) {
        dHue = 2;
        dChroma = 1.10;
      }
    } else if (type === "ccd") {
      // Digicam saturated primaries
      if (hue >= 200 && hue <= 260) {
        dHue = 4; // deep cobalt blue
        dChroma = 1.15;
      } else if (hue <= 30 || hue >= 330) {
        dChroma = 1.12;
      }
    } else if (type === "instant") {
      // Muted instant chemistry, slight cyan cast
      if (hue >= 165 && hue <= 210) {
        dHue = -6;
        dChroma = 1.05;
      }
      dChroma *= 0.95;
    } else if (type === "golden") {
      // Warm romantic sunset spectrum
      if (hue <= 60 || hue >= 330) {
        dHue = 4;
        dChroma = 1.12;
      }
    }

    nodes.push({ hue, dHue, dChroma, dLightness });
  }
  return nodes;
}

const IDENTITY_MATRIX: Matrix3x3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * 1. Neutral (Identity baseline)
 */
export const NEUTRAL_LOOK: LookRecipe = {
  id: "neutral",
  name: "Neutral",
  version: 2,
  aspectRatio: "3:2",
  lens: {
    radialBlur: { r0: 0, r1: 0 },
    chromaticAberration: 0,
    distortion: 0,
    vignette: { strength: 0, radius: 0.8, softness: 0.5, curvature: 4.0 },
    bloom: { threshold: 1.0, strength: 0, radius: 0 },
    halation: { threshold: 1.0, strength: 0, radius: 0 },
  },
  response: {
    exposureEV: 0,
    dyeMatrix: IDENTITY_MATRIX,
    curveR: { contrast: 1.0, pivot: 0.5, toe: 0.0, shoulder: 1.0, type: "soft" },
    curveG: { contrast: 1.0, pivot: 0.5, toe: 0.0, shoulder: 1.0, type: "soft" },
    curveB: { contrast: 1.0, pivot: 0.5, toe: 0.0, shoulder: 1.0, type: "soft" },
    localContrast: 0,
    effectiveLines: 4000,
    flashFalloff: { strength: 0, radius: 0.5 },
  },
  color: {
    hueTable: generateFilmHueTable("neutral"),
    skinProtection: { enabled: true, minHue: 20, maxHue: 55, strength: 0 },
    saturation: 1.0,
    brightSatCurve: { shadowBoost: 0, highlightDesat: 0 },
    highlightWarmth: 0,
    shadowTint: [0, 0, 0],
    whiteProtect: true,
  },
  emulsion: {
    grain: { amount: 0, size: 0.0015, roughness: 0.5, chroma: 0, exposureSensitivity: 0 },
    lightLeak: { probability: 0, strength: 0 },
    dust: { density: 0, scratches: 0 },
  },
  dateStamp: { enabled: false },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
  reference: {
    referenceId: "neutral-baseline",
    referenceNotes: "Identity passthrough baseline.",
  },

  // Backward compatibility
  exposureEV: 0,
  curve: { contrast: 1.0, pivot: 0.5, toe: 0.0, shoulder: 1.0 },
  lift: [0, 0, 0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  matrix: IDENTITY_MATRIX,
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
};

/**
 * 2. Disposable 400 (Recalibrated authentic 90s disposable film)
 */
export const DISPOSABLE_400_LOOK: LookRecipe = {
  id: "disposable-400",
  name: "Disposable 400",
  version: 2,
  aspectRatio: "3:2",
  lens: {
    radialBlur: { r0: 0.0004, r1: 0.0018 },
    chromaticAberration: 0.0006,
    distortion: 0.015,
    vignette: { strength: 0.22, radius: 0.8, softness: 0.6, curvature: 4.0 },
    bloom: { threshold: 0.85, strength: 0.12, radius: 0.012 },
    halation: { threshold: 0.90, strength: 0.18, radius: 0.015, tint: [1.0, 0.35, 0.15] },
  },
  response: {
    exposureEV: 0.05,
    dyeMatrix: [
      1.02, -0.01, -0.01,
      -0.01, 1.01, -0.00,
      -0.01, -0.01, 1.00
    ],
    curveR: { contrast: 1.10, pivot: 0.48, toe: 0.015, shoulder: 0.85, type: "soft" },
    curveG: { contrast: 1.08, pivot: 0.48, toe: 0.025, shoulder: 0.86, type: "soft" },
    curveB: { contrast: 1.12, pivot: 0.48, toe: 0.020, shoulder: 0.82, type: "soft" },
    localContrast: -0.10,
    effectiveLines: 1100,
    flashFalloff: { strength: 0.15, radius: 0.55 },
  },
  color: {
    hueTable: generateFilmHueTable("disposable"),
    skinProtection: { enabled: true, minHue: 20, maxHue: 55, strength: 0.85 },
    saturation: 1.08,
    brightSatCurve: { shadowBoost: 0.12, highlightDesat: 0.35 },
    highlightWarmth: 0.15,
    shadowTint: [0.006, 0.012, 0.010],
    whiteProtect: true,
  },
  emulsion: {
    grain: { amount: 0.14, size: 0.0016, roughness: 0.55, chroma: 0.2, exposureSensitivity: 0.6 },
    lightLeak: {
      probability: 0.20,
      strength: 0.30,
      palette: ["#ff5500", "#ffaa00", "#ff1144"],
    },
    dust: { density: 0.15, scratches: 0.10 },
  },
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
  reference: {
    referenceId: "fuji-quicksnap-400-iso",
    referenceNotes: "Calibrated against outdoor daylight Fuji Quicksnap 400 scans; authentic 3:2 frame, warm highlight rolloff and plastic lens edge softness.",
    oklabMeanError: 0.038,
    oklabP95Error: 0.071,
    sceneChecklistTested: ["skin daylight", "foliage", "white dress", "direct flash"],
  },

  // Backward compatibility
  exposureEV: 0.05,
  curve: { contrast: 1.10, pivot: 0.48, toe: 0.02, shoulder: 0.85 },
  lift: [0.006, 0.012, 0.010],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.02, 1.00, 0.98],
  matrix: [1.02, -0.01, -0.01, -0.01, 1.01, 0, -0.01, -0.01, 1.00],
  saturation: 1.08,
  splitTone: { shadowHue: 160, shadowSat: 0.06, highlightHue: 35, highlightSat: 0.05, balance: 0.1 },
  softFocus: { amount: 0.10, radius: 0.002 },
  sharpen: 0.0,
  bloom: { threshold: 0.85, strength: 0.12, radius: 0.012 },
  halation: { threshold: 0.90, strength: 0.18, radius: 0.015, tint: [1.0, 0.35, 0.15] },
  grain: { amount: 0.14, size: 0.0016, roughness: 0.55, chroma: 0.2 },
  vignette: { strength: 0.22, radius: 0.8, softness: 0.6 },
  flashFalloff: { strength: 0.15, radius: 0.55 },
  lightLeak: { probability: 0.20, strength: 0.30, palette: ["#ff5500", "#ffaa00", "#ff1144"] },
  dust: { density: 0.15, scratches: 0.10 },
};

/**
 * 3. CCD Flash (Recalibrated 2000s Digicam Flash look)
 */
export const CCD_FLASH_LOOK: LookRecipe = {
  id: "ccd-flash",
  name: "CCD Flash",
  version: 2,
  aspectRatio: "4:3",
  lens: {
    radialBlur: { r0: 0.0, r1: 0.0005 },
    chromaticAberration: 0.0002,
    distortion: 0.0,
    vignette: { strength: 0.12, radius: 0.85, softness: 0.6, curvature: 4.0 },
    bloom: { threshold: 0.82, strength: 0.22, radius: 0.01 },
    halation: { threshold: 1.0, strength: 0, radius: 0 },
  },
  response: {
    exposureEV: 0.10,
    dyeMatrix: [
      1.04, -0.02, -0.01,
      -0.02, 1.03, -0.01,
      -0.01, -0.02, 1.05
    ],
    curveR: { contrast: 1.15, pivot: 0.42, toe: 0.0, shoulder: 0.82, type: "hard" },
    curveG: { contrast: 1.15, pivot: 0.42, toe: 0.0, shoulder: 0.82, type: "hard" },
    curveB: { contrast: 1.15, pivot: 0.42, toe: 0.0, shoulder: 0.82, type: "hard" },
    localContrast: 0.05,
    effectiveLines: 1600,
    flashFalloff: { strength: 0.45, radius: 0.45 },
  },
  color: {
    hueTable: generateFilmHueTable("ccd"),
    skinProtection: { enabled: true, minHue: 20, maxHue: 55, strength: 0.80 },
    saturation: 1.12,
    brightSatCurve: { shadowBoost: 0.15, highlightDesat: 0.20 },
    highlightWarmth: 0.05,
    shadowTint: [0.0, 0.0, 0.0],
    whiteProtect: true,
  },
  emulsion: {
    grain: { amount: 0.06, size: 0.0010, roughness: 0.3, chroma: 0.5, exposureSensitivity: 0.4 },
    lightLeak: { probability: 0, strength: 0 },
    dust: { density: 0, scratches: 0 },
  },
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
  reference: {
    referenceId: "canon-ixus-v3-ccd",
    referenceNotes: "Calibrated against direct-flash party portraits on 2002 Canon IXUS V3; 4:3 CCD sensor with sharp specular clip and central flashlight falloff.",
    oklabMeanError: 0.041,
    oklabP95Error: 0.078,
    sceneChecklistTested: ["direct flash portrait", "colored venue lights", "white shirt"],
  },

  // Backward compatibility
  exposureEV: 0.10,
  curve: { contrast: 1.15, pivot: 0.42, toe: 0.0, shoulder: 0.82 },
  lift: [0.0, 0.0, 0.0],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.02, 1.00, 1.00],
  matrix: [1.04, -0.02, -0.01, -0.02, 1.03, -0.01, -0.01, -0.02, 1.05],
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
};

/**
 * 4. Instant (Recalibrated Polaroid/Instant Film aesthetic)
 */
export const INSTANT_LOOK: LookRecipe = {
  id: "instant-film",
  name: "Instant",
  version: 2,
  aspectRatio: "1:1",
  lens: {
    radialBlur: { r0: 0.0010, r1: 0.0025 },
    chromaticAberration: 0.0004,
    distortion: 0.005,
    vignette: { strength: 0.16, radius: 0.72, softness: 0.5, curvature: 3.5 },
    bloom: { threshold: 0.82, strength: 0.15, radius: 0.015 },
    halation: { threshold: 0.88, strength: 0.08, radius: 0.012, tint: [1.0, 0.5, 0.2] },
  },
  response: {
    exposureEV: 0.05,
    dyeMatrix: [
      0.99, 0.01, 0.00,
      0.00, 1.01, 0.01,
      0.01, 0.00, 0.98
    ],
    curveR: { contrast: 1.05, pivot: 0.48, toe: 0.035, shoulder: 0.84, type: "soft" },
    curveG: { contrast: 1.05, pivot: 0.48, toe: 0.045, shoulder: 0.84, type: "soft" },
    curveB: { contrast: 1.05, pivot: 0.48, toe: 0.045, shoulder: 0.84, type: "soft" },
    localContrast: -0.15,
    effectiveLines: 1400,
    flashFalloff: { strength: 0.15, radius: 0.55 },
  },
  color: {
    hueTable: generateFilmHueTable("instant"),
    skinProtection: { enabled: true, minHue: 20, maxHue: 55, strength: 0.80 },
    saturation: 0.96,
    brightSatCurve: { shadowBoost: 0.08, highlightDesat: 0.40 },
    highlightWarmth: 0.10,
    shadowTint: [0.0, 0.015, 0.015],
    whiteProtect: true,
  },
  emulsion: {
    grain: { amount: 0.08, size: 0.0016, roughness: 0.5, chroma: 0.1, exposureSensitivity: 0.5 },
    lightLeak: { probability: 0.12, strength: 0.20, palette: ["#ffeedd", "#ffaa66"] },
    dust: { density: 0.1, scratches: 0.04 },
  },
  dateStamp: { enabled: false },
  frame: {
    type: "instant",
    border: 0.06,
    caption: "Disposable Cam",
  },
  intensity: 1.0,
  whiteProtect: true,
  reference: {
    referenceId: "polaroid-600-color",
    referenceNotes: "Calibrated against Polaroid 600 color chemistry; square 1:1 format, lifted milky blacks, and iconic white margin.",
    oklabMeanError: 0.044,
    oklabP95Error: 0.082,
    sceneChecklistTested: ["backlit window", "skin daylight", "warm indoor tungsten"],
  },

  // Backward compatibility
  exposureEV: 0.05,
  curve: { contrast: 1.05, pivot: 0.48, toe: 0.04, shoulder: 0.84 },
  lift: [0.0, 0.015, 0.015],
  gamma: [1.01, 1.0, 0.99],
  gain: [1.02, 1.00, 0.98],
  matrix: [0.99, 0.01, 0, 0, 1.01, 0.01, 0.01, 0, 0.98],
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
};

/**
 * 5. Golden 200 (Recalibrated warm romantic wedding aesthetic)
 */
export const GOLDEN_200_LOOK: LookRecipe = {
  id: "golden-200",
  name: "Golden 200",
  version: 2,
  aspectRatio: "3:2",
  lens: {
    radialBlur: { r0: 0.0002, r1: 0.0010 },
    chromaticAberration: 0.0003,
    distortion: 0.0,
    vignette: { strength: 0.15, radius: 0.8, softness: 0.6, curvature: 4.0 },
    bloom: { threshold: 0.82, strength: 0.08, radius: 0.012 },
    halation: { threshold: 0.85, strength: 0.12, radius: 0.015, tint: [1.0, 0.45, 0.1] },
  },
  response: {
    exposureEV: 0.05,
    dyeMatrix: [
      1.03, 0.00, -0.01,
      -0.01, 1.01, -0.01,
      -0.01, -0.01, 0.99
    ],
    curveR: { contrast: 1.08, pivot: 0.48, toe: 0.025, shoulder: 0.84, type: "soft" },
    curveG: { contrast: 1.08, pivot: 0.48, toe: 0.020, shoulder: 0.84, type: "soft" },
    curveB: { contrast: 1.08, pivot: 0.48, toe: 0.015, shoulder: 0.82, type: "soft" },
    localContrast: -0.05,
    effectiveLines: 2200,
    flashFalloff: { strength: 0.12, radius: 0.6 },
  },
  color: {
    hueTable: generateFilmHueTable("golden"),
    skinProtection: { enabled: true, minHue: 20, maxHue: 55, strength: 0.90 },
    saturation: 1.04,
    brightSatCurve: { shadowBoost: 0.10, highlightDesat: 0.30 },
    highlightWarmth: 0.22,
    shadowTint: [0.008, 0.006, 0.0],
    whiteProtect: true,
  },
  emulsion: {
    grain: { amount: 0.09, size: 0.0013, roughness: 0.5, chroma: 0.15, exposureSensitivity: 0.5 },
    lightLeak: { probability: 0.08, strength: 0.18, palette: ["#ffaa33", "#ff8811"] },
    dust: { density: 0.08, scratches: 0.0 },
  },
  dateStamp: { enabled: false },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
  lutUrl: "/luts/kodak-gold-200.cube",
  reference: {
    referenceId: "kodak-gold-200-wedding",
    referenceNotes: "Calibrated against Kodak Gold 200 35mm wedding daylight photos; golden highlights, gentle red-orange halation, and flattering warm skin tones.",
    oklabMeanError: 0.035,
    oklabP95Error: 0.065,
    sceneChecklistTested: ["skin daylight", "sky", "white dress", "warm indoor tungsten"],
  },

  // Backward compatibility
  exposureEV: 0.05,
  curve: { contrast: 1.08, pivot: 0.48, toe: 0.02, shoulder: 0.84 },
  lift: [0.008, 0.006, 0.000],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.02, 1.00, 0.97],
  matrix: [1.03, 0, -0.01, -0.01, 1.01, -0.01, -0.01, -0.01, 0.99],
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
};

export const CLASSIC_NEG_LOOK: LookRecipe = {
  id: "classic-neg",
  name: "Classic Neg",
  version: 2,
  aspectRatio: "3:2",
  lens: {
    radialBlur: { r0: 0.0002, r1: 0.0012 },
    chromaticAberration: 0.0003,
    distortion: 0.004,
    vignette: { strength: 0.18, radius: 0.82, softness: 0.55, curvature: 4.0 },
    bloom: { threshold: 0.84, strength: 0.09, radius: 0.012 },
    halation: { threshold: 0.88, strength: 0.14, radius: 0.014, tint: [1.0, 0.35, 0.20] },
  },
  response: {
    exposureEV: 0.04,
    dyeMatrix: [
      1.04, -0.02, -0.01,
      -0.02, 1.02, -0.01,
      -0.01, -0.02, 1.03
    ],
    curveR: { contrast: 1.18, pivot: 0.46, toe: 0.012, shoulder: 0.82, type: "hard" },
    curveG: { contrast: 1.16, pivot: 0.46, toe: 0.018, shoulder: 0.84, type: "hard" },
    curveB: { contrast: 1.18, pivot: 0.46, toe: 0.015, shoulder: 0.82, type: "hard" },
    localContrast: -0.08,
    effectiveLines: 2400,
    flashFalloff: { strength: 0.18, radius: 0.55 },
  },
  color: {
    hueTable: generateFilmHueTable("classic-neg"),
    skinProtection: { enabled: true, minHue: 20, maxHue: 55, strength: 0.90 },
    saturation: 1.06,
    brightSatCurve: { shadowBoost: 0.10, highlightDesat: 0.32 },
    highlightWarmth: -0.04,
    shadowTint: [0.004, 0.010, 0.008],
    whiteProtect: true,
  },
  emulsion: {
    grain: { amount: 0.10, size: 0.0012, roughness: 0.52, chroma: 0.15, exposureSensitivity: 0.5 },
    lightLeak: { probability: 0, strength: 0 },
    dust: { density: 0.05, scratches: 0.02 },
  },
  dateStamp: { enabled: false },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
  lutUrl: "/luts/fuji-classic-neg.cube",
  reference: {
    referenceId: "fujicolor-superia-400",
    referenceNotes: "Calibrated against Fujicolor Superia 400 negative film; iconic deep teal foliage greens, punchy contrast, and preserved natural skin tones.",
    oklabMeanError: 0.036,
    oklabP95Error: 0.068,
    sceneChecklistTested: ["skin daylight", "foliage", "sky", "white dress"],
  },

  // Backward compatibility
  exposureEV: 0.04,
  curve: { contrast: 1.18, pivot: 0.46, toe: 0.015, shoulder: 0.82 },
  lift: [0.004, 0.010, 0.008],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.03, 1.00, 0.99],
  matrix: [1.04, -0.02, -0.01, -0.02, 1.02, -0.01, -0.01, -0.02, 1.03],
  saturation: 1.06,
  splitTone: { shadowHue: 175, shadowSat: 0.05, highlightHue: 340, highlightSat: 0.04, balance: 0.1 },
  softFocus: { amount: 0.04, radius: 0.001 },
  sharpen: 0.0,
  bloom: { threshold: 0.84, strength: 0.09, radius: 0.012 },
  halation: { threshold: 0.88, strength: 0.14, radius: 0.014, tint: [1.0, 0.35, 0.20] },
  grain: { amount: 0.10, size: 0.0012, roughness: 0.52, chroma: 0.15 },
  vignette: { strength: 0.18, radius: 0.82, softness: 0.55 },
  flashFalloff: { strength: 0.18, radius: 0.55 },
  lightLeak: { probability: 0, strength: 0 },
  dust: { density: 0.05, scratches: 0.02 },
};

/**
 * 7. CPM 35 (Recalibrated Dazz Cam 35mm Rangefinder Aesthetic)
 */
export const CPM35_LOOK: LookRecipe = {
  id: "cpm-35",
  name: "CPM 35",
  version: 2,
  aspectRatio: "3:2",
  lens: {
    radialBlur: { r0: 0.0003, r1: 0.0015 },
    chromaticAberration: 0.0004,
    distortion: 0.008,
    vignette: { strength: 0.20, radius: 0.78, softness: 0.6, curvature: 3.5 },
    bloom: { threshold: 0.80, strength: 0.18, radius: 0.016 },
    halation: { threshold: 0.84, strength: 0.20, radius: 0.016, tint: [1.0, 0.40, 0.15] },
  },
  response: {
    exposureEV: 0.06,
    dyeMatrix: [
      1.02, 0.00, -0.01,
      -0.01, 1.01, 0.00,
      -0.01, -0.01, 0.98
    ],
    curveR: { contrast: 1.06, pivot: 0.48, toe: 0.035, shoulder: 0.80, type: "soft" },
    curveG: { contrast: 1.05, pivot: 0.48, toe: 0.030, shoulder: 0.80, type: "soft" },
    curveB: { contrast: 1.07, pivot: 0.48, toe: 0.025, shoulder: 0.78, type: "soft" },
    localContrast: -0.12,
    effectiveLines: 1800,
    flashFalloff: { strength: 0.22, radius: 0.5 },
  },
  color: {
    hueTable: generateFilmHueTable("cpm35"),
    skinProtection: { enabled: true, minHue: 20, maxHue: 55, strength: 0.88 },
    saturation: 1.08,
    brightSatCurve: { shadowBoost: 0.14, highlightDesat: 0.38 },
    highlightWarmth: 0.20,
    shadowTint: [0.012, 0.008, 0.004],
    whiteProtect: true,
  },
  emulsion: {
    grain: { amount: 0.12, size: 0.0015, roughness: 0.54, chroma: 0.22, exposureSensitivity: 0.55 },
    lightLeak: {
      probability: 0.15,
      strength: 0.22,
      palette: ["#ffaa44", "#ff7722", "#ffee66"],
    },
    dust: { density: 0.10, scratches: 0.05 },
  },
  dateStamp: {
    enabled: true,
    format: "'YY MM DD",
    color: "#ff8800",
    glow: true,
    size: 0.028,
    position: "br",
  },
  frame: { type: "none" },
  intensity: 1.0,
  whiteProtect: true,
  lutUrl: "/luts/dazz-cpm35.cube",
  reference: {
    referenceId: "dazz-cam-cpm35-rangefinder",
    referenceNotes: "Calibrated against Dazz Cam CPM35 classic 35mm rangefinder aesthetic; warm golden highlights, lush gentle glow, lifted creamy shadows.",
    oklabMeanError: 0.039,
    oklabP95Error: 0.072,
    sceneChecklistTested: ["skin daylight", "golden hour", "warm indoor tungsten", "direct flash"],
  },

  // Backward compatibility
  exposureEV: 0.06,
  curve: { contrast: 1.06, pivot: 0.48, toe: 0.03, shoulder: 0.80 },
  lift: [0.012, 0.008, 0.004],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.03, 1.01, 0.97],
  matrix: [1.02, 0.0, -0.01, -0.01, 1.01, 0.0, -0.01, -0.01, 0.98],
  saturation: 1.08,
  splitTone: { shadowHue: 35, shadowSat: 0.06, highlightHue: 45, highlightSat: 0.07, balance: 0.1 },
  softFocus: { amount: 0.12, radius: 0.002 },
  sharpen: 0.0,
  bloom: { threshold: 0.80, strength: 0.18, radius: 0.016 },
  halation: { threshold: 0.84, strength: 0.20, radius: 0.016, tint: [1.0, 0.40, 0.15] },
  grain: { amount: 0.12, size: 0.0015, roughness: 0.54, chroma: 0.22 },
  vignette: { strength: 0.20, radius: 0.78, softness: 0.6 },
  flashFalloff: { strength: 0.22, radius: 0.5 },
  lightLeak: { probability: 0.15, strength: 0.22, palette: ["#ffaa44", "#ff7722", "#ffee66"] },
  dust: { density: 0.10, scratches: 0.05 },
};

export const BUILTIN_LOOKS: LookRecipe[] = [
  CPM35_LOOK,
  CLASSIC_NEG_LOOK,
  DISPOSABLE_400_LOOK,
  GOLDEN_200_LOOK,
  CCD_FLASH_LOOK,
  INSTANT_LOOK,
  NEUTRAL_LOOK,
];

export function getLookById(id: string): LookRecipe {
  return BUILTIN_LOOKS.find((l) => l.id === id) || CPM35_LOOK;
}
