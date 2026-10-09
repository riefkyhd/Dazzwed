"use client";

import React, { useMemo } from "react";
import { type Lang, t } from "@/lib/i18n";
import type { CameraErrorKind } from "@/lib/camera/constraints";
import { NativeCameraInput } from "./NativeCameraInput";

interface CameraRecoveryOverlayProps {
  error: CameraErrorKind | null;
  eventSlug: string;
  lang: Lang;
  onRetry: () => void;
  onNativePhoto: (file: File, quickThumb?: string) => void;
}

export function CameraRecoveryOverlay({
  error,
  eventSlug,
  lang,
  onRetry,
  onNativePhoto,
}: CameraRecoveryOverlayProps) {
  const isIos = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md transition-opacity duration-200 animate-in fade-in"
    >
      <div className="w-full max-w-xs flex flex-col items-center gap-4">
        {/* Prompt Recovery (One-tap User Gesture) */}
        {error === "prompt" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
                <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.112-.71l.82-1.317c.502-.805 1.365-1.338 2.333-1.39Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg text-white font-semibold">Enable Camera Access</h3>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Tap below to activate the camera in this tab.
              </p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="w-full py-3.5 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-bold text-sm shadow-xl active:scale-95 transition-all cursor-pointer"
            >
              Tap to Enable Camera
            </button>
          </>
        )}

        {/* Denied Recovery Ladder (Browser-Specific Steps) */}
        {error === "denied" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-base text-zinc-200 font-semibold">{t(lang, "errDeniedTitle")}</h3>
              <div className="mt-2 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left text-[11.5px] text-zinc-300 space-y-1.5 leading-relaxed">
                {isIos ? (
                  <>
                    <p className="font-semibold text-amber-300">iOS Safari:</p>
                    <p>1. Tap the <b className="text-white">aA</b> icon left of the address bar</p>
                    <p>2. Choose <b className="text-white">Website Settings</b> &rarr; <b className="text-white">Camera</b> &rarr; <b className="text-emerald-400">Allow</b></p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-amber-300">Chrome Android:</p>
                    <p>1. Tap the lock/tune icon <b className="text-white">🔒</b> left of the URL</p>
                    <p>2. Tap <b className="text-white">Permissions</b> &rarr; <b className="text-white">Camera</b> &rarr; <b className="text-emerald-400">Allow</b></p>
                  </>
                )}
              </div>
            </div>

            <div className="w-full space-y-2 mt-1">
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                I&apos;ve enabled it, retry
              </button>

              <NativeCameraInput
                eventSlug={eventSlug}
                onFileSelected={onNativePhoto}
                lang={lang}
                variant="button"
              />

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2 px-3 text-[11px] text-zinc-400 hover:text-zinc-200 font-mono transition-colors"
              >
                Reload camera
              </button>
            </div>
          </>
        )}

        {/* In-Use (Another camera app holding the hardware) */}
        {error === "in-use" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-base text-zinc-200 font-semibold">Camera is Busy</h3>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Another app may be using the camera. Please switch back from other camera apps and retry.
              </p>
            </div>
            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold active:scale-95 cursor-pointer"
              >
                {t(lang, "retry")}
              </button>
              <NativeCameraInput
                eventSlug={eventSlug}
                onFileSelected={onNativePhoto}
                lang={lang}
                variant="button"
              />
            </div>
          </>
        )}

        {/* Not Found or Unsupported */}
        {(error === "not-found" || error === "unsupported" || error === "unknown") && (
          <>
            <div>
              <h3 className="font-serif text-base text-zinc-200 font-semibold">{t(lang, "errGeneric")}</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Camera feed could not be started directly in this browser.
              </p>
            </div>
            <div className="w-full space-y-2">
              <NativeCameraInput
                eventSlug={eventSlug}
                onFileSelected={onNativePhoto}
                lang={lang}
                variant="button"
              />
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-medium"
              >
                {t(lang, "retry")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
