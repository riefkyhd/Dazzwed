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

/** Centered crop for digital zoom (zoom >= 1). */
export function cropForZoom(w: number, h: number, zoom: number): Crop {
  const z = Math.max(1, zoom);
  const sw = w / z;
  const sh = h / z;
  return { sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh };
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
