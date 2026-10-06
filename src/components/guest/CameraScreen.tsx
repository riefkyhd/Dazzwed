"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { type Lang, t } from "@/lib/i18n";
import { useCamera } from "@/lib/camera/useCamera";
import { triggerHaptic } from "@/lib/camera/haptics";
import type { CameraAspect } from "@/lib/imaging/geometry";
import { ShutterButton } from "./ShutterButton";
import { ShotCounter } from "./ShotCounter";
import { LensBar } from "./LensBar";
import { ZoomControl } from "./ZoomControl";
import { TorchToggle } from "./TorchToggle";
import { SyncBadge } from "./SyncBadge";
import { NativeCameraInput } from "./NativeCameraInput";
import { CameraErrorView } from "./CameraErrorView";
import { ReviewModal } from "./ReviewModal";

interface CameraScreenProps {
  eventSlug: string;
  coupleNames: string;
  shotsLeft: number;
  pendingCount: number;
  lang: Lang;
  onShotCaptured: (filteredBlob: Blob, originalBlob?: Blob) => Promise<void>;
  onNativePhoto: (file: File, quickThumb?: string) => void;
}

export function CameraScreen({
  eventSlug,
  coupleNames,
  shotsLeft,
  pendingCount,
  lang,
  onShotCaptured,
  onNativePhoto,
}: CameraScreenProps) {
  const {
    videoRef,
    canvasRef,
    live,
    error,
    starting,
    restarting,
    facing,
    flip,
    lenses,
    activeId,
    chooseLens,
    zoomRange,
    zoom,
    setZoom,
    digitalZoom,
    setDigitalZoom,
    torchAvailable,
    torchOn,
    toggleTorch,
    capture,
    retry,
    cameraAspect,
    setCameraAspect,
  } = useCamera(true);

  const [isShutterActive, setIsShutterActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewBlobs, setReviewBlobs] = useState<{ filteredBlob: Blob; originalBlob?: Blob } | null>(null);

  // Viewfinder container ref for pinch-to-zoom gestures
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(1);

  // Pinch-to-zoom gesture listener on viewfinder container
  useEffect(() => {
    const el = viewfinderRef.current;
    if (!el) return;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchStartDist.current = getDistance(e.touches);
        pinchStartZoom.current = zoomRange ? zoom : digitalZoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist.current !== null) {
        e.preventDefault();
        const dist = getDistance(e.touches);
        const scale = dist / pinchStartDist.current;
        const targetZoom = pinchStartZoom.current * scale;

        if (zoomRange) {
          const clamped = Math.max(zoomRange.min, Math.min(zoomRange.max, targetZoom));
          setZoom(Math.round(clamped * 10) / 10);
        } else {
          const clamped = Math.max(1, Math.min(4, targetZoom));
          setDigitalZoom(Math.round(clamped * 10) / 10);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDist.current = null;
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [zoomRange, zoom, digitalZoom, setZoom, setDigitalZoom]);

  const handleShoot = async () => {
    if (shotsLeft <= 0 || isProcessing || !live) return;

    triggerHaptic([35]);
    setIsShutterActive(true);
    setTimeout(() => setIsShutterActive(false), 180);

    try {
      setIsProcessing(true);
      const { filteredBlob, originalBlob } = await capture(cameraAspect);
      setReviewBlobs({ filteredBlob, originalBlob });
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeepPhoto = async () => {
    if (!reviewBlobs) return;
    const toSave = reviewBlobs;
    setReviewBlobs(null);
    await onShotCaptured(toSave.filteredBlob, toSave.originalBlob);
  };

  const handleRetakePhoto = () => {
    setReviewBlobs(null);
  };

  if (error) {
    return (
      <CameraErrorView
        error={error}
        eventSlug={eventSlug}
        lang={lang}
        onRetry={retry}
        onNativePhoto={onNativePhoto}
      />
    );
  }

  // Calculate viewfinder frame aspect ratio styling
  const aspectClass =
    cameraAspect === "1:1"
      ? "aspect-square max-h-[72vh] w-full"
      : cameraAspect === "16:9"
        ? "aspect-[9/16] h-full max-w-full"
        : "aspect-[3/4] max-h-[78vh] w-full";

  return (
    <div className="relative w-full h-dvh bg-black flex flex-col justify-between overflow-hidden select-none touch-manipulation">
      {/* Mechanical shutter blink animation overlay */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-150 bg-black ${
          isShutterActive ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Camera Viewfinder with Pinch-to-zoom Listener */}
      <div
        ref={viewfinderRef}
        className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden touch-none"
      >
        {/* Hidden video element feeding the WebGL canvas */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="hidden"
        />

        {/* Framing Box matching chosen aspect ratio */}
        <div className={`relative flex items-center justify-center overflow-hidden transition-all duration-300 ${aspectClass}`}>
          {/* Live Filtered WebGL Canvas Viewfinder */}
          <canvas
            ref={canvasRef}
            className={`w-full h-full object-cover pointer-events-none transition-transform duration-300 ${
              facing === "user" ? "-scale-x-100" : ""
            }`}
          />

          {/* Vintage camera frame watermark / corners */}
          <div className="absolute inset-3 pointer-events-none border border-white/10 rounded-2xl">
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-accent/60" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-accent/60" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-accent/60" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-accent/60" />
          </div>

          {/* Center crosshair */}
          <div className="absolute pointer-events-none opacity-25 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border border-white/60" />
            <div className="absolute w-12 h-px bg-white/60" />
            <div className="absolute h-12 w-px bg-white/60" />
          </div>
        </div>

        {/* Starting / Restarting Spinner */}
        {(starting || restarting) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mb-3" />
            <p className="text-xs font-mono text-zinc-300 uppercase tracking-widest">
              {restarting ? t(lang, "restarting") : coupleNames}
            </p>
          </div>
        )}
      </div>

      {/* Top Controls Overlay */}
      <header className="relative z-20 flex items-center justify-between p-4 pt-3">
        <ShotCounter shotsLeft={shotsLeft} lang={lang} />

        <div className="flex items-center gap-2.5">
          <SyncBadge pendingCount={pendingCount} lang={lang} />
          <TorchToggle
            available={torchAvailable}
            on={torchOn}
            onToggle={toggleTorch}
            lang={lang}
          />
        </div>
      </header>

      {/* Developing / Processing Indicator */}
      {isProcessing && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-600/60 text-amber-200 text-xs font-mono tracking-wider flex items-center gap-2 animate-pulse shadow-lg">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          {t(lang, "processing")}
        </div>
      )}

      {/* Bottom Controls Overlay */}
      <footer className="relative z-20 flex flex-col items-center pb-6 px-4 gap-2.5">
        {/* Aspect Ratio Selector: 3:4 (Full Sensor) | 16:9 | 1:1 */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 shadow-md">
          {(["3:4", "16:9", "1:1"] as CameraAspect[]).map((asp) => (
            <button
              key={asp}
              type="button"
              onClick={() => {
                triggerHaptic([20]);
                setCameraAspect(asp);
              }}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all active:scale-95 ${
                cameraAspect === asp
                  ? "bg-amber-400 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {asp === "3:4" ? "3:4 (Full)" : asp}
            </button>
          ))}
        </div>

        {/* Lens Bar and Zoom Controls */}
        <div className="flex items-center justify-center gap-2.5 w-full">
          {facing === "environment" && (
            <LensBar
              lenses={lenses}
              activeId={activeId}
              zoomRange={zoomRange}
              currentZoom={zoom}
              digitalZoom={digitalZoom}
              onSelectLens={chooseLens}
              onSetZoom={setZoom}
              onSetDigitalZoom={setDigitalZoom}
            />
          )}

          {(!zoomRange || lenses.length <= 1) && (
            <ZoomControl
              zoomRange={zoomRange}
              nativeZoom={zoom}
              onNativeZoomChange={setZoom}
              digitalZoom={digitalZoom}
              onDigitalZoomChange={setDigitalZoom}
              lang={lang}
            />
          )}
        </div>

        {/* Shutter row with flip camera and native app trigger */}
        <div className="flex items-center justify-between w-full max-w-sm px-2 mt-1">
          {/* Native OS Camera Fallback */}
          <div className="w-16 flex justify-start">
            <NativeCameraInput
              eventSlug={eventSlug}
              onFileSelected={onNativePhoto}
              lang={lang}
              variant="secondary"
            />
          </div>

          {/* Big Tactile Shutter */}
          <ShutterButton
            onShoot={handleShoot}
            disabled={shotsLeft <= 0 || !live}
            isProcessing={isProcessing}
          />

          {/* Flip Camera Button */}
          <div className="w-16 flex justify-end">
            <button
              type="button"
              onClick={flip}
              aria-label={t(lang, "flip")}
              className="p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all active:scale-90 touch-manipulation shadow-md cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm14.49 3.882a7.5 7.5 0 0 1-12.549 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 14.862-4.004.75.75 0 1 0-1.45-.389Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </footer>

      {/* Retro Review & Print Develop Modal (Keep vs Retake) */}
      {reviewBlobs && (
        <ReviewModal
          photoBlob={reviewBlobs.filteredBlob}
          lang={lang}
          onKeep={handleKeepPhoto}
          onRetake={handleRetakePhoto}
        />
      )}
    </div>
  );
}
