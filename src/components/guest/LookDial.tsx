"use client";

import React from "react";
import type { LookRecipe } from "@/lib/imaging/looks/types";
import { BUILTIN_LOOKS } from "@/lib/imaging/looks/presets";
import { triggerHaptic } from "@/lib/camera/haptics";

interface LookDialProps {
  activeLook: LookRecipe;
  onSelectLook: (look: LookRecipe) => void;
  allowedLookIds?: string[];
}

export function LookDial({ activeLook, onSelectLook, allowedLookIds }: LookDialProps) {
  const availableLooks = BUILTIN_LOOKS.filter(
    (l) => !allowedLookIds || allowedLookIds.includes(l.id)
  );

  if (availableLooks.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 p-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg select-none">
      {availableLooks.map((look) => {
        const isSelected = activeLook.id === look.id;
        return (
          <button
            key={look.id}
            type="button"
            onClick={() => {
              triggerHaptic([20]);
              onSelectLook(look);
            }}
            className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium tracking-wider transition-all duration-150 cursor-pointer ${
              isSelected
                ? "bg-amber-400 text-black shadow-md font-bold scale-105"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 active:scale-95"
            }`}
          >
            {look.name.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
