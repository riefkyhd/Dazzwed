export interface Size {
  width: number;
  height: number;
}
export interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Scale so the longest edge is at most `max`. Never upscales. */
export function fitLongestEdge(w: number, h: number, max: number): Size {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: Math.round(w), height: Math.round(h) };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export type CameraAspect = "3:4" | "16:9" | "1:1";

/**
 * Centered crop for target aspect ratio and digital zoom.
 * Original camera sensor is portrait 3:4 (or landscape 4:3).
 * Other aspect ratios (16:9, 1:1) are center-cropped from the full sensor.
 */
export function cropForAspectAndZoom(
  w: number,
  h: number,
  aspect: CameraAspect = "3:4",
  zoom: number = 1
): Crop {
  // Target ratio width / height in portrait orientation
  const targetRatio =
    aspect === "1:1" ? 1 : aspect === "16:9" ? 9 / 16 : 3 / 4;

  const currentRatio = w / h;

  let baseSw = w;
  let baseSh = h;

  if (currentRatio > targetRatio) {
    // Current is wider than target: crop width
    baseSw = Math.round(h * targetRatio);
  } else if (currentRatio < targetRatio) {
    // Current is taller than target: crop height
    baseSh = Math.round(w / targetRatio);
  }

  const z = Math.max(1, zoom);
  const sw = Math.round(baseSw / z);
  const sh = Math.round(baseSh / z);
  const sx = Math.round((w - sw) / 2);
  const sy = Math.round((h - sh) / 2);

  return { sx, sy, sw, sh };
}

/** Centered crop for digital zoom (zoom >= 1). */
export function cropForZoom(w: number, h: number, zoom: number): Crop {
  return cropForAspectAndZoom(w, h, "3:4", zoom);
}

export type OutputTier = "original" | "high" | "standard" | "lite";

export interface TierConfig {
  maxEdge: number;
  quality: number;
}

export const TIER_CONFIG: Record<OutputTier, TierConfig> = {
  original: { maxEdge: 8192, quality: 0.95 },
  high: { maxEdge: 4096, quality: 0.92 },
  standard: { maxEdge: 2560, quality: 0.85 },
  lite: { maxEdge: 1920, quality: 0.80 },
};

/** Quality ladder used when progressive compression is required */
export const QUALITY_STEPS = [0.92, 0.85, 0.80, 0.72] as const;
export const MAX_EDGE = 4096;
