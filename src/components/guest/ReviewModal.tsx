"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { type Lang, t } from "@/lib/i18n";
import { triggerHaptic } from "@/lib/camera/haptics";
import type { CameraAspect } from "@/lib/imaging/geometry";
import { diagnostics } from "@/lib/camera/diagnostics";

interface ReviewModalProps {
  photoBlob?: Blob | null;
  previewBitmap?: ImageBitmap | null;
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
  previewBitmap,
  aspect = "3:4",
  lookName = "35mm Film",
  shotsLeft,
  totalShots = 15,
  lang,
  onKeep,
  onRetake,
}: ReviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string>("");
  const [isDeveloped, setIsDeveloped] = useState(false);
  const [isKeeping, setIsKeeping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isKeepingRef = useRef(false);
  const activeUrlRef = useRef<string | null>(null);
  const photoBlobRef = useRef<Blob | null>(photoBlob ?? null);
  const previewBitmapRef = useRef<ImageBitmap | null>(previewBitmap ?? null);

  const blobUrl = useMemo(() => {
    if (photoBlob && photoBlob.size > 0) {
      return URL.createObjectURL(photoBlob);
    }
    return "";
  }, [photoBlob]);

  const photoUrl = fallbackUrl || blobUrl;

  // Keep refs synchronized
  useEffect(() => {
    photoBlobRef.current = photoBlob ?? null;
  }, [photoBlob]);

  useEffect(() => {
    previewBitmapRef.current = previewBitmap ?? null;
  }, [previewBitmap]);

  // Redraw canvas helper with safe error boundary
  const redrawCanvas = useCallback(() => {
    const bmp = previewBitmapRef.current;
    const c = canvasRef.current;
    if (bmp && c) {
      try {
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
        }
        requestAnimationFrame(() => {
          diagnostics.recordMark("t4");
        });
      } catch (err) {
        console.warn("[ReviewModal] Canvas drawImage failed:", err);
      }
    }
  }, []);

  // Safe image recovery if blob URL expires or fails to load across sleep/wake
  const handleImageError = useCallback(() => {
    const blob = photoBlobRef.current;
    if (blob && blob.size > 0) {
      try {
        const freshUrl = URL.createObjectURL(blob);
        if (activeUrlRef.current && activeUrlRef.current !== freshUrl) {
          URL.revokeObjectURL(activeUrlRef.current);
        }
        activeUrlRef.current = freshUrl;
        setFallbackUrl(freshUrl);
      } catch {
        // Ultimate fallback: Convert blob to data URL (resilient across OS process backgrounding)
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setFallbackUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      }
    }
  }, []);

  // Synchronize activeUrlRef and revoke old blobUrl when replaced
  useEffect(() => {
    activeUrlRef.current = fallbackUrl || blobUrl || null;
    return () => {
      if (blobUrl) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(blobUrl);
          } catch {
            /* ignore */
          }
        }, 100);
      }
    };
  }, [blobUrl, fallbackUrl]);

  // Initial canvas paint for fast previewBitmap
  useEffect(() => {
    if (previewBitmap) {
      redrawCanvas();
    }
  }, [previewBitmap, redrawCanvas]);

  // Lifecycle resilience: Redraw canvas or verify photo on visibilitychange / focus (sleep/lock recovery)
  useEffect(() => {
    const handleVisibilityOrResume = () => {
      if (document.visibilityState === "visible") {
        if (!photoBlobRef.current && previewBitmapRef.current) {
          redrawCanvas();
        } else if (photoBlobRef.current) {
          // If the image tag is broken or failed to render while asleep, recover immediately
          if (imgRef.current && (!imgRef.current.complete || imgRef.current.naturalWidth === 0)) {
            handleImageError();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrResume);
    window.addEventListener("focus", handleVisibilityOrResume);
    window.addEventListener("pageshow", handleVisibilityOrResume);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrResume);
      window.removeEventListener("focus", handleVisibilityOrResume);
      window.removeEventListener("pageshow", handleVisibilityOrResume);
    };
  }, [redrawCanvas, handleImageError]);

  // Chemical development simulation: gentle analog bloom/fog reveal
  useEffect(() => {
    const devTimer = setTimeout(() => {
      setIsDeveloped(true);
    }, 60);

    return () => {
      clearTimeout(devTimer);
    };
  }, []);

  // Cleanup object URLs strictly on component unmount
  useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        try {
          URL.revokeObjectURL(activeUrlRef.current);
        } catch {
          /* ignore */
        }
        activeUrlRef.current = null;
      }
    };
  }, []);

  const handleKeep = async () => {
    if (isKeepingRef.current) return;
    isKeepingRef.current = true;
    setIsKeeping(true);
    setErrorMsg(null);
    triggerHaptic([40, 60]);
    diagnostics.recordMark("t6");

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
          {/* Developed Photo (High-res photoBlob takes precedence, with fast preview canvas fallback) */}
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              data-testid="review-image"
              src={photoUrl}
              alt="Developed shot"
              onError={handleImageError}
              onLoad={() => diagnostics.recordMark("t4")}
              className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                isDeveloped
                  ? "filter brightness-100 contrast-100 opacity-100 scale-100"
                  : "filter brightness-50 contrast-125 opacity-30 scale-[1.02] blur-xs"
              }`}
            />
          ) : previewBitmap ? (
            <canvas
              ref={canvasRef}
              data-testid="review-image"
              aria-label="Developed shot"
              className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                isDeveloped
                  ? "filter brightness-100 contrast-100 opacity-100 scale-100"
                  : "filter brightness-50 contrast-125 opacity-30 scale-[1.02] blur-xs"
              }`}
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <span className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            </div>
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
            data-testid="retake-button"
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
            data-testid="keep-button"
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
