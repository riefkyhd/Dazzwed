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

/** Constraint sets from most to least specific. Handles OverconstrainedError by walking down. */
export function constraintLadder({ deviceId, facing }: OpenOptions): MediaStreamConstraints[] {
  const ladder: MediaStreamConstraints[] = [];

  if (deviceId) {
    // Specific device requested
    ladder.push({
      audio: false,
      video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    ladder.push({
      audio: false,
      video: { deviceId: { exact: deviceId } },
    });
    ladder.push({
      audio: false,
      video: { facingMode: { ideal: facing } },
    });
  } else if (facing === "user") {
    // Front selfie camera:
    // Some mobile devices reject 1080p landscape on front camera or fail exact matching.
    // Try exact "user" first, then ideal "user" with 720p, then bare "user" constraint.
    // NEVER fall back to { video: true } which defaults to the rear camera on mobile.
    ladder.push({
      audio: false,
      video: { facingMode: { exact: "user" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    ladder.push({
      audio: false,
      video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
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
    ladder.push({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
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
