"use client";

import React, { useState } from "react";
import { triggerHaptic } from "@/lib/camera/haptics";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PerformanceMode, QualityTier } from "@/lib/camera/adaptive-controller";

interface CameraSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showLevel: boolean;
  onToggleLevel: () => void;
  mirrorFront: boolean;
  onToggleMirrorFront: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  rollCode?: string | null;
  eventSlug: string;
  lang: Lang;
  performanceMode?: PerformanceMode;
  onSelectPerformanceMode?: (mode: PerformanceMode) => void;
  qualityTier?: QualityTier;
}

export function CameraSettingsSheet({
  open,
  onClose,
  showGrid,
  onToggleGrid,
  showLevel,
  onToggleLevel,
  mirrorFront,
  onToggleMirrorFront,
  soundEnabled,
  onToggleSound,
  rollCode,
  eventSlug,
  lang,
  performanceMode = "auto",
  onSelectPerformanceMode,
  qualityTier = "A",
}: CameraSettingsSheetProps) {
  const [copied, setCopied] = useState(false);
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    if (open) {
      setRendered(true);
      const timer = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => {
        setRendered(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!rendered) return null;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  const handleCopyCode = async () => {
    if (!rollCode || typeof window === "undefined") return;
    try {
      const url = `${window.location.origin}/e/${eventSlug}?restore=${rollCode}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end bg-black/60 select-none transition-opacity duration-250 ease-out ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop tap to dismiss */}
      <div className="flex-1 cursor-pointer" onClick={handleDismiss} />

      {/* Sheet Content */}
      <div
        className={`w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-700/80 rounded-t-3xl p-6 space-y-4 shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Grab Handle Pill */}
        <div className="w-10 h-1 rounded-full bg-zinc-600/70 mx-auto -mt-2 mb-2" />

        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            {lang === "id" ? "Pengaturan Kamera" : "Camera Tools"}
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Setting Rows */}
        <div className="space-y-3 font-sans text-sm">
          {/* Rule of Thirds Grid */}
          <div className="flex items-center justify-between py-1">
            <span className="text-zinc-200">{lang === "id" ? "Garis Kisi (Grid)" : "Rule of Thirds Grid"}</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic([20]);
                onToggleGrid();
              }}
              className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${
                showGrid ? "bg-amber-400 justify-end" : "bg-zinc-700 justify-start"
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-black shadow" />
            </button>
          </div>

          {/* Horizon Level */}
          <div className="flex items-center justify-between py-1">
            <span className="text-zinc-200">{lang === "id" ? "Indikator Keseimbangan (Level)" : "Level / Horizon Indicator"}</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic([20]);
                onToggleLevel();
              }}
              className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${
                showLevel ? "bg-amber-400 justify-end" : "bg-zinc-700 justify-start"
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-black shadow" />
            </button>
          </div>

          {/* Mirror Front Camera */}
          <div className="flex items-center justify-between py-1">
            <span className="text-zinc-200">{lang === "id" ? "Cerminkan Kamera Depan" : "Mirror Front Camera"}</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic([20]);
                onToggleMirrorFront();
              }}
              className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${
                mirrorFront ? "bg-amber-400 justify-end" : "bg-zinc-700 justify-start"
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-black shadow" />
            </button>
          </div>

          {/* Shutter Sound */}
          <div className="flex items-center justify-between py-1">
            <span className="text-zinc-200">{lang === "id" ? "Suara Jepretan" : "Shutter Sound"}</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic([20]);
                onToggleSound();
              }}
              className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${
                soundEnabled ? "bg-amber-400 justify-end" : "bg-zinc-700 justify-start"
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-black shadow" />
            </button>
          </div>

          {/* Performance Mode (Auto / Quality / Smooth) */}
          {onSelectPerformanceMode && (
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{lang === "id" ? "Mode Performa" : "Performance Mode"}</span>
                <span className="font-mono text-amber-400 uppercase font-semibold">Tier {qualityTier}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800">
                {(["auto", "quality", "smooth"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      triggerHaptic([15]);
                      onSelectPerformanceMode(m);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize transition-all ${
                      performanceMode === m
                        ? "bg-amber-400 text-black font-bold shadow"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {m === "auto" ? (lang === "id" ? "Otomatis" : "Auto") : m === "quality" ? (lang === "id" ? "Kualitas" : "Quality") : (lang === "id" ? "Lancar" : "Smooth")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Roll Code & Restore Link */}
          {rollCode && (
            <div className="pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    {t(lang, "yourRollCode")}
                  </div>
                  <div className="text-base font-mono font-bold text-amber-400 tracking-wider">
                    {rollCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-all active:scale-95"
                >
                  {copied ? t(lang, "savedToDevice") : t(lang, "copyRestoreLink")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
