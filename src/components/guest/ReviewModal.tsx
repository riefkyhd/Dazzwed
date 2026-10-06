"use client";

import React, { useEffect, useState, useMemo } from "react";
import { type Lang, t } from "@/lib/i18n";
import { triggerHaptic } from "@/lib/camera/haptics";

interface ReviewModalProps {
  photoBlob: Blob;
  eventDate?: string;
  lang: Lang;
  onKeep: () => Promise<void>;
  onRetake: () => void;
}

export function ReviewModal({
  photoBlob,
  eventDate,
  lang,
  onKeep,
  onRetake,
}: ReviewModalProps) {
  const photoUrl = useMemo(() => URL.createObjectURL(photoBlob), [photoBlob]);
  const [isDeveloped, setIsDeveloped] = useState(false);
  const [isKeeping, setIsKeeping] = useState(false);

  useEffect(() => {
    // Film developing effect: starts dark/foggy, develops into crisp warm print over 1 second
    const timer = setTimeout(() => {
      setIsDeveloped(true);
    }, 150);

    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const handleKeep = async () => {
    if (isKeeping) return;
    setIsKeeping(true);
    triggerHaptic([40, 60]); // tactile click
    try {
      await onKeep();
    } catch (e) {
      console.error("Keep photo failed:", e);
      setIsKeeping(false);
    }
  };

  const handleRetake = () => {
    if (isKeeping) return;
    triggerHaptic([25]);
    onRetake();
  };

  // Format date stamp like classic 90s camera: '26 10 06 (YY MM DD)
  const formattedDateStamp = (() => {
    const d = eventDate ? new Date(eventDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `'${yy} ${mm} ${dd}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-lg p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="w-full flex items-center justify-between max-w-sm pt-2">
        <span className="font-mono text-xs tracking-widest uppercase text-zinc-400">
          Print Preview
        </span>
        <span className="font-mono text-xs text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
          DISPOSABLE CAM
        </span>
      </div>

      {/* Retro Print Frame Card (Flexible height scaled to remaining viewport) */}
      <div className="relative w-full max-w-xs flex-1 min-h-0 max-h-[68vh] my-auto bg-zinc-900 border-2 border-zinc-700/80 rounded-2xl shadow-2xl p-2.5 flex flex-col justify-between overflow-hidden">
        {/* Subtle light-leak along edge */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* The Photo Itself */}
        <div className="relative w-full flex-1 min-h-0 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Developed shot"
              className={`w-full h-full object-contain transition-all duration-1000 ease-out ${
                isDeveloped
                  ? "filter brightness-100 contrast-100 opacity-100"
                  : "filter brightness-50 contrast-150 opacity-40 blur-xs"
              }`}
            />
          )}

          {/* Developing chemical Fog overlay */}
          <div
            className={`absolute inset-0 bg-amber-950/40 mix-blend-color pointer-events-none transition-opacity duration-1000 ${
              isDeveloped ? "opacity-0" : "opacity-90"
            }`}
          />

          {/* 90s Orange Digital Date Stamp */}
          <div className="absolute bottom-3 right-3 pointer-events-none font-mono text-xs tracking-widest text-[#ff7700] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-bold opacity-90">
            {formattedDateStamp}
          </div>
        </div>

        {/* Bottom Film Card Margin */}
        <div className="w-full flex items-center justify-between px-1 pt-1.5 text-[10px] font-mono text-zinc-500">
          <span>KODAK FILM EMULSION</span>
          <span>EXP. 24</span>
        </div>
      </div>

      {/* Keep vs Retake Action Buttons (Fixed height, safe area padding) */}
      <div className="w-full max-w-sm flex items-center gap-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] shrink-0">
        {/* Retake Button (Discards, 0 shots used) */}
        <button
          type="button"
          onClick={handleRetake}
          disabled={isKeeping}
          className="flex-1 py-3.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 touch-manipulation cursor-pointer flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-zinc-400">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.75a.75.75 0 0 0-.75.75v4.482a.75.75 0 0 0 1.5 0v-2.073l.235.234a7 7 0 0 0 11.956-3.136.75.75 0 0 0-1.379-.412ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466l.312.311H11.77a.75.75 0 0 0 0 1.5h4.48a.75.75 0 0 0 .75-.75V2.689a.75.75 0 0 0-1.5 0v2.073l-.235-.234A7 7 0 0 0 3.309 7.664a.75.75 0 0 0 1.379.412Z" clipRule="evenodd" />
          </svg>
          <span>{t(lang, "retake")}</span>
        </button>

        {/* Keep Button (Enqueues upload & consumes shot) */}
        <button
          type="button"
          onClick={handleKeep}
          disabled={isKeeping}
          className="flex-1 py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm shadow-lg shadow-amber-400/20 active:scale-95 transition-all disabled:opacity-50 touch-manipulation cursor-pointer flex items-center justify-center gap-2"
        >
          {isKeeping ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
              <span>Advancing…</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              <span>{t(lang, "keep")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
