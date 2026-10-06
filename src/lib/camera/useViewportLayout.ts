"use client";

import { useEffect, useState, useCallback } from "react";
import type { CameraAspect } from "@/lib/imaging/geometry";

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

  // Minimum reserved height for controls in portrait
  const minTopBar = 54;
  const minBottomBar = 150;
  const totalReservedBars = minTopBar + minBottomBar;

  if (isLandscape) {
    // Landscape Mode: Side rail layout (rail on the right)
    const railWidth = 100;
    const maxVfW = availW - railWidth;
    let vfH = availH;
    let vfW = vfH * targetRatio;
    if (vfW > maxVfW) {
      vfW = maxVfW;
      vfH = vfW / targetRatio;
    }

    const top = safeArea.top + (availH - vfH) / 2;
    const left = safeArea.left + (maxVfW - vfW) / 2;

    return {
      width: vw,
      height: vh,
      isLandscape: true,
      safeArea,
      mode: "banded",
      viewfinderRect: {
        width: Math.round(vfW),
        height: Math.round(vfH),
        top: Math.max(0, Math.round(top)),
        left: Math.max(0, Math.round(left)),
      },
      topBarHeight: 0,
      bottomBarHeight: railWidth,
    };
  }

  // Portrait Mode:
  const maxBandedH = availH - totalReservedBars;
  const isFullBleed = aspect === "16:9" || maxBandedH < 200;

  if (isFullBleed) {
    // Full-bleed mode: viewfinder fills available portrait bounds
    let vfW = availW;
    let vfH = vfW / targetRatio;

    // Must not exceed availH
    if (vfH > availH) {
      vfH = availH;
      vfW = vfH * targetRatio;
    }

    const top = safeArea.top + (availH - vfH) / 2;
    const left = safeArea.left + (availW - vfW) / 2;

    return {
      width: vw,
      height: vh,
      isLandscape: false,
      safeArea,
      mode: "full-bleed",
      viewfinderRect: {
        width: Math.round(vfW),
        height: Math.round(vfH),
        top: Math.max(0, Math.round(top)),
        left: Math.max(0, Math.round(left)),
      },
      topBarHeight: minTopBar,
      bottomBarHeight: minBottomBar,
    };
  }

  // Banded mode: Top and bottom solid black bars framing the central viewfinder (like iPhone 4:3)
  let vfW = availW;
  let vfH = vfW / targetRatio;
  if (vfH > maxBandedH) {
    vfH = maxBandedH;
    vfW = vfH * targetRatio;
  }

  const remainingH = availH - vfH;
  const topBarH = Math.max(minTopBar, remainingH * 0.28);
  const bottomBarH = Math.max(minBottomBar, remainingH - topBarH);

  const top = safeArea.top + topBarH;
  const left = safeArea.left + (availW - vfW) / 2;

  return {
    width: vw,
    height: vh,
    isLandscape: false,
    safeArea,
    mode: "banded",
    viewfinderRect: {
      width: Math.round(vfW),
      height: Math.round(vfH),
      top: Math.max(0, Math.round(top)),
      left: Math.max(0, Math.round(left)),
    },
    topBarHeight: Math.round(topBarH),
    bottomBarHeight: Math.round(bottomBarH),
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

    setLayout(calculateLayout(vw, vh, aspect, safeArea));
  }, [aspect]);

  useEffect(() => {
    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [update]);

  return layout;
}
