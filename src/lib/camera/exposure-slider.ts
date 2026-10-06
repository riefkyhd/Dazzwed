/**
 * iPhone-style Exposure Slider Math & Coordinate Mapping
 *
 * Requirements:
 * - Fixed short vertical track beside the ring: height clamp(96px, 16% of viewfinder height, 140px)
 * - Centered on the ring's vertical center with a notch at 0 EV.
 * - Value is a clamped EV range (-2.0 to +2.0, default 0).
 * - Clamp in mapping function; derive sun's position only from clamped value, never raw pointer.
 * - Flip track side if ring is near edge; shift ring and track so they never leave safe bounds.
 */

export const EV_MIN = -2.0;
export const EV_MAX = 2.0;
export const EV_DEFAULT = 0.0;
export const FOCUS_BOX_SIZE = 64; // px
export const RING_TRACK_GAP = 28; // px horizontal distance between ring center and track
export const SUN_SIZE = 22; // px

/**
 * Clamps EV to [-2.0, +2.0].
 * Gracefully handles NaN, undefined, or Infinity.
 */
export function clampEV(val: number, min = EV_MIN, max = EV_MAX): number {
  if (typeof val !== "number" || Number.isNaN(val)) return EV_DEFAULT;
  if (!Number.isFinite(val)) return val > 0 ? max : min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculates track height based on viewfinder height: clamp(96px, 16% of vfHeight, 140px).
 */
export function calculateTrackHeight(vfHeight: number): number {
  const scaled = vfHeight * 0.16;
  return Math.max(96, Math.min(140, scaled));
}

/**
 * Maps a clamped EV value to pixel offset relative to track center.
 * In screen coordinates:
 * - Positive EV is higher up on the screen (negative Y offset).
 * - Negative EV is lower down on the screen (positive Y offset).
 *
 * Offset range is strictly [-trackHeight / 2, +trackHeight / 2].
 */
export function evToSunOffset(ev: number, trackHeight: number): number {
  const clamped = clampEV(ev);
  if (clamped === 0) return 0;
  const halfTrack = trackHeight / 2;
  // Normalized fraction in [-1, +1]
  const fraction = clamped / EV_MAX;
  // Upwards is negative Y
  const offset = -fraction * halfTrack;
  return offset === 0 ? 0 : offset;
}

/**
 * Maps a pointer drag distance (deltaY) to a new EV value from a starting EV.
 * DeltaY is positive when moving finger downwards.
 * Moving finger downwards should decrease EV.
 * Moving finger upwards (deltaY < 0) should increase EV.
 *
 * Sensitivity: Moving the full trackHeight corresponds to a 2.0 EV change.
 */
export function pointerDeltaToEV(
  startEV: number,
  deltaY: number,
  trackHeight: number
): number {
  const safeStart = clampEV(startEV);
  // Full track height traversal = 2.0 EV delta
  const evChange = (-deltaY / trackHeight) * 2.0;
  return clampEV(safeStart + evChange);
}

export interface FocusAnchor {
  ringX: number;
  ringY: number;
  trackSide: "right" | "left";
  trackHeight: number;
}

/**
 * Determines safe position of focus ring and exposure track so they never
 * overflow the viewfinder bounds or overlap control zones.
 *
 * @param tapX Tap X relative to viewfinder (0 to vfWidth)
 * @param tapY Tap Y relative to viewfinder (0 to vfHeight)
 * @param vfWidth Viewfinder width in px
 * @param vfHeight Viewfinder height in px
 * @param margin Padding margin from viewfinder edges (default 12px)
 */
export function calculateFocusAnchor(
  tapX: number,
  tapY: number,
  vfWidth: number,
  vfHeight: number,
  margin = 12
): FocusAnchor {
  const trackHeight = calculateTrackHeight(vfHeight);
  const halfRing = FOCUS_BOX_SIZE / 2;
  const halfTrack = trackHeight / 2;
  const maxHalfExtent = Math.max(halfRing, halfTrack);

  // Clamping Y so neither the ring nor the track vertical ends clip
  const minY = margin + maxHalfExtent;
  const maxY = Math.max(minY, vfHeight - margin - maxHalfExtent);
  const ringY = Math.max(minY, Math.min(maxY, tapY));

  // Determine if track fits on right
  // Track extends to ringX + RING_TRACK_GAP + SUN_SIZE/2
  const spaceOnRight = vfWidth - tapX;
  const neededRightSpace = RING_TRACK_GAP + SUN_SIZE + margin;
  const trackSide: "right" | "left" = spaceOnRight >= neededRightSpace ? "right" : "left";

  // Clamping X so the combined ring + track bounding box stays inside
  let minX: number;
  let maxX: number;

  if (trackSide === "right") {
    minX = margin + halfRing;
    maxX = Math.max(minX, vfWidth - margin - RING_TRACK_GAP - SUN_SIZE / 2);
  } else {
    minX = margin + RING_TRACK_GAP + SUN_SIZE / 2;
    maxX = Math.max(minX, vfWidth - margin - halfRing);
  }

  const ringX = Math.max(minX, Math.min(maxX, tapX));

  return {
    ringX,
    ringY,
    trackSide,
    trackHeight,
  };
}
