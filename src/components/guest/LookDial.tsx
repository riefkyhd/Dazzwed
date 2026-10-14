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
    case "cpm-35":
    case "cpm35":
      return "35MM";
    case "portra-400":
      return "PORT";
    case "cinestill-800t":
      return "800T";
    case "fuji-eterna-250d":
      return "250D";
    case "classic-neg":
      return "NEG";
    case "tri-x-400":
      return "B&W";
    case "ilford-hp5-plus":
      return "MONO";
    case "kodak-ektar-100":
      return "V100";
    case "super-8mm-vintage":
      return "SUP8";
    case "disposable-400":
      return "400";
    case "golden-200":
      return "200";
    case "ccd-flash":
      return "CCD";
    case "instant-film":
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chipRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const availableLooks = BUILTIN_LOOKS.filter(
    (l) => !allowedLookIds || allowedLookIds.includes(l.id)
  );

  const centerActiveChip = React.useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container) return;
      const chip = chipRefs.current.get(activeLook.id);
      if (!chip) return;

      const chipLeft = chip.offsetLeft;
      const chipWidth = chip.offsetWidth;
      const containerWidth = container.clientWidth;

      // Position active recipe in the middle; clamp to [0, maxScroll] for edge chips
      const targetLeft = chipLeft - (containerWidth - chipWidth) / 2;
      const maxScroll = Math.max(0, container.scrollWidth - containerWidth);
      const clamped = Math.max(0, Math.min(targetLeft, maxScroll));

      container.scrollTo({
        left: clamped,
        behavior,
      });
    },
    [activeLook.id]
  );

  React.useEffect(() => {
    if (isCollapsed) return;

    centerActiveChip("auto");
    const rafId = requestAnimationFrame(() => {
      centerActiveChip("smooth");
    });
    const t1 = setTimeout(() => centerActiveChip("smooth"), 100);
    const t2 = setTimeout(() => centerActiveChip("smooth"), 300);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isCollapsed, activeLook.id, centerActiveChip]);

  if (availableLooks.length <= 1) return null;

  // L2 density collapsed button
  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onOpenLookDrawer}
        aria-label={`Select Film Look. Current: ${activeLook.name}`}
        className="px-3 py-1.5 rounded-full bg-zinc-950/95 border border-white/20 text-white font-mono text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-lg cursor-pointer"
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
      <div
        ref={containerRef}
        className="flex items-center gap-1.5 p-1 bg-zinc-950/95 rounded-full border border-white/15 shadow-xl select-none overflow-x-auto no-scrollbar scroll-smooth"
      >
        {availableLooks.map((look) => {
          const isSelected = activeLook.id === look.id;
          const chipLabel = getLookChipLabel(look);
          return (
            <button
              key={look.id}
              ref={(el) => {
                if (el) chipRefs.current.set(look.id, el);
                else chipRefs.current.delete(look.id);
              }}
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
