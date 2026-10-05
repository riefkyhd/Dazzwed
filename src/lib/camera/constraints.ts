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
  const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  const base: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: { ideal: facing } };
  const ladder: MediaStreamConstraints[] = [
    { audio: false, video: { ...base, ...size } },
    { audio: false, video: base },
  ];
  if (deviceId) ladder.push({ audio: false, video: { facingMode: { ideal: facing } } });
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
