"use client";

import React from "react";
import {
  getEffectiveDisplayZoom,
  resolveZoomPreset,
  type Lens,
  type ZoomPreset,
} from "@/lib/camera/lenses";
import { triggerHaptic } from "@/lib/camera/haptics";

interface LensBarProps {
  lenses: Lens[];
  activeId?: string;
  zoomRange: { min: number; max: number; step?: number } | null;
  currentZoom: number;
  digitalZoom: number;
  onSelectLens: (deviceId: string, targetPreset?: number) => void;
  onSetZoom: (zoom: number) => void;
  onSetDigitalZoom: (zoom: number) => void;
  rotationDegrees?: number;
}

export function LensBar({
  lenses,
  activeId,
  zoomRange,
  currentZoom,
  digitalZoom,
  onSelectLens,
  onSetZoom,
  onSetDigitalZoom,
  rotationDegrees = 0,
}: LensBarProps) {
  // Hide bar only when no rear camera lenses or zoom capabilities exist yet
  if (lenses.length === 0 && !zoomRange) {
    return null;
  }

  const normalizedRange = zoomRange
    ? { min: zoomRange.min, max: zoomRange.max, step: zoomRange.step ?? 0.1 }
    : null;

  const ultrawide = lenses.find((l) => l.kind === "ultrawide");
  const hasNativeUltraWideZoom = Boolean(normalizedRange && normalizedRange.min < 1);

  const effectiveZoom = getEffectiveDisplayZoom({
    activeId,
    lenses,
    zoom: currentZoom,
    digitalZoom,
    zoomRange: normalizedRange,
  });

  const handlePresetClick = (preset: ZoomPreset) => {
    triggerHaptic([15]);
    const plan = resolveZoomPreset({
      preset,
      lenses,
      activeId,
      zoomRange: normalizedRange,
    });

    if (plan.requiresStreamSwitch && plan.targetDeviceId) {
      onSelectLens(plan.targetDeviceId, preset);
      return;
    }

    if (plan.mechanism === "browser-zoom-constraint") {
      onSetZoom(plan.targetNativeZoom);
      onSetDigitalZoom(1);
    } else if (plan.mechanism === "app-digital-crop") {
      if (normalizedRange) {
        onSetZoom(plan.targetNativeZoom);
      }
      onSetDigitalZoom(plan.targetDigitalZoom);
    } else {
      if (normalizedRange) {
        onSetZoom(plan.targetNativeZoom);
      }
      onSetDigitalZoom(plan.targetDigitalZoom);
    }
  };

  const is05Active = effectiveZoom < 0.9;
  const is1xActive = effectiveZoom >= 0.9 && effectiveZoom < 1.8;
  const is2xActive = effectiveZoom >= 1.8 && effectiveZoom < 2.8;
  const is3xActive = effectiveZoom >= 2.8;

  const rotStyle: React.CSSProperties = {
    transform: `rotate(${rotationDegrees}deg)`,
    transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
    transformOrigin: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      role="group"
      aria-label="Camera Zoom"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="flex items-center gap-1 p-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 shadow-xl shadow-black/40 select-none animate-in fade-in zoom-in-95 duration-200"
    >
      {/* 0.5x Ultra Wide */}
      {(ultrawide || hasNativeUltraWideZoom) && (
        <button
          type="button"
          onClick={() => handlePresetClick(0.5)}
          aria-label="0.5x Ultra Wide"
          className={`w-8 h-8 rounded-full text-xs font-mono font-bold flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
            is05Active
              ? "bg-amber-400 text-black scale-105 shadow-md shadow-amber-400/25"
              : "text-zinc-200/90 hover:text-white hover:bg-white/10 active:scale-90"
          }`}
        >
          <span style={rotStyle}>0.5</span>
        </button>
      )}

      {/* 1x Main Lens */}
      <button
        type="button"
        onClick={() => handlePresetClick(1)}
        aria-label="1x Main Lens"
        className={`w-8 h-8 rounded-full text-xs font-mono font-bold flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
          is1xActive
            ? "bg-amber-400 text-black scale-105 shadow-md shadow-amber-400/25"
            : "text-zinc-200/90 hover:text-white hover:bg-white/10 active:scale-90"
        }`}
      >
        <span style={rotStyle}>1x</span>
      </button>

      {/* 2x Preset */}
      <button
        type="button"
        onClick={() => handlePresetClick(2)}
        aria-label="2x Zoom"
        className={`w-8 h-8 rounded-full text-xs font-mono font-bold flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
          is2xActive
            ? "bg-amber-400 text-black scale-105 shadow-md shadow-amber-400/25"
            : "text-zinc-200/90 hover:text-white hover:bg-white/10 active:scale-90"
        }`}
      >
        <span style={rotStyle}>2</span>
      </button>

      {/* 3x Preset */}
      <button
        type="button"
        onClick={() => handlePresetClick(3)}
        aria-label="3x Zoom"
        className={`w-8 h-8 rounded-full text-xs font-mono font-bold flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
          is3xActive
            ? "bg-amber-400 text-black scale-105 shadow-md shadow-amber-400/25"
            : "text-zinc-200/90 hover:text-white hover:bg-white/10 active:scale-90"
        }`}
      >
        <span style={rotStyle}>3</span>
      </button>
    </div>
  );
}
