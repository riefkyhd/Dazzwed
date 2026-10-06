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

export type CameraAspect = "3:4" | "16:9" | "1:1" | "3:2" | "4:3";

/**
 * Pure Base-Frame Sensor Model:
 * - BASE FRAME = full 4:3 sensor frame (3:4 in portrait w < h, 4:3 in landscape w >= h).
 * - 3:4 shows the whole base frame.
 * - 9:16 (16:9 in landscape) = largest centered 9:16 rect inside 3:4 base frame (narrower width, same full height).
 * - 1:1 = largest centered square inside 3:4 base frame (same width, shorter height).
 * - Invariant: visible region for 9:16 and 1:1 is always a strict sub-rectangle of 3:4.
 *   Switching to 9:16 or 1:1 only crops (tighter framing); it never reveals anything outside 3:4.
 */
export function cropRect(
  w: number,
  h: number,
  aspect: CameraAspect = "3:4",
  zoom: number = 1
): Crop {
  const isPortrait = w < h;

  // 1. Establish the base 4:3 (or 3:4) sensor frame from raw stream dimensions
  // Target sensor ratio: 3/4 in portrait, 4/3 in landscape (or 1.0 if input source is already square)
  const isSquare = Math.abs(w - h) < 2;
  const sensorRatio = isSquare ? 1.0 : isPortrait ? 3 / 4 : 4 / 3;
  const rawRatio = w / h;

  let baseSw = w;
  let baseSh = h;
  let baseSx = 0;
  let baseSy = 0;

  // If stream is not 4:3 (e.g. 16:9 legacy fallback device), crop stream to 4:3 base frame
  if (!isSquare && Math.abs(rawRatio - sensorRatio) > 0.02) {
    if (rawRatio > sensorRatio) {
      // Stream is wider than 4:3 (e.g. 16:9 landscape): crop width to 4:3
      baseSw = Math.round(h * sensorRatio);
      baseSx = Math.round((w - baseSw) / 2);
    } else {
      // Stream is taller than 3:4 (e.g. 9:16 portrait): crop height to 3:4
      baseSh = Math.round(w / sensorRatio);
      baseSy = Math.round((h - baseSh) / 2);
    }
  }

  // 2. Compute aspect sub-crop strictly within the established base frame
  let subSw = baseSw;
  let subSh = baseSh;

  if (aspect === "1:1") {
    // 1:1 square inside 3:4 base frame:
    // Portrait (3:4): width is short side, so square size is baseSw x baseSw (crops top & bottom)
    // Landscape (4:3): height is short side, so square size is baseSh x baseSh (crops left & right)
    const squareSide = Math.min(baseSw, baseSh);
    subSw = squareSide;
    subSh = squareSide;
  } else if (aspect === "16:9") {
    // 9:16 in portrait: same height as 3:4 base frame, narrower width (crops sides)
    // 16:9 in landscape: same width as 4:3 base frame, narrower height (crops top & bottom)
    if (isPortrait) {
      subSh = baseSh;
      subSw = Math.round((baseSh * 9) / 16);
    } else {
      subSw = baseSw;
      subSh = Math.round((baseSw * 9) / 16);
    }
  } else if (aspect === "3:2") {
    // 2:3 in portrait or 3:2 in landscape
    if (isPortrait) {
      subSh = baseSh;
      subSw = Math.round((baseSh * 2) / 3);
    } else {
      subSw = baseSw;
      subSh = Math.round((baseSw * 2) / 3);
    }
  } else {
    // "3:4" or "4:3": exactly the 100% full base frame
    subSw = baseSw;
    subSh = baseSh;
  }

  // 3. Apply digital zoom >= 1 uniformly within the sub-crop
  const z = Math.max(1, zoom);
  const finalSw = Math.round(subSw / z);
  const finalSh = Math.round(subSh / z);

  // Center the zoomed sub-crop within the base frame
  const finalSx = baseSx + Math.round((baseSw - finalSw) / 2);
  const finalSy = baseSy + Math.round((baseSh - finalSh) / 2);

  return {
    sx: Math.max(0, finalSx),
    sy: Math.max(0, finalSy),
    sw: Math.min(w, finalSw),
    sh: Math.min(h, finalSh),
  };
}

/**
 * Backward compatibility alias for cropRect
 */
export const cropForAspectAndZoom = cropRect;

/** Centered crop for digital zoom (zoom >= 1). */
export function cropForZoom(w: number, h: number, zoom: number): Crop {
  return cropRect(w, h, "3:4", zoom);
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
