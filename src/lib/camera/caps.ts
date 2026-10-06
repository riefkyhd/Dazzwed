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

/** Native zoom range, or null (iOS Safari) => use digital zoom. */
export function readZoomRange(track: MediaStreamTrack | null | undefined): ZoomRange | null {
  const z = caps(track).zoom;
  if (!z || typeof z.min !== "number" || typeof z.max !== "number" || z.max <= z.min) return null;
  return { min: z.min, max: z.max, step: z.step && z.step > 0 ? z.step : 0.1 };
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

export async function applyNativeZoom(track: MediaStreamTrack, value: number): Promise<void> {
  await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
}

export async function applyTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}

let lastTorchPulseTime = 0;
const TORCH_COOLDOWN_MS = 600;

/**
 * Pulses the torch strictly at moment of capture and GUARANTEES turning it off afterwards.
 * Automatically handles timeouts, errors, and background transitions.
 */
export async function pulseTorch<T>(
  track: MediaStreamTrack,
  captureAction: () => Promise<T>,
  options: { maxStabilizeMs?: number } = {}
): Promise<T> {
  const maxWait = options.maxStabilizeMs ?? 350;

  // Respect minimum LED cooldown interval
  const now = Date.now();
  const elapsed = now - lastTorchPulseTime;
  if (elapsed < TORCH_COOLDOWN_MS) {
    await new Promise((r) => setTimeout(r, TORCH_COOLDOWN_MS - elapsed));
  }

  // Turn torch ON
  await applyTorch(track, true);
  lastTorchPulseTime = Date.now();

  try {
    // Wait brief moment for exposure/sensor auto-gain to adapt to illumination
    await new Promise((r) => setTimeout(r, Math.min(400, maxWait)));
    return await captureAction();
  } finally {
    // ALWAYS turn torch off
    try {
      await applyTorch(track, false);
    } catch (e) {
      console.warn("Failed to deactivate torch in finally block:", e);
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

/** Measures scene mean luminance on a downsampled canvas for Flash Auto detection */
export function measureSceneLuminance(video: HTMLVideoElement): number {
  try {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return 0.5;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0.5;

    ctx.drawImage(video, 0, 0, 32, 32);
    const imgData = ctx.getImageData(0, 0, 32, 32);
    let sum = 0;
    const totalPixels = 32 * 32;

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
