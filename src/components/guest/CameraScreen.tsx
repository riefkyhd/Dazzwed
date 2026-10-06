"use client";

import React, { useState } from "react";
import { type Lang, t } from "@/lib/i18n";
import { useCamera } from "@/lib/camera/useCamera";
import { triggerHaptic } from "@/lib/camera/haptics";
import { ShutterButton } from "./ShutterButton";
import { ShotCounter } from "./ShotCounter";
import { LensBar } from "./LensBar";
import { AdvancedDrawer } from "./AdvancedDrawer";
import { ZoomControl } from "./ZoomControl";
import { TorchToggle } from "./TorchToggle";
import { SyncBadge } from "./SyncBadge";
import { NativeCameraInput } from "./NativeCameraInput";
import { CameraErrorView } from "./CameraErrorView";
import { ReviewModal } from "./ReviewModal";
import { FilmThumbwheel } from "./FilmThumbwheel";

interface CameraScreenProps {
  eventSlug: string;
  coupleNames: string;
  shotsLeft: number;
  pendingCount: number;
  lang: Lang;
  onShotCaptured: (blob: Blob) => Promise<void>;
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
  } = useCamera(true);

  const [isShutterActive, setIsShutterActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewBlob, setReviewBlob] = useState<Blob | null>(null);
  const [isAdvancingFilm, setIsAdvancingFilm] = useState(false);

  const handleShoot = async () => {
    if (shotsLeft <= 0 || isProcessing || !live) return;

    // Trigger haptic feedback immediately
    triggerHaptic([35]);

    // Visual shutter animation: screen flash
    setIsShutterActive(true);
    setTimeout(() => setIsShutterActive(false), 180);

    try {
      setIsProcessing(true);
      const blob = await capture();
      // Freeze frame and open retro Review Modal (no shot consumed yet)
      setReviewBlob(blob);
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeepPhoto = async () => {
    if (!reviewBlob) return;
    setIsAdvancingFilm(true);
    const blobToSave = reviewBlob;
    setReviewBlob(null);
    // Consumes 1 shot server-side & client-side only upon Keep!
    await onShotCaptured(blobToSave);
  };

  const handleRetakePhoto = () => {
    // Discard captured frame without consuming any shot
    setReviewBlob(null);
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

  return (
    <div className="relative w-full h-dvh bg-black flex flex-col justify-between overflow-hidden select-none touch-manipulation">
      {/* Mechanical shutter blink animation overlay */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-150 bg-black ${
          isShutterActive ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Camera Viewfinder */}
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 overflow-hidden">
        {/* Hidden video element feeding the WebGL canvas */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="hidden"
        />

        {/* Live Filtered WebGL Canvas Viewfinder */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover pointer-events-none transition-transform duration-300 ${
            facing === "user" ? "-scale-x-100" : ""
          }`}
        />

        {/* Vintage camera frame watermark / corners */}
        <div className="absolute inset-4 pointer-events-none border border-white/10 rounded-2xl">
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
          <FilmThumbwheel
            advancing={isAdvancingFilm}
            onAdvanceComplete={() => setIsAdvancingFilm(false)}
          />
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
      <footer className="relative z-20 flex flex-col items-center pb-6 px-4 gap-3">
        {/* Advanced Drawer */}
        <AdvancedDrawer
          torchAvailable={torchAvailable}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
          lang={lang}
        />

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
        <div className="flex items-center justify-between w-full max-w-sm px-2">
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
              className="p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all active:scale-90 touch-manipulation shadow-md"
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
      {reviewBlob && (
        <ReviewModal
          photoBlob={reviewBlob}
          lang={lang}
          onKeep={handleKeepPhoto}
          onRetake={handleRetakePhoto}
        />
      )}
    </div>
  );
}
