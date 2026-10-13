"use client";

import React from "react";
import {
  getEffectiveDisplayZoom,
  resolveZoomPreset,
  type Lens,
  type ZoomPreset,
} from "@/lib/camera/lenses";

interface LensBarProps {
  lenses: Lens[];
  activeId?: string;
  zoomRange: { min: number; max: number; step?: number } | null;
  currentZoom: number;
  digitalZoom: number;
  onSelectLens: (deviceId: string, targetPreset?: number) => void;
  onSetZoom: (zoom: number) => void;
  onSetDigitalZoom: (zoom: number) => void;
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

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 shadow-lg">
      {/* 0.5x Ultra Wide (only when ultra-wide device or sub-1x browser zoom range exists) */}
      {(ultrawide || hasNativeUltraWideZoom) && (
        <button
          type="button"
          onClick={() => handlePresetClick(0.5)}
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
            effectiveZoom < 0.9
              ? "bg-amber-400 text-black shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          0.5x
        </button>
      )}

      {/* 1x Main Lens */}
      <button
        type="button"
        onClick={() => handlePresetClick(1)}
        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
          effectiveZoom >= 0.9 && effectiveZoom < 1.8
            ? "bg-amber-400 text-black shadow"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        1x
      </button>

      {/* 2x Preset (Explicit 2x lens -> Browser zoom constraint -> App digital crop fallback) */}
      <button
        type="button"
        onClick={() => handlePresetClick(2)}
        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
          effectiveZoom >= 1.8 && effectiveZoom < 2.8
            ? "bg-amber-400 text-black shadow"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        2x
      </button>

      {/* 3x Preset (Explicit 3x lens -> Browser zoom constraint -> App digital crop fallback) */}
      <button
        type="button"
        onClick={() => handlePresetClick(3)}
        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
          effectiveZoom >= 2.8
            ? "bg-amber-400 text-black shadow"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        3x
      </button>
    </div>
  );
}
