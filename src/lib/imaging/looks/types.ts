/**
 * Look Engine v2 Recipe Types: Camera System Architecture
 *
 * A look is a complete camera system:
 * Lens Model -> Capture / Film Response -> Emulsion Artifacts -> In-Camera Processing -> Output
 *
 * All spatial parameters (grain size, blur radius, vignette, halation radius, stamp size)
 * are fractions of frame height (0.0 to 1.0), never absolute pixels.
 */

export interface ToneCurve {
  contrast: number; // Pivot contrast (1.0 = linear)
  pivot: number; // Pivot center for contrast (typically 0.18 - 0.5)
  toe: number; // Lift black level / shadow compression (0.0 = true black)
  shoulder: number; // Highlight rolloff (1.0 = linear, lower = soft compression)
  type?: "soft" | "hard"; // "hard" for CCD Flash, "soft" for film looks
}

export interface SplitTone {
  shadowHue: number; // 0 - 360 degrees
  shadowSat: number; // 0.0 - 1.0
  highlightHue: number; // 0 - 360 degrees
  highlightSat: number; // 0.0 - 1.0
  balance: number; // -1.0 (favor shadows) to +1.0 (favor highlights), 0 = centered
}

export interface SoftFocus {
  amount: number; // 0.0 to 1.0 mix
  radius: number; // Fraction of frame height (e.g. 0.002 - 0.005)
}

export interface BloomHalation {
  threshold: number; // Minimum luminance to bleed (0.0 - 1.0)
  strength: number; // Blend intensity (0.0 - 1.0)
  radius: number; // Fraction of frame height
  tint?: [number, number, number]; // [r, g, b] color multiplier (e.g. [1.0, 0.35, 0.15] for orange halation)
}

export interface GrainConfig {
  amount: number; // 0.0 to 1.0 intensity
  size: number; // Fraction of frame height (e.g. 0.0012 to 0.0020)
  roughness: number; // Octave mix factor (0.0 - 1.0)
  chroma: number; // Color sensor noise vs monochromatic film grain (0.0 - 1.0)
  exposureSensitivity?: number; // How much grain scales up in dark scenes (0.0 - 1.0)
}

export interface VignetteConfig {
  strength: number; // 0.0 to 1.0 darkening
  radius: number; // Fraction of frame extent
  softness: number; // Gradient feathering
  curvature?: number; // cos^4 exponent modulation
}

export interface FlashFalloff {
  strength: number; // Central light boost & dark background falloff
  radius: number; // Fraction of frame height
  centerX?: number; // 0.5 default
  centerY?: number; // 0.5 default
}

export interface LightLeak {
  probability: number; // 0.0 to 1.0
  strength: number; // Blend intensity
  palette?: string[]; // Hex colors for leak gradients
}

export interface DustScratches {
  density: number; // 0.0 to 1.0 dust specks
  scratches: number; // 0.0 to 1.0 fine emulsion scratches
}

export interface DateStampConfig {
  enabled: boolean;
  format?: string; // e.g. "'YY MM DD"
  color?: string; // e.g. "#ff7700"
  glow?: boolean;
  size?: number; // Fraction of frame height (e.g. 0.025)
  position?: "br" | "bl" | "tr" | "tl";
}

export interface FrameConfig {
  type: "none" | "instant";
  border?: number; // Border thickness fraction
  caption?: string; // Optional caption on bottom margin
}

/** 1. Lens Model Stage */
export interface LensModel {
  radialBlur: { r0: number; r1: number }; // blur = r0 + r1 * rho^2
  chromaticAberration: number; // Lateral CA factor (0.0 to 0.0015)
  distortion: number; // Barrel distortion k1 (0.0 to 0.05)
  vignette: VignetteConfig;
  bloom: BloomHalation;
  halation: BloomHalation;
}

/** 2. Capture / Film Response Stage */
export type Matrix3x3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

export interface FilmResponse {
  exposureEV: number; // EV stops (-2.0 to +2.0)
  dyeMatrix: Matrix3x3; // 3x3 dye cross-talk matrix
  curveR: ToneCurve; // Red tone curve
  curveG: ToneCurve; // Green tone curve
  curveB: ToneCurve; // Blue tone curve
  localContrast: number; // -1.0 to 1.0 (negative softens aggressive phone HDR)
  effectiveLines: number; // Detail budget (e.g. 1100, 1600, 2200)
  flashFalloff: FlashFalloff;
}

/** 3. OKLCH Color Grading Node */
export interface HueNode {
  hue: number; // 0 to 360 degrees
  dHue: number; // -180 to +180 degrees shift
  dChroma: number; // Relative chroma scale (e.g. 0.8 to 1.3)
  dLightness: number; // Lightness shift (-0.2 to +0.2)
}

export interface ColorGrading {
  hueTable: HueNode[]; // 24 nodes around color wheel
  skinProtection: {
    enabled: boolean;
    minHue: number; // typically 20 deg
    maxHue: number; // typically 55 deg
    strength: number; // 0.0 to 1.0
  };
  saturation: number;
  brightSatCurve: {
    shadowBoost: number; // Boost in low midtones
    highlightDesat: number; // Desaturation in extreme highlights
  };
  highlightWarmth: number; // Warm highlight drift
  shadowTint: [number, number, number]; // [r, g, b] lift in deep blacks
  whiteProtect: boolean; // Pull tint towards neutral when luma > 0.85
}

/** 4. Emulsion Artifacts */
export interface EmulsionArtifacts {
  grain: GrainConfig;
  lightLeak: LightLeak;
  dust: DustScratches;
}

/** Reference Fit & Calibration Metadata */
export interface ReferenceMetadata {
  referenceId: string; // e.g. "fuji-quicksnap-400-iso", "canon-ixus-v3", "polaroid-600"
  referenceNotes: string;
  fittingDate?: string;
  oklabMeanError?: number; // Mean delta E_OK
  oklabP95Error?: number; // 95th percentile delta E_OK
  sceneChecklistTested?: string[];
}

export type LookAspectRatio = "3:2" | "4:3" | "1:1" | "16:9";

/**
 * Unified LookRecipe: Camera System (v2) with backwards-compatibility fields
 */
export interface LookRecipe {
  id: string;
  name: string;
  version: number;
  aspectRatio: LookAspectRatio;

  // Camera System Stages
  lens: LensModel;
  response: FilmResponse;
  color: ColorGrading;
  emulsion: EmulsionArtifacts;

  // In-Camera & Output Processing
  dateStamp: DateStampConfig;
  frame: FrameConfig;

  // Runtime Tuning & Native Camera Adaptation
  intensity: number; // 0.0 (original) to 1.0 (full look), 0.7 for native photos
  whiteProtect: boolean;
  reference?: ReferenceMetadata;

  // Backward-compatibility properties
  exposureEV: number;
  curve: ToneCurve;
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  matrix?: Matrix3x3;
  saturation: number;
  splitTone: SplitTone;
  softFocus: SoftFocus;
  sharpen: number;
  bloom: BloomHalation;
  halation: BloomHalation;
  grain: GrainConfig;
  vignette: VignetteConfig;
  flashFalloff: FlashFalloff;
  lightLeak: LightLeak;
  dust: DustScratches;
}
