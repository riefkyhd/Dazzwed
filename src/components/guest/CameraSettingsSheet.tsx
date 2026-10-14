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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);
  const [showIosFullscreenTip, setShowIosFullscreenTip] = useState(false);

  const checkRealFullscreen = (): boolean => {
    if (typeof document === "undefined") return false;
    const doc = document as unknown as {
      fullscreenElement?: Element;
      webkitFullscreenElement?: Element;
    };
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalonePwa(isStandalone);

    const updateFsState = () => {
      setIsFullscreen(checkRealFullscreen());
    };

    updateFsState();
    document.addEventListener("fullscreenchange", updateFsState);
    document.addEventListener("webkitfullscreenchange", updateFsState);
    window.addEventListener("resize", updateFsState);
    return () => {
      document.removeEventListener("fullscreenchange", updateFsState);
      document.removeEventListener("webkitfullscreenchange", updateFsState);
      window.removeEventListener("resize", updateFsState);
    };
  }, []);

  // Refresh real fullscreen state whenever the settings sheet opens
  React.useEffect(() => {
    if (open) {
      setIsFullscreen(checkRealFullscreen());
    }
  }, [open]);

  const handleToggleFullscreen = async () => {
    triggerHaptic([20]);

    const doc = document as unknown as {
      fullscreenElement?: Element;
      webkitFullscreenElement?: Element;
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const docEl = document.documentElement as unknown as {
      requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
      webkitRequestFullscreen?: () => Promise<void>;
    };

    const isCurrentlyFs = checkRealFullscreen();

    if (isCurrentlyFs) {
      try {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } catch (err) {
        console.warn("Exit fullscreen failed:", err);
      }
      setIsFullscreen(checkRealFullscreen());
      setShowIosFullscreenTip(false);
    } else {
      let entered = false;
      try {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions).catch(async () => {
            if (docEl.requestFullscreen) await docEl.requestFullscreen();
          });
          entered = checkRealFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
          entered = checkRealFullscreen();
        }
      } catch (err) {
        console.warn("Request fullscreen failed:", err);
        entered = false;
      }

      const activeFs = checkRealFullscreen();
      setIsFullscreen(activeFs);
      if (!entered && !activeFs) {
        // Fullscreen API not supported or rejected (e.g. iOS Safari)
        setShowIosFullscreenTip((prev) => !prev);
      } else {
        setShowIosFullscreenTip(false);
      }
    }
  };

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

          {/* Fullscreen Mode */}
          <div className="py-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-200">
                  {lang === "id" ? "Mode Layar Penuh" : "Fullscreen Mode"}
                </span>
                {isStandalonePwa && (
                  <span className="ml-2 text-[10px] font-mono uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    PWA
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={lang === "id" ? "Alihkan Mode Layar Penuh" : "Toggle Fullscreen Mode"}
                className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  isFullscreen ? "bg-amber-400 justify-end" : "bg-zinc-700 justify-start"
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-black shadow" />
              </button>
            </div>
            {showIosFullscreenTip && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-xs text-amber-200 leading-relaxed">
                {lang === "id"
                  ? "Di iPhone: Ketuk tombol Bagikan (Share) di Safari lalu pilih 'Tambah ke Layar Utama' (Add to Home Screen) untuk pengalaman kamera layar penuh tanpa batas bilah browser."
                  : "On iPhone: Tap the Share button in Safari, then select 'Add to Home Screen' for borderless fullscreen camera without browser bars."}
              </div>
            )}
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
