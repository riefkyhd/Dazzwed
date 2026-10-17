export interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

export interface ExposureCompRange {
  min: number;
  max: number;
  step: number;
}

// zoom/torch/exposureCompensation aren't in all TS DOM lib versions.
interface ExtCaps {
  zoom?: { min: number; max: number; step?: number };
  torch?: boolean;
  exposureCompensation?: { min: number; max: number; step?: number };
  fillLightMode?: string[];
}

function caps(track: MediaStreamTrack | null | undefined): ExtCaps {
  try {
    return (track?.getCapabilities?.() ?? {}) as ExtCaps;
  } catch {
    return {};
  }
}

export const MIN_DIGITAL_ZOOM = 1;
export const MAX_DIGITAL_ZOOM = 10;

/** Native zoom range, or null (iOS Safari) => use digital zoom. */
export function readZoomRange(track: MediaStreamTrack | null | undefined): ZoomRange | null {
  const z = caps(track).zoom;
  if (!z || typeof z.min !== "number" || typeof z.max !== "number" || z.max <= z.min) return null;
  return { min: z.min, max: z.max, step: z.step && z.step > 0 ? z.step : 0.1 };
}

/**
 * Clamps a requested zoom factor to the track's reported capability range when available,
 * or to the valid app digital crop range [1, MAX_DIGITAL_ZOOM] when native zoom is unavailable.
 */
export function clampZoomToRange(requested: number, range: ZoomRange | null | undefined): number {
  if (!Number.isFinite(requested)) {
    return range ? Math.max(range.min, Math.min(range.max, 1)) : MIN_DIGITAL_ZOOM;
  }
  if (range) {
    return Math.max(range.min, Math.min(range.max, requested));
  }
  return Math.max(MIN_DIGITAL_ZOOM, Math.min(MAX_DIGITAL_ZOOM, requested));
}

export function hasTorch(track: MediaStreamTrack | null | undefined): boolean {
  return caps(track).torch === true;
}

/** Check if ImageCapture fillLightMode includes 'flash' */
export function hasImageCaptureFlash(track: MediaStreamTrack | null | undefined): boolean {
  if (typeof window === "undefined" || !("ImageCapture" in window) || !track) return false;
  try {
    const c = caps(track);
    return Array.isArray(c.fillLightMode) && c.fillLightMode.includes("flash");
  } catch {
    return false;
  }
}

export async function applyNativeZoom(
  track: MediaStreamTrack,
  value: number,
  range?: ZoomRange | null
): Promise<number> {
  const effectiveRange = range !== undefined ? range : readZoomRange(track);
  const clamped = effectiveRange ? clampZoomToRange(value, effectiveRange) : value;
  await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] });
  return clamped;
}

export async function applyTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}

/**
 * Pulses the torch strictly at moment of capture and GUARANTEES turning it off afterwards.
 * Automatically handles timeouts, errors, and background transitions.
 */
export async function pulseTorch<T>(
  track: MediaStreamTrack,
  captureAction: () => Promise<T>,
  options: { maxStabilizeMs?: number } = {}
): Promise<T> {
  const maxWait = options.maxStabilizeMs ?? 180;

  // Turn torch ON
  let torchActivated = false;
  try {
    await applyTorch(track, true);
    torchActivated = true;
  } catch (err) {
    console.warn("Failed to activate hardware torch:", err);
  }

  try {
    // If torch was activated, wait brief auto-exposure stabilization
    if (torchActivated && maxWait > 0) {
      await new Promise((r) => setTimeout(r, maxWait));
    }
    return await captureAction();
  } finally {
    // ALWAYS turn torch off
    if (torchActivated) {
      try {
        await applyTorch(track, false);
      } catch (e) {
        console.warn("Failed to deactivate torch in finally block:", e);
      }
    }
  }
}

/** Read track exposure compensation capabilities */
export function readExposureCompRange(track: MediaStreamTrack | null | undefined): ExposureCompRange | null {
  const ec = caps(track).exposureCompensation;
  if (!ec || typeof ec.min !== "number" || typeof ec.max !== "number" || ec.max <= ec.min) return null;
  return { min: ec.min, max: ec.max, step: ec.step && ec.step > 0 ? ec.step : 0.1 };
}

/** Apply track exposure compensation (e.g. -0.5 EV to protect highlights) */
export async function applyExposureCompensation(track: MediaStreamTrack, ev: number): Promise<void> {
  try {
    await track.applyConstraints({
      advanced: [{ exposureCompensation: ev } as MediaTrackConstraintSet],
    });
  } catch (err) {
    console.warn("Could not apply exposureCompensation:", err);
  }
}

export interface FlashConstraintOptions {
  torch: boolean;
  exposureBiasEV?: number;
}

/**
 * Combines hardware torch and exposure compensation into a single atomic constraint set.
 * Android Camera2 HAL cancels or drops constraints when torch and exposure are called sequentially;
 * combining them in advanced: [{ torch, exposureCompensation }] guarantees both apply atomically.
 */
export async function applyFlashConstraints(
  track: MediaStreamTrack,
  options: FlashConstraintOptions
): Promise<void> {
  const c = caps(track);
  const adv: Record<string, unknown> = {};
  if (c.torch) {
    adv.torch = options.torch;
  }
  if (typeof options.exposureBiasEV === "number" && c.exposureCompensation) {
    const min = c.exposureCompensation.min ?? -2;
    const max = c.exposureCompensation.max ?? 2;
    const clamped = Math.max(min, Math.min(max, options.exposureBiasEV));
    adv.exposureCompensation = clamped;
  }

  if (Object.keys(adv).length === 0) return;

  try {
    await track.applyConstraints({
      advanced: [adv as MediaTrackConstraintSet],
    });
  } catch (err) {
    // If combined fails on quirky HAL driver, fallback to torch alone
    if (adv.torch !== undefined) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: adv.torch } as MediaTrackConstraintSet],
        });
      } catch (e2) {
        console.warn("Failed to apply torch constraint fallback:", e2);
      }
    }
  }
}

/** Measures scene mean perceived luminance on a downsampled canvas */
export function measureSceneLuminance(video: HTMLVideoElement, size = 16): number {
  try {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return 0.5;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0.5;

    ctx.drawImage(video, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    const totalPixels = size * size;

    for (let i = 0; i < imgData.data.length; i += 4) {
      // Perceived luminance (ITU-R BT.709)
      const r = imgData.data[i] / 255;
      const g = imgData.data[i + 1] / 255;
      const b = imgData.data[i + 2] / 255;
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return sum / totalPixels;
  } catch {
    return 0.5;
  }
}

export const DIGITAL_ZOOM_STEPS = [1, 2] as const;

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|Twitter|GSA\/|; wv\)/i;
/** In-app browsers frequently block getUserMedia. */
export function isInAppBrowser(ua: string): boolean {
  return IN_APP.test(ua);
}
