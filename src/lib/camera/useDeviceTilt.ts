"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type TiltAngle = 0 | 90 | -90;

export interface DeviceTiltState {
  /** Physical holding angle: 0 = portrait upright, 90 = landscape left, -90 = landscape right */
  tiltAngle: TiltAngle;
  /** CSS rotation degrees to keep icons upright relative to gravity: 0, 90, -90 */
  uiRotationDeg: number;
  /** True when phone is resting flat on a surface */
  isFlat: boolean;
  /** True on iOS WebKit when motion permission is required before sensor data is provided */
  needsPermission: boolean;
  /** True once permission is granted (or on platforms where permission is not required) */
  permissionGranted: boolean;
}

/**
 * Detects whether running on an Apple iOS / iPadOS device (iPhone, iPad, iPod)
 * where WebKit CoreMotion requires explicit user permission and inverts the gravity vector.
 */
export function isIOSPlatform(customUA?: string): boolean {
  if (typeof window === "undefined" && !customUA) return false;
  const ua = customUA ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  // Modern Android Chrome (v155+) implements window.DeviceMotionEvent.requestPermission.
  // Strictly prevent Android devices from ever being identified as iOS.
  if (/Android/i.test(ua)) return false;
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS =
    typeof navigator !== "undefined" &&
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1;
  return isAppleTouch || isIPadOS;
}

/**
 * Calculates candidate tilt angle from gravity acceleration vector (m/s²).
 * Includes deadzone hysteresis so 45° holding angles never cause rapid jitter.
 * Automatically handles iOS CoreMotion inverted sign convention.
 */
export function calculateTiltAngleFromGravity(
  rawX: number,
  rawY: number,
  rawZ: number,
  currentAngle: TiltAngle = 0,
  isIOS: boolean = false
): { angle: TiltAngle; isFlat: boolean } {
  // Normalize iOS WebKit CoreMotion inverted gravity vector to standard W3C frame
  const x = isIOS ? -rawX : rawX;
  const y = isIOS ? -rawY : rawY;
  const z = isIOS ? -rawZ : rawZ;

  const absX = Math.abs(x);
  const absY = Math.abs(y);
  const absZ = Math.abs(z);

  // Flat detection: gravity vector is primarily on the z-axis (face up or face down)
  const isFlat = absX < 3.0 && absY < 3.0 && absZ > 7.0;
  if (isFlat) {
    // Preserve last stable orientation when lying flat on a table
    return { angle: currentAngle, isFlat: true };
  }

  // Landscape Left (device turned 90° counter-clockwise, top of phone pointing left)
  // Gravity pulls along the positive x-axis (normalized)
  if (x > 4.5 && absX > absY * 1.3) {
    return { angle: 90, isFlat: false };
  }

  // Landscape Right (device turned 90° clockwise, top of phone pointing right)
  // Gravity pulls along the negative x-axis (normalized)
  if (x < -4.5 && absX > absY * 1.3) {
    return { angle: -90, isFlat: false };
  }

  // Portrait Upright (gravity pulls along the y-axis, or x is close to vertical)
  if (absY > absX || absX < 3.5) {
    return { angle: 0, isFlat: false };
  }

  // In ambiguous transition zone (between 35° and 55°), retain current angle
  return { angle: currentAngle, isFlat: false };
}

/**
 * Fallback candidate calculation from DeviceOrientation angles (beta, gamma).
 */
export function calculateTiltAngleFromOrientation(
  beta: number | null,
  gamma: number | null,
  currentAngle: TiltAngle = 0
): TiltAngle {
  if (beta === null || gamma === null) return currentAngle;

  const absGamma = Math.abs(gamma);
  const absBeta = Math.abs(beta);

  // If gamma is dominant (phone rolled sideways)
  if (gamma > 45 && absGamma > absBeta * 1.2) {
    return -90; // Landscape right
  }
  if (gamma < -45 && absGamma > absBeta * 1.2) {
    return 90; // Landscape left
  }
  if (absBeta > 40 && absBeta > absGamma * 1.2) {
    return 0; // Portrait upright
  }

  return currentAngle;
}

/**
 * Hook to track physical device tilt angle in real time via accelerometer / gravity.
 * Works even when the user's phone has OS Portrait Orientation Lock enabled.
 * Cross-platform compatible with Android Chrome and iOS Safari.
 */
export function useDeviceTilt(): DeviceTiltState & { requestMotionPermission: () => Promise<boolean> } {
  const isIOS = isIOSPlatform();
  const [state, setState] = useState<DeviceTiltState>(() => ({
    tiltAngle: 0,
    uiRotationDeg: 0,
    isFlat: false,
    needsPermission: isIOS,
    permissionGranted: !isIOS,
  }));

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const candidateRef = useRef<{ angle: TiltAngle; since: number }>({
    angle: 0,
    since: 0,
  });

  const hasMotionDataRef = useRef(false);

  // Helper to commit stable state changes with 200ms debounce filter
  const considerAngleChange = useCallback((newAngle: TiltAngle, isFlat: boolean) => {
    const now = performance.now();
    const current = stateRef.current.tiltAngle;

    if (newAngle === current) {
      candidateRef.current = { angle: newAngle, since: now };
      if (stateRef.current.isFlat !== isFlat) {
        setState((prev) => ({ ...prev, isFlat }));
      }
      return;
    }

    if (candidateRef.current.angle !== newAngle) {
      candidateRef.current = { angle: newAngle, since: now };
      return;
    }

    // Require new angle to hold steady for at least 200ms
    if (now - candidateRef.current.since >= 200) {
      setState((prev) => ({
        ...prev,
        tiltAngle: newAngle,
        uiRotationDeg: newAngle,
        isFlat,
      }));
    }
  }, []);

  const requestMotionPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return true;

    const DME = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof DME?.requestPermission !== "function" && typeof DOE?.requestPermission !== "function") {
      setState((prev) => ({ ...prev, permissionGranted: true, needsPermission: false }));
      return true;
    }

    try {
      let granted = false;
      if (typeof DME?.requestPermission === "function") {
        const res = await DME.requestPermission();
        if (res === "granted") granted = true;
      }

      if (typeof DOE?.requestPermission === "function") {
        try {
          const res = await DOE.requestPermission();
          if (res === "granted") granted = true;
        } catch {
          // Non-fatal if motion permission was processed
        }
      }

      setState((prev) => ({
        ...prev,
        permissionGranted: granted,
        needsPermission: !granted,
      }));
      return granted;
    } catch (err) {
      console.warn("Motion permission request error:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Primary: DeviceMotionEvent (accelerationIncludingGravity)
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null) return;
      hasMotionDataRef.current = true;

      const rawX = acc.x;
      const rawY = acc.y;
      const rawZ = acc.z ?? 0;

      const result = calculateTiltAngleFromGravity(rawX, rawY, rawZ, stateRef.current.tiltAngle, isIOS);
      considerAngleChange(result.angle, result.isFlat);

      // If we are actively receiving motion data, permission is granted
      if (!stateRef.current.permissionGranted) {
        setState((prev) => ({ ...prev, permissionGranted: true, needsPermission: false }));
      }
    };

    // 2. Secondary fallback: DeviceOrientationEvent (beta, gamma)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (hasMotionDataRef.current) return; // Motion is preferred
      const angle = calculateTiltAngleFromOrientation(
        event.beta,
        event.gamma,
        stateRef.current.tiltAngle
      );
      considerAngleChange(angle, false);
    };

    // 3. Tertiary fallback: Screen Orientation API (if auto-rotate is allowed)
    const handleScreenOrientation = () => {
      if (hasMotionDataRef.current) return;
      const angle =
        window.screen?.orientation?.angle ??
        (typeof window.orientation === "number" ? window.orientation : 0);
      let derived: TiltAngle = 0;
      if (angle === 90) derived = 90;
      else if (angle === 270 || angle === -90) derived = -90;
      considerAngleChange(derived, false);
    };

    // Attach listeners
    window.addEventListener("devicemotion", handleMotion, { passive: true });
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    window.screen?.orientation?.addEventListener?.("change", handleScreenOrientation);
    window.addEventListener("orientationchange", handleScreenOrientation, { passive: true });

    // iOS 13+ auto-request permission on user interaction:
    // MUST bind to CLICK and TOUCHEND (NOT touchstart, which throws NotAllowedError in WebKit).
    let isRequesting = false;
    const handleUserActivation = async () => {
      if (isRequesting || stateRef.current.permissionGranted) return;
      const DME = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof DME?.requestPermission !== "function") return;

      isRequesting = true;
      try {
        const granted = await requestMotionPermission();
        if (granted) {
          window.removeEventListener("click", handleUserActivation);
          window.removeEventListener("touchend", handleUserActivation);
        }
      } finally {
        isRequesting = false;
      }
    };

    if (isIOS) {
      window.addEventListener("click", handleUserActivation);
      window.addEventListener("touchend", handleUserActivation);
    }

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.screen?.orientation?.removeEventListener?.("change", handleScreenOrientation);
      window.removeEventListener("orientationchange", handleScreenOrientation);
      if (isIOS) {
        window.removeEventListener("click", handleUserActivation);
        window.removeEventListener("touchend", handleUserActivation);
      }
    };
  }, [considerAngleChange, isIOS, requestMotionPermission]);

  return { ...state, requestMotionPermission };
}
