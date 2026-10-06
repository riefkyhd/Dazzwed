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

export async function applyNativeZoom(track: MediaStreamTrack, value: number): Promise<void> {
  await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
}

export async function applyTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
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

export const DIGITAL_ZOOM_STEPS = [1, 2] as const;

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|Twitter|GSA\/|; wv\)/i;
/** In-app browsers frequently block getUserMedia. */
export function isInAppBrowser(ua: string): boolean {
  return IN_APP.test(ua);
}
