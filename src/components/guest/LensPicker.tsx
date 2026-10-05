"use client";

import React from "react";
import type { Lens } from "@/lib/camera/lenses";

interface LensPickerProps {
  lenses: Lens[];
  activeId?: string;
  onSelect: (deviceId: string) => void;
}

function shortLabel(lens: Lens, index: number): string {
  if (lens.kind === "ultrawide") return "0.5x";
  if (lens.kind === "main") return "1x";
  if (lens.kind === "tele") return "3x";
  return `${index + 1}x`;
}

export function LensPicker({ lenses, activeId, onSelect }: LensPickerProps) {
  if (!lenses || lenses.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-full bg-zinc-950/70 backdrop-blur-md border border-zinc-700/60 shadow-lg">
      {lenses.map((lens, i) => {
        const isActive = activeId ? lens.deviceId === activeId : i === 0;
        return (
          <button
            key={lens.deviceId}
            type="button"
            onClick={() => onSelect(lens.deviceId)}
            className={`min-w-8 h-8 px-2 rounded-full text-xs font-mono font-bold transition-all ${
              isActive
                ? "bg-accent text-accent-fg shadow-sm scale-105"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/60 active:scale-95"
            }`}
          >
            {shortLabel(lens, i)}
          </button>
        );
      })}
    </div>
  );
}
