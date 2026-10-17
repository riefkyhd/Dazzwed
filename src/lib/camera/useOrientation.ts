"use client";

import { useState, useEffect } from "react";

export interface DeviceOrientationState {
  orientationAngle: number; // 0, 90, 180, 270 (or -90)
  rotationDegrees: number; // CSS rotation degrees for buttons: 0, 90, -90, 180
  isLandscape: boolean;
}

/**
 * Calculates CSS rotation degrees for camera control icons so they stay upright
 * relative to the user's eye-level when the device rotates.
 *
 * @param angle Screen orientation angle (0, 90, 180, 270 / -90)
 * @param isViewportLandscape Whether window width > height
 */
export function calculateControlRotation(angle: number, isViewportLandscape: boolean): number {
  if (angle === 90) {
    // Landscape primary (device tilted counter-clockwise 90deg)
    return isViewportLandscape ? 0 : 90;
  }
  if (angle === 270 || angle === -90) {
    // Landscape secondary (device tilted clockwise 90deg)
    return isViewportLandscape ? 180 : -90;
  }
  if (angle === 180) {
    return 180;
  }
  // Angle is 0
  if (isViewportLandscape) {
    return 0;
  }
  return 0;
}

/**
 * Hook to track physical screen orientation and viewport aspect.
 * Safely handles SSR, legacy window.orientation, and modern ScreenOrientation API.
 */
export function useDeviceOrientation(): DeviceOrientationState {
  const [state, setState] = useState<DeviceOrientationState>(() => {
    if (typeof window === "undefined") {
      return { orientationAngle: 0, rotationDegrees: 0, isLandscape: false };
    }
    const angle =
      window.screen?.orientation?.angle ??
      (typeof window.orientation === "number" ? window.orientation : 0);
    const isLandscape = window.innerWidth > window.innerHeight;
    return {
      orientationAngle: angle,
      rotationDegrees: calculateControlRotation(angle, isLandscape),
      isLandscape,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOrientationChange = () => {
      const angle =
        window.screen?.orientation?.angle ??
        (typeof window.orientation === "number" ? window.orientation : 0);
      const isLandscape = window.innerWidth > window.innerHeight;
      setState({
        orientationAngle: angle,
        rotationDegrees: calculateControlRotation(angle, isLandscape),
        isLandscape,
      });
    };

    window.screen?.orientation?.addEventListener?.("change", handleOrientationChange);
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleOrientationChange);

    handleOrientationChange();

    return () => {
      window.screen?.orientation?.removeEventListener?.("change", handleOrientationChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  return state;
}
