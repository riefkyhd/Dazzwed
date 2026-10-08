"use client";

import React, { useEffect, useState, useRef } from "react";
import { type Lang, t } from "@/lib/i18n";
import { triggerHaptic } from "@/lib/camera/haptics";
import type { CameraAspect } from "@/lib/imaging/geometry";

interface ReviewModalProps {
  photoBlob: Blob;
  aspect?: CameraAspect;
  lookName?: string;
  shotsLeft?: number;
  totalShots?: number;
  lang: Lang;
  onKeep: () => Promise<void>;
  onRetake: () => void;
}

export function ReviewModal({
  photoBlob,
  aspect = "3:4",
  lookName = "35mm Film",
  shotsLeft,
  totalShots = 15,
  lang,
  onKeep,
  onRetake,
}: ReviewModalProps) {
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [isDeveloped, setIsDeveloped] = useState(false);
  const [isKeeping, setIsKeeping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isKeepingRef = useRef(false);
  const activeUrlRef = useRef<string | null>(null);

  // Safe Blob URL lifecycle: create once and revoke only on unmount or blob change
  useEffect(() => {
    const url = URL.createObjectURL(photoBlob);
    activeUrlRef.current = url;
    setPhotoUrl(url);

    // Chemical development simulation: gentle analog bloom/fog reveal over 400ms
    const devTimer = setTimeout(() => {
      setIsDeveloped(true);
    }, 120);

    return () => {
      clearTimeout(devTimer);
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, [photoBlob]);

  const handleKeep = async () => {
    if (isKeepingRef.current) return;
    isKeepingRef.current = true;
    setIsKeeping(true);
    setErrorMsg(null);
    triggerHaptic([40, 60]);

    try {
      await onKeep();
    } catch (e) {
      console.error("Keep photo failed:", e);
      isKeepingRef.current = false;
      setIsKeeping(false);
      setErrorMsg(t(lang, "keepFailed"));
      triggerHaptic([100, 50, 100]);
    }
  };

  const handleRetake = () => {
    if (isKeepingRef.current) return;
    triggerHaptic([25]);
    onRetake();
  };

  // Derive frame aspect CSS class & ratio label
  const aspectClass =
    aspect === "1:1"
      ? "aspect-square max-h-[64vh]"
      : aspect === "16:9"
      ? "aspect-[9/16] max-h-[76vh]"
      : "aspect-[3/4] max-h-[72vh]";

  // Clean frame number badge (e.g. "EXP 08/15" or "FRAME 08")
  const currentFrame = shotsLeft !== undefined ? totalShots - shotsLeft + 1 : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Capture Review"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] select-none animate-in fade-in duration-200"
    >
      {/* Top Header: Authentic Film Header with Stock & Ratio */}
      <div className="w-full max-w-md flex items-center justify-between px-1 h-9 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-zinc-300">
            {lookName}
          </span>
          <span className="font-mono text-[10px] text-zinc-500 font-semibold px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700/60">
            {aspect}
          </span>
        </div>
        {currentFrame !== undefined && (
          <span className="font-mono text-[11px] font-medium tracking-widest text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
            FRAME {String(currentFrame).padStart(2, "0")} / {totalShots}
          </span>
        )}
      </div>

      {/* Main Print Stage (Hero the photo with authentic physical print aesthetics) */}
      <div className="relative w-full max-w-md flex-1 min-h-0 flex items-center justify-center my-auto py-2">
        <div
          className={`relative w-full ${aspectClass} rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/10 bg-zinc-950 flex items-center justify-center transition-transform duration-300`}
        >
          {/* Developed Photo */}
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Developed shot"
              className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                isDeveloped
                  ? "filter brightness-100 contrast-100 opacity-100 scale-100"
                  : "filter brightness-50 contrast-125 opacity-30 scale-[1.02] blur-xs"
              }`}
            />
          )}

          {/* Developing chemical emulsion fog effect */}
          <div
            className={`absolute inset-0 bg-amber-950/30 mix-blend-color pointer-events-none transition-opacity duration-700 ${
              isDeveloped ? "opacity-0" : "opacity-100"
            }`}
          />

          {/* Fine photographic gloss highlight reflection */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.07] pointer-events-none" />

          {/* Subtle inner bezel vignette line */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15 pointer-events-none" />
        </div>
      </div>

      {/* Bottom Action Area with Status & Ergonomic Buttons */}
      <div className="w-full max-w-md flex flex-col gap-2 shrink-0">
        {/* Error notification if saving failed */}
        {errorMsg && (
          <div className="w-full py-2 px-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs text-center font-medium animate-in fade-in duration-150">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons: Ergonomic Retake & Keep */}
        <div className="w-full flex items-center gap-3">
          {/* Retake Button (Discards photo, does not consume frame) */}
          <button
            type="button"
            onClick={handleRetake}
            disabled={isKeeping}
            className="flex-1 h-13 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/90 active:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40 touch-manipulation cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4.5 h-4.5 text-zinc-400"
            >
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.75a.75.75 0 0 0-.75.75v4.482a.75.75 0 0 0 1.5 0v-2.073l.235.234a7 7 0 0 0 11.956-3.136.75.75 0 0 0-1.379-.412ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466l.312.311H11.77a.75.75 0 0 0 0 1.5h4.48a.75.75 0 0 0 .75-.75V2.689a.75.75 0 0 0-1.5 0v2.073l-.235-.234A7 7 0 0 0 3.309 7.664a.75.75 0 0 0 1.379.412Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{t(lang, "retake")}</span>
          </button>

          {/* Keep Button (Enqueues photo & advances roll counter) */}
          <button
            type="button"
            onClick={handleKeep}
            disabled={isKeeping}
            className="flex-1 h-13 rounded-2xl bg-amber-400 hover:bg-amber-300 active:bg-amber-400 text-black font-bold text-sm shadow-xl shadow-amber-400/20 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation cursor-pointer flex items-center justify-center gap-2"
          >
            {isKeeping ? (
              <>
                <div className="w-4.5 h-4.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                <span className="font-mono text-xs uppercase tracking-wider">{t(lang, "processing")}</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-black"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t(lang, "keep")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
