"use client";

import React from "react";
import type { Lens } from "@/lib/camera/lenses";

interface LensBarProps {
  lenses: Lens[];
  activeId?: string;
  zoomRange: { min: number; max: number } | null;
  currentZoom: number;
  digitalZoom: number;
  onSelectLens: (deviceId: string) => void;
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
  // If no hardware lenses reported, hide bar
  if (lenses.length <= 1 && !zoomRange) {
    return null;
  }

  // Derive buttons: 0.5x, 1x, 2x, 3x from real hardware
  const ultrawide = lenses.find((l) => l.kind === "ultrawide");
  const main = lenses.find((l) => l.kind === "main") || lenses[0];
  const tele = lenses.find((l) => l.kind === "tele");

  // On Android Chrome with min zoom < 1 (e.g., 0.5 or 0.6)
  const hasNativeUltraWideZoom = zoomRange && zoomRange.min < 1;

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 shadow-lg">
      {/* 0.5x Ultra Wide */}
      {(ultrawide || hasNativeUltraWideZoom) && (
        <button
          type="button"
          onClick={() => {
            if (ultrawide) {
              onSelectLens(ultrawide.deviceId);
            } else if (hasNativeUltraWideZoom && zoomRange) {
              onSetZoom(zoomRange.min);
            }
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
            (ultrawide && activeId === ultrawide.deviceId) ||
            (!ultrawide && currentZoom < 0.9)
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
        onClick={() => {
          if (main) onSelectLens(main.deviceId);
          if (zoomRange) onSetZoom(1);
          onSetDigitalZoom(1);
        }}
        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
          (!ultrawide || activeId === main?.deviceId) && currentZoom >= 0.9 && currentZoom < 1.8 && digitalZoom === 1
            ? "bg-amber-400 text-black shadow"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        1x
      </button>

      {/* 2x Telephoto or Digital Step */}
      <button
        type="button"
        onClick={() => {
          if (tele) {
            onSelectLens(tele.deviceId);
          } else if (zoomRange && zoomRange.max >= 2) {
            onSetZoom(2);
          } else {
            onSetDigitalZoom(2);
          }
        }}
        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
          (tele && activeId === tele.deviceId) ||
          currentZoom >= 1.8 ||
          digitalZoom === 2
            ? "bg-amber-400 text-black shadow"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        2x
      </button>

      {/* 3x if telephoto reports or hardware allows */}
      {zoomRange && zoomRange.max >= 3 && (
        <button
          type="button"
          onClick={() => onSetZoom(3)}
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
            currentZoom >= 2.8 ? "bg-amber-400 text-black shadow" : "text-zinc-400 hover:text-white"
          }`}
        >
          3x
        </button>
      )}
    </div>
  );
}
