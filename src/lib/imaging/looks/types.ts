/**
 * Look Engine Recipe Types
 *
 * All spatial parameters (grain size, blur radius, vignette, halation radius, stamp size)
 * are fractions of frame height (0.0 to 1.0), never absolute pixels.
 */

export interface ToneCurve {
  contrast: number; // Pivot contrast (1.0 = linear)
  pivot: number; // Pivot center for contrast (typically 0.18 - 0.5)
  toe: number; // Lift black level / shadow compression (0.0 = true black)
  shoulder: number; // Highlight rolloff (1.0 = linear, lower = soft compression)
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
}

export interface VignetteConfig {
  strength: number; // 0.0 to 1.0 darkening
  radius: number; // Fraction of frame extent
  softness: number; // Gradient feathering
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

export interface LookRecipe {
  id: string;
  name: string;
  version: number;

  // Exposure & Tone
  exposureEV: number; // EV stops (-2.0 to +2.0)
  curve: ToneCurve;
  lift: [number, number, number]; // Shadows tint [r, g, b] (-0.5 to +0.5)
  gamma: [number, number, number]; // Midtones gamma [r, g, b] (0.5 to 2.0)
  gain: [number, number, number]; // Highlights gain [r, g, b] (0.5 to 2.0)
  matrix?: [number, number, number, number, number, number, number, number, number]; // 3x3 color matrix
  saturation: number; // 0.0 (B&W) to 2.0 (hyper-saturated)
  splitTone: SplitTone;

  // Spatial Optics
  softFocus: SoftFocus;
  sharpen: number; // 0.0 to 1.0 (applied before grain)
  bloom: BloomHalation;
  halation: BloomHalation;
  grain: GrainConfig;
  vignette: VignetteConfig;
  flashFalloff: FlashFalloff;

  // Procedural Emulsion Extras (Review & Capture only)
  lightLeak: LightLeak;
  dust: DustScratches;

  // 2D Post-Process
  dateStamp: DateStampConfig;
  frame: FrameConfig;

  // Recalibration & Blend Controls
  intensity?: number; // 0.0 (original) to 1.0 (full look), default 1.0
  whiteProtect?: boolean; // Pull tint towards neutral for luma > 0.9, default true
}
