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

/** Quality ladder used to keep each shot under the size target. */
export const QUALITY_STEPS = [0.8, 0.72, 0.64, 0.56] as const;
export const TARGET_BYTES = 900_000;
export const MAX_EDGE = 1920;
