"use client";

import React from "react";
import type { ZoomRange } from "@/lib/camera/caps";
import { DIGITAL_ZOOM_STEPS } from "@/lib/camera/caps";
import { type Lang, t } from "@/lib/i18n";

interface ZoomControlProps {
  zoomRange: ZoomRange | null;
  nativeZoom: number;
  onNativeZoomChange: (val: number) => void;
  digitalZoom: number;
  onDigitalZoomChange: (val: number) => void;
  lang: Lang;
}

export function ZoomControl({
  zoomRange,
  nativeZoom,
  onNativeZoomChange,
  digitalZoom,
  onDigitalZoomChange,
  lang,
}: ZoomControlProps) {
  // If native zoom is available (Android Chrome), render a smooth slider or quick steps
  if (zoomRange) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/70 backdrop-blur-md border border-zinc-700/60 shadow-lg">
        <span className="text-[10px] font-mono text-zinc-400 font-bold">
          {nativeZoom.toFixed(1)}x
        </span>
        <input
          type="range"
          min={zoomRange.min}
          max={zoomRange.max}
          step={zoomRange.step}
          value={nativeZoom}
          onChange={(e) => onNativeZoomChange(parseFloat(e.target.value))}
          className="w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-accent"
        />
      </div>
    );
  }

  // Fallback for iOS Safari: discrete 1x / 2x digital zoom
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-950/70 backdrop-blur-md border border-zinc-700/60 shadow-lg">
      {DIGITAL_ZOOM_STEPS.map((step) => {
        const isActive = digitalZoom === step;
        return (
          <button
            key={step}
            type="button"
            onClick={() => onDigitalZoomChange(step)}
            className={`min-w-7 h-7 px-1.5 rounded-full text-xs font-mono font-semibold transition-all ${
              isActive
                ? "bg-accent text-accent-fg shadow-sm"
                : "text-zinc-300 hover:text-white active:scale-95"
            }`}
          >
            {step}x
          </button>
        );
      })}
      <span className="text-[9px] uppercase tracking-tighter text-zinc-400 pr-1 pl-0.5">
        {t(lang, "digital")}
      </span>
    </div>
  );
}
