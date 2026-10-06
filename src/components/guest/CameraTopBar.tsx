"use client";

import React from "react";
import type { CameraAspect } from "@/lib/imaging/geometry";
import { triggerHaptic } from "@/lib/camera/haptics";
import type { Lang } from "@/lib/i18n";

interface CameraTopBarProps {
  flashAvailable: boolean;
  flashMode: "auto" | "on" | "off";
  onChangeFlashMode: (mode: "auto" | "on" | "off") => void;
  aspect: CameraAspect;
  onChangeAspect: (aspect: CameraAspect) => void;
  timerSeconds: number; // 0, 3, 10
  onChangeTimer: (sec: number) => void;
  onOpenSettings: () => void;
  onNativeTipClick?: () => void;
  lang: Lang;
}

export function CameraTopBar({
  flashAvailable,
  flashMode,
  onChangeFlashMode,
  aspect,
  onChangeAspect,
  timerSeconds,
  onChangeTimer,
  onOpenSettings,
  onNativeTipClick,
}: CameraTopBarProps) {
  // Cycle flash: auto -> on -> off -> auto
  const cycleFlash = () => {
    triggerHaptic([25]);
    if (!flashAvailable && onNativeTipClick) {
      onNativeTipClick();
      return;
    }
    if (flashMode === "auto") onChangeFlashMode("on");
    else if (flashMode === "on") onChangeFlashMode("off");
    else onChangeFlashMode("auto");
  };

  // Cycle aspect: 3:4 -> 1:1 -> 16:9 -> 3:4
  const cycleAspect = () => {
    triggerHaptic([20]);
    if (aspect === "3:4") onChangeAspect("1:1");
    else if (aspect === "1:1") onChangeAspect("16:9");
    else onChangeAspect("3:4");
  };

  // Cycle timer: 0s -> 3s -> 10s -> 0s
  const cycleTimer = () => {
    triggerHaptic([20]);
    if (timerSeconds === 0) onChangeTimer(3);
    else if (timerSeconds === 3) onChangeTimer(10);
    else onChangeTimer(0);
  };

  return (
    <div className="w-full h-13 flex items-center justify-between px-4 select-none touch-manipulation z-30 pointer-events-auto">
      {/* Real Flash Mode button (Auto / On / Off) */}
      <button
        type="button"
        onClick={cycleFlash}
        aria-label={`Flash Mode: ${flashMode}`}
        className={`relative h-9 px-2.5 flex items-center gap-1 rounded-full transition-all active:scale-90 font-mono text-[11px] font-bold ${
          flashMode === "on"
            ? "bg-amber-400 text-black shadow-lg"
            : flashMode === "auto"
              ? "bg-black/60 text-amber-300 border border-amber-400/40"
              : "bg-black/50 text-white/50 border border-white/10"
        } ${!flashAvailable ? "opacity-75" : ""}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
        </svg>
        <span className="uppercase">{flashMode}</span>
      </button>

      {/* Aspect Ratio Selector Pill */}
      <button
        type="button"
        onClick={cycleAspect}
        aria-label="Change aspect ratio"
        className="px-3 h-8.5 flex items-center justify-center rounded-full bg-black/50 text-white font-mono text-xs font-bold border border-white/15 backdrop-blur-md active:scale-95 transition-all shadow-md"
      >
        {aspect === "3:4" ? "4:3" : aspect}
      </button>

      {/* Timer Selector Button */}
      <button
        type="button"
        onClick={cycleTimer}
        aria-label="Countdown Timer"
        className={`w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-90 border font-mono text-xs font-bold ${
          timerSeconds > 0
            ? "bg-amber-400 text-black border-amber-300 shadow-lg"
            : "bg-black/50 text-white/90 border-white/10 hover:bg-black/70"
        }`}
      >
        {timerSeconds > 0 ? (
          `${timerSeconds}s`
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* More / Settings Sheet Button */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic([20]);
          onOpenSettings();
        }}
        aria-label="Camera Settings & Tools"
        className="w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white/90 hover:bg-black/70 border border-white/10 active:scale-90 transition-all shadow-md"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
