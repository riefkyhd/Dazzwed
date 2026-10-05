/** Minimal shape so this works with both MediaDeviceInfo and test fixtures. */
export interface DeviceLike {
  deviceId: string;
  kind: string;
  label: string;
}

export type LensKind = "main" | "ultrawide" | "tele" | "virtual" | "unknown";
export type Facing = "back" | "front" | "unknown";

export interface Lens {
  deviceId: string;
  label: string;
  kind: LensKind;
  facing: Facing;
}

const FRONT = /\b(front|user|selfie)\b/i;
const BACK = /\b(back|rear|environment)\b/i;
const ULTRA = /ultra[\s-]?wide|\b0\.5x?\b/i;
const TELE = /tele(photo)?/i;
const VIRTUAL = /\b(dual|triple|quad)\b/i;
const MAIN = /^back camera$/i;
const MAIN_HINT = /\b(main|wide)\b/i;

export function classifyFacing(label: string): Facing {
  if (FRONT.test(label)) return "front";
  if (BACK.test(label)) return "back";
  return "unknown";
}

export function classifyKind(label: string): LensKind {
  if (ULTRA.test(label)) return "ultrawide";
  if (TELE.test(label)) return "tele";
  if (VIRTUAL.test(label)) return "virtual";
  if (MAIN.test(label.trim()) || MAIN_HINT.test(label)) return "main";
  return "unknown";
}

export function toLens(d: DeviceLike): Lens {
  return {
    deviceId: d.deviceId,
    label: d.label,
    kind: classifyKind(d.label),
    facing: classifyFacing(d.label),
  };
}

/** All real back video cameras reported by the browser (deduped, virtual multi-lens excluded unless alone). */
export function backLenses(devices: readonly DeviceLike[]): Lens[] {
  const seen = new Set<string>();
  const back: Lens[] = [];
  for (const d of devices) {
    if (d.kind !== "videoinput" || !d.deviceId || seen.has(d.deviceId)) continue;
    seen.add(d.deviceId);
    const lens = toLens(d);
    if (lens.facing === "back") back.push(lens);
  }
  const real = back.filter((l) => l.kind !== "virtual");
  return real.length > 0 ? real : back;
}

const ORDER: Record<LensKind, number> = { ultrawide: 0, main: 1, unknown: 2, virtual: 3, tele: 4 };

/** Lenses to show in the picker. Fewer than 2 => the picker should be hidden. */
export function pickerLenses(devices: readonly DeviceLike[]): Lens[] {
  return backLenses(devices)
    .map((l, i) => ({ l, i }))
    .sort((a, b) => ORDER[a.l.kind] - ORDER[b.l.kind] || a.i - b.i)
    .map((x) => x.l);
}

/**
 * Choose the standard/main back camera. Excludes ultra-wide and tele.
 * Returns undefined when there's no confident choice (caller keeps facingMode: environment).
 */
export function pickDefaultLens(
  devices: readonly DeviceLike[],
  currentDeviceId?: string,
): string | undefined {
  const candidates = backLenses(devices).filter((l) => l.kind === "main" || l.kind === "unknown");
  const main = candidates.find((l) => l.kind === "main");
  if (main) return main.deviceId;
  if (currentDeviceId && candidates.some((l) => l.deviceId === currentDeviceId)) return currentDeviceId;
  return candidates[0]?.deviceId;
}
