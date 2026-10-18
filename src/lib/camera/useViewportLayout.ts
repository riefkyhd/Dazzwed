"use client";

import { useEffect, useState, useCallback } from "react";
import type { CameraAspect } from "@/lib/imaging/geometry";
import { diagnostics } from "./diagnostics";

export type DensityLevel = "L0" | "L1" | "L2";

export interface ViewportLayout {
  width: number;
  height: number;
  isLandscape: boolean;
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  mode: "banded" | "full-bleed";
  density: DensityLevel;
  viewfinderRect: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
  baselineRect: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
  topBarHeight: number;
  bottomBarHeight: number;
}

/**
 * Calculates responsive viewfinder sizing and control zones based on visualViewport and safe areas.
 * Frame is derived first from the selected ratio; all elements respect strict bounds.
 */
export function calculateLayout(
  vw: number,
  vh: number,
  aspect: CameraAspect,
  safeArea = { top: 0, bottom: 0, left: 0, right: 0 }
): ViewportLayout {
  // Zero Layout Reflow: camera layout is permanently locked to portrait mobile shell
  const effectiveVw = vw > vh ? Math.min(vw, Math.round(vh * 0.5625)) : vw;
  const availW = Math.max(280, effectiveVw - safeArea.left - safeArea.right);
  const availH = Math.max(380, vh - safeArea.top - safeArea.bottom);
  const horizontalOffset = vw > vh ? Math.round((vw - effectiveVw) / 2) : 0;

  // Target aspect ratio (w / h) — strictly portrait framing at all times
  let targetRatio: number;
  if (aspect === "1:1") {
    targetRatio = 1.0;
  } else if (aspect === "16:9") {
    targetRatio = 9 / 16;
  } else if (aspect === "3:2") {
    targetRatio = 2 / 3;
  } else {
    // "3:4" (default full sensor)
    targetRatio = 3 / 4;
  }

  // Slim unified top bar height with comfortable breathing room (68px + safeArea.top)
  const topBarH = 68 + safeArea.top;

  // Portrait Mode (Permanent Fixed Camera Geometry):
  // 1. Calculate the master 3:4 baseline frame first.
  // All button positions (Top Bar, Zoom Toggle, LookDial, Shutter) remain strictly locked to this 3:4 baseline.
  const minBottomReserved = 120 + safeArea.bottom;
  const maxAllowed34H = Math.max(200, vh - topBarH - minBottomReserved);

  let baselineVfW = availW;
  let baselineVfH = Math.round(baselineVfW / (3 / 4));

  if (baselineVfH > maxAllowed34H) {
    baselineVfH = maxAllowed34H;
    baselineVfW = Math.round(baselineVfH * (3 / 4));
  }

  const top34 = topBarH;
  const bottomBarH = Math.max(0, vh - (top34 + baselineVfH));
  const centerY = top34 + baselineVfH / 2;
  const centerX = safeArea.left + horizontalOffset + availW / 2;

  const baselineLeft = safeArea.left + horizontalOffset + Math.round((availW - baselineVfW) / 2);
  const baselineRect = {
    width: baselineVfW,
    height: baselineVfH,
    top: top34,
    left: Math.max(0, baselineLeft),
  };

  // Density ladder based on baseline bottom space
  let density: DensityLevel = "L0";
  if (bottomBarH < 130) {
    density = "L2";
  } else if (bottomBarH < 180) {
    density = "L1";
  }

  // 2. Aspect Ratio Geometry centered around (centerX, centerY)
  if (aspect === "16:9") {
    // 16:9 full-bleed mode: scales vertically centered around centerY
    let vfW = baselineVfW;
    let vfH = Math.round(vfW / (9 / 16));

    if (vfH > vh) {
      vfH = vh;
      vfW = Math.round(vfH * (9 / 16));
    }

    let top = Math.round(centerY - vfH / 2);
    if (top < 0) top = 0;
    if (top + vfH > vh) top = vh - vfH;

    const left = safeArea.left + horizontalOffset + Math.round((availW - vfW) / 2);

    return {
      width: vw,
      height: vh,
      isLandscape: false,
      safeArea,
      mode: "full-bleed",
      density,
      viewfinderRect: {
        width: vfW,
        height: vfH,
        top,
        left: Math.max(0, left),
      },
      baselineRect,
      topBarHeight: topBarH,
      bottomBarHeight: bottomBarH,
    };
  }

  if (aspect === "1:1") {
    // 1:1 mode: square centered symmetrically around centerY (not pulled to the top)
    const vfW = baselineVfW;
    const vfH = vfW;
    const top = Math.round(centerY - vfH / 2);
    const left = safeArea.left + horizontalOffset + Math.round((availW - vfW) / 2);

    return {
      width: vw,
      height: vh,
      isLandscape: false,
      safeArea,
      mode: "banded",
      density,
      viewfinderRect: {
        width: vfW,
        height: vfH,
        top,
        left: Math.max(0, left),
      },
      baselineRect,
      topBarHeight: topBarH,
      bottomBarHeight: bottomBarH,
    };
  }

  if (aspect === "3:2") {
    // 3:2 mode: centered around centerY
    const vfW = baselineVfW;
    const vfH = Math.round(vfW / (2 / 3));
    const top = Math.round(centerY - vfH / 2);
    const left = safeArea.left + Math.round((availW - vfW) / 2);

    return {
      width: vw,
      height: vh,
      isLandscape: false,
      safeArea,
      mode: "banded",
      density,
      viewfinderRect: {
        width: vfW,
        height: vfH,
        top,
        left: Math.max(0, left),
      },
      baselineRect,
      topBarHeight: topBarH,
      bottomBarHeight: bottomBarH,
    };
  }

  // 3:4 default baseline
  const left = safeArea.left + horizontalOffset + Math.round((availW - baselineVfW) / 2);

  return {
    width: vw,
    height: vh,
    isLandscape: false,
    safeArea,
    mode: "banded",
    density,
    viewfinderRect: {
      width: baselineVfW,
      height: baselineVfH,
      top: top34,
      left: Math.max(0, left),
    },
    baselineRect,
    topBarHeight: topBarH,
    bottomBarHeight: bottomBarH,
  };
}

/**
 * React hook tracking visual viewport and layout engine updates.
 */
export function useViewportLayout(aspect: CameraAspect = "3:4"): ViewportLayout {
  const [layout, setLayout] = useState<ViewportLayout>(() =>
    calculateLayout(
      typeof window !== "undefined" ? window.innerWidth : 390,
      typeof window !== "undefined" ? window.innerHeight : 844,
      aspect
    )
  );

  const update = useCallback(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;

    // Detect safe-area insets
    const style = getComputedStyle(document.documentElement);
    const parseEnv = (val: string) => parseInt(val, 10) || 0;
    const safeArea = {
      top: parseEnv(style.getPropertyValue("--sat")) || 0,
      bottom: parseEnv(style.getPropertyValue("--sab")) || 0,
      left: parseEnv(style.getPropertyValue("--sal")) || 0,
      right: parseEnv(style.getPropertyValue("--sar")) || 0,
    };

    // Update CSS variables for CSS calculations
    document.documentElement.style.setProperty("--vvw", `${vw}px`);
    document.documentElement.style.setProperty("--vvh", `${vh}px`);

    const nextLayout = calculateLayout(vw, vh, aspect, safeArea);

    // Layout Watchdog: assert aspect ratio and bounded rect invariants
    if (aspect === "3:4" && !nextLayout.isLandscape) {
      const ratio = nextLayout.viewfinderRect.width / nextLayout.viewfinderRect.height;
      const delta = Math.abs(ratio - 0.75);
      if (delta > 0.005) {
        diagnostics.logInvariantViolation(
          `3:4 Aspect violation: ratio ${ratio.toFixed(5)} exceeds 0.750 ± 0.005 (delta: ${delta.toFixed(5)})`
        );
      }
    }
    if (nextLayout.viewfinderRect.top < 0 || nextLayout.viewfinderRect.left < 0) {
      diagnostics.logInvariantViolation(
        `Negative coordinate: top=${nextLayout.viewfinderRect.top}, left=${nextLayout.viewfinderRect.left}`
      );
    }
    if (nextLayout.viewfinderRect.top + nextLayout.viewfinderRect.height > vh) {
      diagnostics.logInvariantViolation(
        `Viewfinder overflow: bottom edge ${nextLayout.viewfinderRect.top + nextLayout.viewfinderRect.height} > viewport height ${vh}`
      );
    }

    setLayout(nextLayout);
  }, [aspect]);

  useEffect(() => {
    let animTimer: ReturnType<typeof setTimeout> | null = null;

    // Comprehensive schedule covering immediate, next frame, 2nd frame and post-animation
    const scheduleAnimationSweep = () => {
      update();
      requestAnimationFrame(() => {
        update();
        requestAnimationFrame(() => {
          update();
        });
      });
      if (animTimer) clearTimeout(animTimer);
      animTimer = setTimeout(update, 250); // catches Chrome Android URL bar settling
    };

    scheduleAnimationSweep();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", scheduleAnimationSweep);
      vv.addEventListener("scroll", scheduleAnimationSweep);
    }
    window.addEventListener("resize", scheduleAnimationSweep);
    window.addEventListener("orientationchange", scheduleAnimationSweep);
    window.addEventListener("pageshow", scheduleAnimationSweep);
    document.addEventListener("visibilitychange", scheduleAnimationSweep);
    document.addEventListener("fullscreenchange", scheduleAnimationSweep);

    return () => {
      if (animTimer) clearTimeout(animTimer);
      if (vv) {
        vv.removeEventListener("resize", scheduleAnimationSweep);
        vv.removeEventListener("scroll", scheduleAnimationSweep);
      }
      window.removeEventListener("resize", scheduleAnimationSweep);
      window.removeEventListener("orientationchange", scheduleAnimationSweep);
      window.removeEventListener("pageshow", scheduleAnimationSweep);
      document.removeEventListener("visibilitychange", scheduleAnimationSweep);
      document.removeEventListener("fullscreenchange", scheduleAnimationSweep);
    };
  }, [update]);

  return layout;
}
