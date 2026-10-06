export type CameraErrorKind =
  | "unsupported" // no getUserMedia (old/in-app browser)
  | "insecure" // not HTTPS
  | "denied"
  | "not-found"
  | "in-use"
  | "unknown";

export class CameraError extends Error {
  constructor(
    public kind: CameraErrorKind,
    cause?: unknown,
  ) {
    super(`Camera error: ${kind}`, { cause });
  }
}

function errName(e: unknown): string {
  return typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
}

export function classifyError(e: unknown): CameraErrorKind {
  switch (errName(e)) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "not-found";
    case "NotReadableError":
    case "TrackStartError":
      return "in-use";
    default:
      return "unknown";
  }
}

export interface OpenOptions {
  deviceId?: string;
  facing: "environment" | "user";
}

/**
 * Resolution ladder for native 4:3 sensor frames (long edge x short edge).
 * 4032x3024 (12MP full sensor), 3264x2448 (8MP), 2592x1944 (5MP), 2048x1536 (3MP),
 * 1920x1440, 1600x1200, 1280x960, 1024x768, 640x480 (VGA).
 */
export const RESOLUTION_LADDER_4_3 = [
  { w: 4032, h: 3024 },
  { w: 3264, h: 2448 },
  { w: 2592, h: 1944 },
  { w: 2048, h: 1536 },
  { w: 1920, h: 1440 },
  { w: 1600, h: 1200 },
  { w: 1280, h: 960 },
  { w: 1024, h: 768 },
  { w: 640, h: 480 },
] as const;

/** Constraint sets from most to least specific. Handles OverconstrainedError by walking down. */
export function constraintLadder({ deviceId, facing }: OpenOptions): MediaStreamConstraints[] {
  const ladder: MediaStreamConstraints[] = [];

  // Helper to push 4:3 resolution variants (both landscape and portrait orientations)
  const pushResolutionRungs = (baseConstraint: MediaTrackConstraintSet) => {
    for (const res of RESOLUTION_LADDER_4_3) {
      // Landscape request
      ladder.push({
        audio: false,
        video: {
          ...baseConstraint,
          width: { ideal: res.w },
          height: { ideal: res.h },
          aspectRatio: { ideal: 4 / 3 },
        },
      });
      // Portrait request (some mobile drivers expect portrait dimensions)
      ladder.push({
        audio: false,
        video: {
          ...baseConstraint,
          width: { ideal: res.h },
          height: { ideal: res.w },
          aspectRatio: { ideal: 3 / 4 },
        },
      });
    }
  };

  if (deviceId) {
    // Specific device requested
    pushResolutionRungs({ deviceId: { exact: deviceId } });
    ladder.push({
      audio: false,
      video: { deviceId: { exact: deviceId } },
    });
    ladder.push({
      audio: false,
      video: { facingMode: { ideal: facing }, aspectRatio: { ideal: 4 / 3 } },
    });
  } else if (facing === "user") {
    // Front selfie camera:
    // Try exact user with 4:3 ladder rungs, then ideal user, then bare "user" constraint.
    // NEVER fall back to { video: true } which defaults to rear camera on mobile.
    pushResolutionRungs({ facingMode: { exact: "user" } });
    pushResolutionRungs({ facingMode: { ideal: "user" } });
    ladder.push({
      audio: false,
      video: { facingMode: { ideal: "user" } },
    });
    ladder.push({
      audio: false,
      video: { facingMode: "user" },
    });
    return ladder;
  } else {
    // Rear environment camera
    pushResolutionRungs({ facingMode: { ideal: "environment" } });
    ladder.push({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
  }

  // Bare video fallback only for environment or specific device
  ladder.push({ audio: false, video: true });
  return ladder;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function openStream(
  opts: OpenOptions,
  mediaDevices: Pick<MediaDevices, "getUserMedia"> | undefined = typeof navigator !== "undefined"
    ? navigator.mediaDevices
    : undefined,
): Promise<MediaStream> {
  if (typeof window !== "undefined" && window.isSecureContext === false) throw new CameraError("insecure");
  if (!mediaDevices?.getUserMedia) throw new CameraError("unsupported");

  let last: unknown;
  for (const constraints of constraintLadder(opts)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await mediaDevices.getUserMedia(constraints);
      } catch (e) {
        last = e;
        const kind = classifyError(e);
        if (kind === "denied") throw new CameraError("denied", e);
        // Camera briefly busy (e.g. right after another stream was stopped): retry once.
        if (kind === "in-use" && attempt === 0) {
          await sleep(400);
          continue;
        }
        break; // Overconstrained / not-found / etc: try the next, more relaxed rung.
      }
    }
  }
  throw new CameraError(classifyError(last), last);
}
