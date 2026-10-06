"use client";

import React, { useEffect } from "react";
import { type Lang, t } from "@/lib/i18n";

export type NativeProcessingState = "developing" | "saving" | "saved" | "error";

interface NativeDevelopingModalProps {
  state: NativeProcessingState;
  thumbnailUrl: string | null;
  progressPercent?: number;
  isOffline?: boolean;
  errorMessage?: string;
  lang: Lang;
  onDismiss?: () => void;
}

export function NativeDevelopingModal({
  state,
  thumbnailUrl,
  progressPercent = 0,
  isOffline = false,
  errorMessage,
  lang,
  onDismiss,
}: NativeDevelopingModalProps) {
  useEffect(() => {
    if (state === "saved") {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [state, onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {/* Retro Polaroid/Print Card Frame */}
        <div className="relative w-52 h-64 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-3 flex flex-col items-center justify-between overflow-hidden">
          {/* Subtle light leak gradient */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Photo area */}
          <div className="relative w-full h-44 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt="Developing thumbnail"
                className={`w-full h-full object-cover transition-all duration-700 ${
                  state === "developing" ? "filter blur-xs brightness-75 contrast-125" : "filter brightness-100"
                }`}
              />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            )}

            {/* Developing overlay ripple */}
            {state === "developing" && (
              <div className="absolute inset-0 bg-amber-950/40 mix-blend-color animate-pulse" />
            )}

            {/* Success Checkmark */}
            {state === "saved" && (
              <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center animate-in zoom-in-75 duration-300">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Card Text / LCD Counter */}
          <div className="w-full flex items-center justify-between px-1">
            <span className="font-mono text-[10px] text-zinc-500 tracking-wider">DISPOSABLE CAM</span>
            <span className="font-mono text-xs text-amber-400 font-bold tracking-widest">
              {state === "developing" ? "DEV..." : state === "saving" ? "SAVE" : state === "saved" ? "DONE" : "ERR"}
            </span>
          </div>
        </div>

        {/* Status text & progress bar */}
        <div className="mt-6 w-full space-y-2">
          <p className="text-sm font-medium text-white tracking-wide">
            {state === "developing" && "Developing your photo…"}
            {state === "saving" && (isOffline ? "Saving to your device…" : "Saving photo…")}
            {state === "saved" && (isOffline ? "Saved on your phone! Will upload when online." : "Photo saved!")}
            {state === "error" && (errorMessage || "Something went wrong.")}
          </p>

          {state === "saving" && (
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-400 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(10, progressPercent)}%` }}
              />
            </div>
          )}

          {isOffline && state !== "error" && (
            <p className="text-xs text-amber-400/90 font-mono">
              Offline mode &bull; Queued for automatic upload
            </p>
          )}

          {state === "error" && (
            <button
              onClick={onDismiss}
              className="mt-3 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 transition-colors"
            >
              {t(lang, "close")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
