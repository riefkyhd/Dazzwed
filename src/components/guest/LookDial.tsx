"use client";

import React from "react";
import type { LookRecipe } from "@/lib/imaging/looks/types";
import { BUILTIN_LOOKS } from "@/lib/imaging/looks/presets";
import { triggerHaptic } from "@/lib/camera/haptics";

interface LookDialProps {
  activeLook: LookRecipe;
  onSelectLook: (look: LookRecipe) => void;
  allowedLookIds?: string[];
  isCollapsed?: boolean;
  onOpenLookDrawer?: () => void;
}

/** Short abbreviations for chips that fit without overflowing/clipping */
function getLookChipLabel(look: LookRecipe): string {
  switch (look.id) {
    case "cpm35":
      return "CPM";
    case "classic-neg":
      return "NEG";
    case "disposable-400":
      return "400";
    case "golden-200":
      return "200";
    case "ccd-flash":
      return "CCD";
    case "instant":
      return "INST";
    case "neutral":
      return "RAW";
    default:
      return look.name.slice(0, 4).toUpperCase();
  }
}

export function LookDial({
  activeLook,
  onSelectLook,
  allowedLookIds,
  isCollapsed = false,
  onOpenLookDrawer,
}: LookDialProps) {
  const availableLooks = BUILTIN_LOOKS.filter(
    (l) => !allowedLookIds || allowedLookIds.includes(l.id)
  );

  if (availableLooks.length <= 1) return null;

  // L2 density collapsed button
  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onOpenLookDrawer}
        aria-label={`Select Film Look. Current: ${activeLook.name}`}
        className="px-3 py-1.5 rounded-full bg-black/75 border border-white/20 text-white font-mono text-xs font-bold flex items-center gap-1.5 backdrop-blur-md active:scale-95 shadow-md cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span>{getLookChipLabel(activeLook)}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-zinc-400">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative max-w-full overflow-hidden flex items-center justify-center">
      <div className="flex items-center gap-1.5 p-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg select-none overflow-x-auto no-scrollbar scroll-smooth">
        {availableLooks.map((look) => {
          const isSelected = activeLook.id === look.id;
          const chipLabel = getLookChipLabel(look);
          return (
            <button
              key={look.id}
              type="button"
              onClick={() => {
                triggerHaptic([20]);
                onSelectLook(look);
              }}
              className={`min-w-10 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                isSelected
                  ? "bg-amber-400 text-black shadow-md font-bold scale-105"
                  : "text-zinc-300 hover:text-white hover:bg-white/5 active:scale-95"
              }`}
            >
              {chipLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
