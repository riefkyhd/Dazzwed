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
  pendingCount: number;
  syncError?: boolean;
  onOpenSyncStatus?: () => void;
  onOpenSettings: () => void;
  onNativeTipClick?: () => void;
  lang: Lang;
  showSyncTooltip?: boolean;
  syncTooltipFading?: boolean;
  rotationDegrees?: number;
}

export function CameraTopBar({
  flashAvailable,
  flashMode,
  onChangeFlashMode,
  aspect,
  onChangeAspect,
  timerSeconds,
  onChangeTimer,
  pendingCount,
  syncError = false,
  onOpenSyncStatus,
  onOpenSettings,
  onNativeTipClick,
  lang,
  showSyncTooltip = false,
  syncTooltipFading = false,
  rotationDegrees = 0,
}: CameraTopBarProps) {
  const [justSynced, setJustSynced] = React.useState(false);
  const prevPendingRef = React.useRef(pendingCount);

  React.useEffect(() => {
    if (prevPendingRef.current > 0 && pendingCount === 0 && !syncError) {
      setJustSynced(true);
      const timer = setTimeout(() => {
        setJustSynced(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, syncError]);

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

  // Cycle timer: 0s -> 3s -> 5s -> 10s -> 0s
  const cycleTimer = () => {
    triggerHaptic([20]);
    if (timerSeconds === 0) onChangeTimer(3);
    else if (timerSeconds === 3) onChangeTimer(5);
    else if (timerSeconds === 5) onChangeTimer(10);
    else onChangeTimer(0);
  };

  // Smooth rotation style for individual control icons
  const rotStyle: React.CSSProperties = {
    transform: `rotate(${rotationDegrees}deg)`,
    transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
    transformOrigin: "center",
  };

  return (
    <div className="w-full h-full min-h-[52px] flex items-center justify-between px-3 select-none touch-manipulation z-30 pointer-events-auto">
      {/* 1. Flash Mode Button (Icon + small badge, >= 48x48 hit target) */}
      <button
        type="button"
        data-testid="flash-button"
        onClick={cycleFlash}
        aria-label={`Flash Mode: ${flashMode}`}
        className="w-12 h-12 flex items-center justify-center relative rounded-full text-zinc-300 hover:text-white active:scale-90 transition-transform cursor-pointer"
      >
        <div
          style={rotStyle}
          className={`w-9 h-9 rounded-full flex items-center justify-center relative transition-colors ${
            flashMode === "on"
              ? "bg-amber-400 text-black shadow-md"
              : flashMode === "auto"
                ? "bg-black/60 text-amber-300 border border-amber-400/40"
                : "bg-black/50 text-white/50 border border-white/10"
          } ${!flashAvailable ? "opacity-60" : ""}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
          </svg>
          {/* Badge: A, ON, OFF */}
          <span
            className={`absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full font-mono text-[8px] font-black uppercase leading-tight shadow-sm ${
              flashMode === "on"
                ? "bg-black text-amber-400"
                : flashMode === "auto"
                  ? "bg-amber-400 text-black"
                  : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {flashMode === "auto" ? "A" : flashMode}
          </span>
        </div>
      </button>

      {/* 2. Aspect Ratio Selector (>= 48x48 hit target) */}
      <button
        type="button"
        data-testid="aspect-button"
        onClick={cycleAspect}
        aria-label="Change aspect ratio"
        className="w-12 h-12 flex items-center justify-center rounded-full text-white active:scale-90 transition-transform cursor-pointer"
      >
        <span
          style={rotStyle}
          className="px-2.5 py-1 rounded-full bg-black/60 text-zinc-200 font-mono text-[11px] font-bold border border-white/15 backdrop-blur-md shadow-sm"
        >
          {aspect === "3:4" ? "3:4" : aspect}
        </span>
      </button>

      {/* 3. Timer Selector Button (>= 48x48 hit target) */}
      <button
        type="button"
        data-testid="timer-button"
        onClick={cycleTimer}
        aria-label={timerSeconds > 0 ? `Countdown Timer: ${timerSeconds}s` : "Countdown Timer: Off"}
        className="w-12 h-12 flex items-center justify-center rounded-full text-white active:scale-90 transition-transform cursor-pointer"
      >
        <div
          style={rotStyle}
          className={`w-9 h-9 flex items-center justify-center rounded-full border font-mono text-[11px] font-bold transition-colors ${
            timerSeconds > 0
              ? "bg-amber-400 text-black border-amber-300 shadow-md"
              : "bg-black/60 text-white/90 border-white/10"
          }`}
        >
          {timerSeconds > 0 ? (
            `${timerSeconds}s`
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </button>

      {/* 4. Sync Status Indicator (>= 48x48 hit target) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            triggerHaptic([15]);
            onOpenSyncStatus?.();
          }}
          aria-label={syncError ? "Sync error" : pendingCount > 0 ? `${pendingCount} photos pending` : "All photos synced"}
          className="w-12 h-12 flex items-center justify-center rounded-full active:scale-90 transition-transform cursor-pointer"
        >
          <div
            style={rotStyle}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-950/95 border border-white/15 shadow-md"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncError
                  ? "bg-rose-500 animate-ping"
                  : pendingCount > 0
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400"
              }`}
            />
            {pendingCount > 0 ? (
              <span className="font-mono text-[10px] font-bold text-amber-300">
                {pendingCount}
              </span>
            ) : justSynced ? (
              <span className="font-mono text-[10px] font-medium text-emerald-400 animate-in fade-in duration-300">
                ✓
              </span>
            ) : null}
          </div>
        </button>

        {/* Floating Sync Tooltip (First photo save only, auto-vanishes after ~2s) */}
        {showSyncTooltip && (
          <div
            role="tooltip"
            className={`absolute top-full mt-2 -right-8 sm:right-0 z-50 pointer-events-none transition-all duration-500 ease-out ${
              syncTooltipFading ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            <div className="relative bg-zinc-950/95 border border-amber-500/40 text-zinc-100 px-3.5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md w-56 text-center animate-in fade-in zoom-in-95 duration-200">
              {/* Caret arrow */}
              <div className="absolute -top-1.5 right-12 sm:right-5 w-3 h-3 bg-zinc-950 border-t border-l border-amber-500/40 rotate-45" />
              <div className="flex items-center gap-1.5 justify-center mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                  {lang === "id" ? "Sinkronisasi" : "Auto-Sync"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-200 leading-snug font-sans">
                {lang === "id"
                  ? "Indikator sinkronisasi — foto Anda diunggah otomatis di latar belakang"
                  : "Sync indicator — your photos upload automatically in the background"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5. More / Settings Sheet Button (>= 48x48 hit target) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic([20]);
          onOpenSettings();
        }}
        aria-label="Camera Settings & Tools"
        className="w-12 h-12 flex items-center justify-center rounded-full text-white/90 active:scale-90 transition-transform cursor-pointer"
      >
        <div
          style={rotStyle}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-950/95 border border-white/15 shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
    </div>
  );
}
