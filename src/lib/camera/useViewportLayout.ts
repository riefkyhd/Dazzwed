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
  const isLandscape = vw > vh;

  // Available space excluding notches / home indicators
  const availW = Math.max(280, vw - safeArea.left - safeArea.right);
  const availH = Math.max(380, vh - safeArea.top - safeArea.bottom);

  // Target aspect ratio (w / h)
  let targetRatio: number;
  if (aspect === "1:1") {
    targetRatio = 1.0;
  } else if (aspect === "16:9") {
    targetRatio = isLandscape ? 16 / 9 : 9 / 16;
  } else if (aspect === "3:2") {
    targetRatio = isLandscape ? 3 / 2 : 2 / 3;
  } else {
    // "3:4" (default full sensor)
    targetRatio = isLandscape ? 4 / 3 : 3 / 4;
  }

  // Slim unified top bar height (52px)
  const topBarH = 52 + safeArea.top;

  if (isLandscape) {
    // Landscape Mode: Side rail layout (rail on the right, 96px width)
    const railWidth = 96 + safeArea.right;
    const maxVfW = availW - 96;
    let vfH = availH;
    let vfW = Math.round(vfH * targetRatio);
    if (vfW > maxVfW) {
      vfW = maxVfW;
      vfH = Math.round(vfW / targetRatio);
    }

    const top = safeArea.top + Math.round((availH - vfH) / 2);
    const left = safeArea.left + Math.round((maxVfW - vfW) / 2);

    return {
      width: vw,
      height: vh,
      isLandscape: true,
      safeArea,
      mode: "banded",
      density: "L0",
      viewfinderRect: {
        width: vfW,
        height: vfH,
        top: Math.max(0, top),
        left: Math.max(0, left),
      },
      topBarHeight: 0,
      bottomBarHeight: railWidth,
    };
  }

  // Portrait Mode:
  const isFullBleed = aspect === "16:9";

  if (isFullBleed) {
    // Full-bleed mode: viewfinder fills portrait width (9:16)
    let vfW = availW;
    let vfH = Math.round(vfW / targetRatio);

    if (vfH > vh) {
      vfH = vh;
      vfW = Math.round(vfH * targetRatio);
    }

    const top = Math.round((vh - vfH) / 2);
    const left = safeArea.left + Math.round((availW - vfW) / 2);

    return {
      width: vw,
      height: vh,
      isLandscape: false,
      safeArea,
      mode: "full-bleed",
      density: "L1",
      viewfinderRect: {
        width: vfW,
        height: vfH,
        top: Math.max(0, top),
        left: Math.max(0, left),
      },
      topBarHeight: topBarH,
      bottomBarHeight: Math.max(140, vh - (top + vfH)),
    };
  }

  // Banded mode: Top and bottom solid black bars framing the central viewfinder.
  // Viewfinder placed directly below the 52px top bar.
  // Reserve minimum bottom bar space (100px) so viewfinder does not exceed viewport height on tablets
  const minBottomReserved = 100 + safeArea.bottom;
  const maxAllowedH = availH - 52 - minBottomReserved;

  let vfW = availW;
  let vfH = Math.round(vfW / targetRatio);

  if (vfH > maxAllowedH) {
    vfH = maxAllowedH;
    vfW = Math.round(vfH * targetRatio);
  }

  // Check remaining bottom space for density ladder
  // L0: >= 180px bottom space (all controls in bottom band)
  // L1: 130px - 179px bottom space (lens chips float over lower ~8% of viewfinder)
  // L2: < 130px bottom space (look selector collapses into drawer button)
  const availableBottomH = vh - topBarH - vfH;

  let density: DensityLevel = "L0";
  if (availableBottomH < 130) {
    density = "L2";
  } else if (availableBottomH < 180) {
    density = "L1";
  }

  const top = topBarH;
  const left = safeArea.left + Math.round((availW - vfW) / 2);
  const bottomBarH = Math.max(0, vh - (top + vfH));

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
