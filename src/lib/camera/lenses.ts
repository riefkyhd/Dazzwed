import { clampZoomToRange, type ZoomRange } from "./caps";
import type { OpticalVerificationStatus, ZoomMechanism } from "./diagnostics";

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
  /**
   * Explicit optical magnification parsed from the camera label ONLY when unambiguous.
   * Generic "Back Telephoto Camera" has `explicitZoom: undefined` because browser labels
   * do not distinguish 2x vs 3x vs 5x physical telephoto lenses unless stated in the label.
   */
  explicitZoom?: number;
}

const FRONT = /\b(front|user|selfie|facetime)\b/i;
const BACK = /\b(back|rear|environment)\b/i;
const ULTRA = /ultra[\s-]?wide|\b0\.[456]x?\b/i;
const TELE = /tele(photo)?/i;
const VIRTUAL = /\b(dual|triple|quad)\b/i;
const MAIN = /^back camera$/i;
const MAIN_HINT = /\b(main|wide)\b/i;
const EXPLICIT_ULTRA_FACTOR = /\b(0\.[456])x?\b/i;
const EXPLICIT_TELE_FACTOR = /\b([2-9](?:\.\d+)?)x\b/i;

// Android & Samsung Camera2 HAL enumeration patterns:
// ID 0: Primary Main Wide (1x)
// ID 2: Ultra-Wide (0.5x)
// ID 3: Telephoto (3x)
const CAMERA2_ULTRA = /\b(?:camera2?|id)[\s:]+2\b|\bwide-angle\s*2\b/i;
const CAMERA2_MAIN = /\b(?:camera2?|id)[\s:]+0\b/i;
const CAMERA2_TELE = /\b(?:camera2?|id)[\s:]+3\b/i;

export function classifyFacing(label: string): Facing {
  if (!label) return "unknown";
  if (FRONT.test(label)) return "front";
  if (BACK.test(label)) return "back";
  return "unknown";
}

export function classifyKind(label: string): LensKind {
  if (!label) return "unknown";
  if (ULTRA.test(label) || CAMERA2_ULTRA.test(label)) return "ultrawide";
  if (TELE.test(label) || CAMERA2_TELE.test(label)) return "tele";
  if (VIRTUAL.test(label)) return "virtual";
  if (MAIN.test(label.trim()) || MAIN_HINT.test(label) || CAMERA2_MAIN.test(label)) return "main";
  return "unknown";
}

/**
 * Extracts a zoom multiplier ONLY when the lens kind/label provides an unambiguous factor.
 * Notably, a generic "Back Telephoto Camera" returns `undefined` because its native optical
 * magnification may be 2x, 3x, 5x, etc., depending on the phone model.
 */
export function parseExplicitZoom(label: string, kind: LensKind): number | undefined {
  if (!label) return undefined;
  if (kind === "ultrawide") {
    const m = label.match(EXPLICIT_ULTRA_FACTOR);
    return m ? parseFloat(m[1]) : 0.5;
  }
  if (kind === "main") {
    return 1;
  }
  if (kind === "tele") {
    const m = label.match(EXPLICIT_TELE_FACTOR);
    if (m) {
      const val = parseFloat(m[1]);
      if (Number.isFinite(val) && val > 1) return val;
    }
    if (CAMERA2_TELE.test(label)) {
      return 3;
    }
    return undefined;
  }
  return undefined;
}

export function toLens(d: DeviceLike): Lens {
  const label = d.label ?? "";
  const kind = classifyKind(label);
  const facing = classifyFacing(label);
  const explicitZoom = parseExplicitZoom(label, kind);
  return {
    deviceId: d.deviceId,
    label,
    kind,
    facing,
    ...(explicitZoom !== undefined ? { explicitZoom } : {}),
  };
}

/**
 * All real back video cameras reported by the browser (deduped).
 * Virtual multi-camera devices ("Back Dual/Triple Camera") are excluded ONLY when at least
 * one non-virtual primary ("main" or "unknown") back camera is present, ensuring a 1x base
 * camera is never lost if a browser only exposes a virtual camera alongside an ultra-wide lens.
 */
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
  const hasRealBaseCamera = real.some((l) => l.kind === "main" || l.kind === "unknown");
  return hasRealBaseCamera ? real : back;
}

const ORDER: Record<LensKind, number> = { ultrawide: 0, main: 1, unknown: 2, virtual: 3, tele: 4 };

/** Lenses to show in the picker. Fewer than 2 => the picker should be hidden unless zoomRange exists. */
export function pickerLenses(devices: readonly DeviceLike[]): Lens[] {
  return backLenses(devices)
    .map((l, i) => ({ l, i }))
    .sort((a, b) => ORDER[a.l.kind] - ORDER[b.l.kind] || a.i - b.i)
    .map((x) => x.l);
}

/**
 * Choose the standard/main 1x back camera. Excludes ultra-wide and tele.
 * Falls back to a virtual multi-camera device if no "main" or "unknown" candidate exists.
 * Returns undefined when there's no confident choice (caller keeps facingMode: environment).
 */
export function pickDefaultLens(
  devices: readonly DeviceLike[],
  currentDeviceId?: string,
): string | undefined {
  const back = backLenses(devices);
  const candidates = back.filter((l) => l.kind === "main" || l.kind === "unknown");
  const main = candidates.find((l) => l.kind === "main");
  if (main) return main.deviceId;
  if (currentDeviceId && candidates.some((l) => l.deviceId === currentDeviceId)) return currentDeviceId;
  if (candidates.length > 0) return candidates[0].deviceId;
  const virtualBase = back.find((l) => l.kind === "virtual");
  return virtualBase?.deviceId;
}

export type ZoomPreset = 0.5 | 1 | 2 | 3;

export interface ZoomSelectionInput {
  preset: ZoomPreset;
  lenses: readonly Lens[];
  activeId?: string;
  zoomRange: ZoomRange | null;
}

export interface ZoomSelectionPlan {
  preset: ZoomPreset;
  mechanism: ZoomMechanism;
  targetDeviceId?: string;
  requiresStreamSwitch: boolean;
  targetNativeZoom: number;
  targetDigitalZoom: number;
  opticalVerification: OpticalVerificationStatus;
}

/**
 * Resolves the most appropriate camera mechanism for discrete 0.5x, 1x, 2x, and 3x controls:
 * 1. Separate camera stream (`camera-switch`) ONLY when a device's identity and magnification
 *    explicitly match the preset (e.g. `ultrawide` for 0.5x, `main` for 1x, or a `tele` lens
 *    whose label explicitly states `2x` or `3x`). Never selects an ambiguous `tele` camera
 *    whose native optical zoom might be 3x or 5x when the user requests 2x.
 * 2. Browser-managed track zoom (`browser-zoom-constraint`) on the primary 1x stream when
 *    `zoomRange` covers the requested preset, clamped to `[zoomRange.min, zoomRange.max]`.
 * 3. Explicit app-side digital crop (`app-digital-crop`) on the primary 1x stream when
 *    neither a verified separate stream nor a covering browser zoom range is available.
 */
export function resolveZoomPreset({
  preset,
  lenses,
  activeId,
  zoomRange,
}: ZoomSelectionInput): ZoomSelectionPlan {
  const ultrawide = lenses.find((l) => l.kind === "ultrawide");
  const mainLens =
    lenses.find((l) => l.kind === "main") ??
    (activeId ? lenses.find((l) => l.deviceId === activeId && l.kind === "unknown") : undefined) ??
    lenses.find((l) => l.kind === "unknown") ??
    lenses.find((l) => l.kind === "virtual");

  const activeLens = activeId ? lenses.find((l) => l.deviceId === activeId) : undefined;
  const isOnSecondaryLens = Boolean(
    activeLens && (activeLens.kind === "ultrawide" || activeLens.kind === "tele")
  );

  if (preset === 0.5) {
    if (ultrawide) {
      const requiresStreamSwitch = activeId !== ultrawide.deviceId;
      return {
        preset: 0.5,
        mechanism: "camera-switch",
        targetDeviceId: ultrawide.deviceId,
        requiresStreamSwitch,
        targetNativeZoom: 1,
        targetDigitalZoom: 1,
        opticalVerification: "SEPARATE_DEVICE_STREAM",
      };
    }
    if (zoomRange && zoomRange.min < 1) {
      const clamped = clampZoomToRange(0.5, zoomRange);
      return {
        preset: 0.5,
        mechanism: "browser-zoom-constraint",
        targetDeviceId: activeId ?? mainLens?.deviceId,
        requiresStreamSwitch: false,
        targetNativeZoom: clamped,
        targetDigitalZoom: 1,
        opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
      };
    }
    // Fallback if 0.5x is unavailable
    return {
      preset: 1,
      mechanism: "base-1x",
      targetDeviceId: mainLens?.deviceId ?? activeId,
      requiresStreamSwitch: Boolean(isOnSecondaryLens && mainLens && activeId !== mainLens.deviceId),
      targetNativeZoom: 1,
      targetDigitalZoom: 1,
      opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
    };
  }

  if (preset === 1) {
    const switchToMain = Boolean(mainLens && activeId && activeId !== mainLens.deviceId);
    if (switchToMain && mainLens) {
      return {
        preset: 1,
        mechanism: "camera-switch",
        targetDeviceId: mainLens.deviceId,
        requiresStreamSwitch: true,
        targetNativeZoom: 1,
        targetDigitalZoom: 1,
        opticalVerification: "SEPARATE_DEVICE_STREAM",
      };
    }
    if (zoomRange) {
      const clamped = clampZoomToRange(1, zoomRange);
      return {
        preset: 1,
        mechanism: "browser-zoom-constraint",
        targetDeviceId: mainLens?.deviceId ?? activeId,
        requiresStreamSwitch: false,
        targetNativeZoom: clamped,
        targetDigitalZoom: 1,
        opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
      };
    }
    return {
      preset: 1,
      mechanism: "base-1x",
      targetDeviceId: mainLens?.deviceId ?? activeId,
      requiresStreamSwitch: false,
      targetNativeZoom: 1,
      targetDigitalZoom: 1,
      opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
    };
  }

  // preset === 2 or preset === 3
  const matchingTele = lenses.find(
    (l) => l.kind === "tele" && l.explicitZoom !== undefined && Math.abs(l.explicitZoom - preset) < 0.05
  );
  if (matchingTele) {
    const requiresStreamSwitch = activeId !== matchingTele.deviceId;
    return {
      preset,
      mechanism: "camera-switch",
      targetDeviceId: matchingTele.deviceId,
      requiresStreamSwitch,
      targetNativeZoom: 1,
      targetDigitalZoom: 1,
      opticalVerification: "SEPARATE_DEVICE_STREAM",
    };
  }

  const switchToMain = Boolean(isOnSecondaryLens && mainLens && activeId !== mainLens.deviceId);
  const targetId = switchToMain ? mainLens!.deviceId : activeId ?? mainLens?.deviceId;
  const canUseNativeZoom = Boolean(zoomRange && zoomRange.min <= preset && zoomRange.max >= preset);

  if (switchToMain && mainLens) {
    return {
      preset,
      mechanism: "camera-switch",
      targetDeviceId: mainLens.deviceId,
      requiresStreamSwitch: true,
      targetNativeZoom: canUseNativeZoom && zoomRange ? clampZoomToRange(preset, zoomRange) : 1,
      targetDigitalZoom: canUseNativeZoom ? 1 : preset,
      opticalVerification: "SEPARATE_DEVICE_STREAM",
    };
  }

  if (canUseNativeZoom && zoomRange) {
    const clamped = clampZoomToRange(preset, zoomRange);
    return {
      preset,
      mechanism: "browser-zoom-constraint",
      targetDeviceId: targetId,
      requiresStreamSwitch: false,
      targetNativeZoom: clamped,
      targetDigitalZoom: 1,
      opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
    };
  }

  return {
    preset,
    mechanism: "app-digital-crop",
    targetDeviceId: targetId,
    requiresStreamSwitch: false,
    targetNativeZoom: zoomRange ? clampZoomToRange(1, zoomRange) : 1,
    targetDigitalZoom: preset,
    opticalVerification: "DIGITAL_CROP_ONLY",
  };
}

/**
 * Computes the effective user-facing zoom multiplier accounting for active separate lens stream,
 * browser-managed track zoom, and app-side digital crop.
 */
export function getEffectiveDisplayZoom(params: {
  activeId?: string;
  lenses: readonly Lens[];
  zoom: number;
  digitalZoom: number;
  zoomRange: ZoomRange | null;
}): number {
  const { activeId, lenses, zoom, digitalZoom, zoomRange } = params;
  const activeLens = activeId ? lenses.find((l) => l.deviceId === activeId) : undefined;
  const streamMultiplier = digitalZoom > 1 ? digitalZoom : zoomRange ? zoom : 1;

  if (activeLens?.kind === "ultrawide") {
    const base = activeLens.explicitZoom ?? 0.5;
    return Number((base * streamMultiplier).toFixed(2));
  }
  if (activeLens?.kind === "tele" && activeLens.explicitZoom) {
    return Number((activeLens.explicitZoom * streamMultiplier).toFixed(2));
  }
  return Number(streamMultiplier.toFixed(2));
}
