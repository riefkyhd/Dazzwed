"use client";

import React, { useMemo } from "react";
import { type Lang, t } from "@/lib/i18n";
import type { CameraErrorKind } from "@/lib/camera/constraints";
import { isInAppBrowser } from "@/lib/camera/caps";
import { NativeCameraInput } from "./NativeCameraInput";

interface CameraErrorViewProps {
  error: CameraErrorKind;
  eventSlug: string;
  lang: Lang;
  onRetry: () => void;
  onNativePhoto: (file: File, quickThumb?: string) => void;
}

export function CameraErrorView({
  error,
  eventSlug,
  lang,
  onRetry,
  onNativePhoto,
}: CameraErrorViewProps) {
  const inApp = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return isInAppBrowser(navigator.userAgent);
  }, []);

  let title = t(lang, "errGeneric");
  let body = t(lang, "errGeneric");

  if (error === "denied") {
    title = t(lang, "errDeniedTitle");
    body = t(lang, "errDeniedBody");
  } else if (error === "unsupported") {
    title = t(lang, "errGeneric");
    body = t(lang, "errUnsupportedBody");
  } else if (error === "insecure") {
    body = t(lang, "errInsecure");
  }

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto px-6 py-12 justify-center items-center text-center">
      <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-800/60 text-red-400 flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-8 h-8"
        >
          <path
            fillRule="evenodd"
            d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <h2 className="font-serif text-2xl text-zinc-200 mb-2">{title}</h2>
      <p className="text-sm text-zinc-400 max-w-xs leading-relaxed mb-6">
        {body}
      </p>

      {inApp && (
        <div className="p-3 mb-6 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 max-w-xs">
          {t(lang, "errInAppHint")}
        </div>
      )}

      <div className="w-full space-y-3">
        <NativeCameraInput
          eventSlug={eventSlug}
          onFileSelected={onNativePhoto}
          lang={lang}
          variant="button"
        />

        <button
          type="button"
          onClick={onRetry}
          className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-sm font-semibold transition-all active:scale-[0.99]"
        >
          {t(lang, "retry")}
        </button>
      </div>
    </div>
  );
}
