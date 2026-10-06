"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { type Lang, t } from "@/lib/i18n";
import { useCamera } from "@/lib/camera/useCamera";
import { useViewportLayout } from "@/lib/camera/useViewportLayout";
import { triggerHaptic } from "@/lib/camera/haptics";
import type { CameraAspect } from "@/lib/imaging/geometry";
import { CameraTopBar } from "./CameraTopBar";
import { ViewfinderGestures } from "./ViewfinderGestures";
import { CameraSettingsSheet } from "./CameraSettingsSheet";
import { ShutterButton } from "./ShutterButton";
import { ShotCounter } from "./ShotCounter";
import { LensBar } from "./LensBar";
import { ZoomControl } from "./ZoomControl";
import { SyncBadge } from "./SyncBadge";
import { NativeCameraInput } from "./NativeCameraInput";
import { CameraErrorView } from "./CameraErrorView";
import { ReviewModal } from "./ReviewModal";
import { LookDial } from "./LookDial";

interface CameraScreenProps {
  eventSlug: string;
  coupleNames: string;
  shotsLeft: number;
  pendingCount: number;
  lang: Lang;
  onShotCaptured: (filteredBlob: Blob, originalBlob?: Blob) => Promise<void>;
  onNativePhoto: (file: File, quickThumb?: string) => void;
  allowedLookIds?: string[];
}

export function CameraScreen({
  eventSlug,
  coupleNames,
  shotsLeft,
  pendingCount,
  lang,
  onShotCaptured,
  onNativePhoto,
  allowedLookIds,
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
    activeLook,
    setActiveLook,
    exposureCompSupported,
    exposureCompValue,
    setExposureCompensation,
  } = useCamera(true);

  // Responsive Layout Engine
  const layout = useViewportLayout(cameraAspect);

  // Shutter & capture state
  const [isShutterActive, setIsShutterActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewBlobs, setReviewBlobs] = useState<{ filteredBlob: Blob; originalBlob?: Blob } | null>(null);

  // Timer state (0s, 3s, 10s)
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerCountdown, setTimerCountdown] = useState<number>(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Camera Settings & Tools
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [mirrorFront, setMirrorFront] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aeAfLocked, setAeAfLocked] = useState(false);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Web Audio click / mechanical shutter sound synthesizer
  const playShutterSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // AudioContext might be blocked before first user gesture
    }
  }, [soundEnabled]);

  // Actual capture execution
  const executeCapture = useCallback(async () => {
    if (shotsLeft <= 0 || isProcessing || !live) return;

    triggerHaptic([40]);
    playShutterSound();
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
  }, [shotsLeft, isProcessing, live, playShutterSound, capture, cameraAspect]);

  // Shutter button trigger with timer countdown
  const handleShoot = () => {
    if (shotsLeft <= 0 || isProcessing || !live) return;

    if (timerCountdown > 0) {
      // Cancel active countdown
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      setTimerCountdown(0);
      return;
    }

    if (timerSeconds === 0) {
      void executeCapture();
      return;
    }

    // Start countdown
    triggerHaptic([20]);
    setTimerCountdown(timerSeconds);
    let remaining = timerSeconds;

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setTimerCountdown(remaining);
      if (remaining > 0) {
        triggerHaptic([15]);
      } else {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        void executeCapture();
      }
    }, 1000);
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

  // Viewfinder gestures & exposure
  const handleExposureChange = (deltaEV: number) => {
    if (exposureCompSupported) {
      void setExposureCompensation(deltaEV);
    }
  };

  const handleResetZoom = () => {
    triggerHaptic([20]);
    if (zoomRange) setZoom(1);
    setDigitalZoom(1);
  };

  const currentDisplayZoom = zoomRange ? zoom : digitalZoom;

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

  const { isLandscape, mode, viewfinderRect } = layout;

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden select-none touch-manipulation flex flex-col justify-between">
      {/* Mechanical shutter blink animation overlay */}
      <div
        className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-150 bg-black ${
          isShutterActive ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Hidden video element feeding WebGL canvas */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
      />

      {/* Central Viewfinder Container anchored to calculated geometry */}
      <div
        style={{
          position: "absolute",
          top: `${viewfinderRect.top}px`,
          left: `${viewfinderRect.left}px`,
          width: `${viewfinderRect.width}px`,
          height: `${viewfinderRect.height}px`,
        }}
        className="overflow-hidden bg-black flex items-center justify-center rounded-sm shadow-2xl transition-[width,height,top,left] duration-250 ease-out z-0"
      >
        {/* WebGL Canvas */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover pointer-events-none transition-transform duration-300 ${
            facing === "user" && mirrorFront ? "-scale-x-100" : ""
          }`}
        />

        {/* Viewfinder Gestures & Overlays (Focus Ring, Grid, Level, Exposure) */}
        <ViewfinderGestures
          showGrid={showGrid}
          showLevel={showLevel}
          zoom={currentDisplayZoom}
          onResetZoom={handleResetZoom}
          onExposureChange={handleExposureChange}
          exposureCompensation={exposureCompValue}
          aeAfLocked={aeAfLocked}
          onToggleAeAfLock={() => setAeAfLocked((v) => !v)}
        />

        {/* Subtle retro camera frame watermark (only shown in banded mode so full-bleed stays clean) */}
        {mode === "banded" && (
          <div className="absolute inset-2 pointer-events-none border border-white/10 rounded-xl">
            <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-amber-400/50" />
            <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-amber-400/50" />
            <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-amber-400/50" />
            <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-amber-400/50" />
          </div>
        )}

        {/* Starting / Restarting Spinner */}
        {(starting || restarting) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-3" />
            <p className="text-xs font-mono text-zinc-300 uppercase tracking-widest">
              {restarting ? t(lang, "restarting") : coupleNames}
            </p>
          </div>
        )}
      </div>

      {/* PORTRAIT LAYOUT */}
      {!isLandscape && (
        <>
          {/* Top Bar Zone */}
          <header
            style={{
              paddingTop: "max(env(safe-area-inset-top), 8px)",
              minHeight: `${layout.topBarHeight}px`,
            }}
            className={`relative z-20 flex flex-col justify-center w-full transition-colors ${
              mode === "banded" ? "bg-black" : "bg-gradient-to-b from-black/80 via-black/40 to-transparent"
            }`}
          >
            {/* Top Bar Controls */}
            <CameraTopBar
              torchAvailable={torchAvailable}
              torchOn={torchOn}
              onToggleTorch={toggleTorch}
              aspect={cameraAspect}
              onChangeAspect={setCameraAspect}
              timerSeconds={timerSeconds}
              onChangeTimer={setTimerSeconds}
              onOpenSettings={() => setSettingsOpen(true)}
              lang={lang}
            />

            {/* Sync & Developing Pill */}
            <div className="flex items-center justify-between px-4 mt-0.5 text-xs">
              <ShotCounter shotsLeft={shotsLeft} lang={lang} />
              {isProcessing ? (
                <div className="px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/60 text-amber-200 font-mono text-[11px] flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  {t(lang, "processing")}
                </div>
              ) : (
                <SyncBadge pendingCount={pendingCount} lang={lang} />
              )}
            </div>
          </header>

          {/* Bottom Bar Zone */}
          <footer
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
              minHeight: `${layout.bottomBarHeight}px`,
            }}
            className={`relative z-20 flex flex-col items-center justify-end w-full px-4 gap-2 transition-colors ${
              mode === "banded" ? "bg-black" : "bg-gradient-to-t from-black/90 via-black/50 to-transparent"
            }`}
          >
            {/* Look Dial Switcher */}
            <div className="w-full flex justify-center">
              <LookDial
                activeLook={activeLook}
                onSelectLook={setActiveLook}
                allowedLookIds={allowedLookIds}
              />
            </div>

            {/* Lens Bar and Zoom Controls */}
            <div className="flex items-center justify-center gap-2 w-full min-h-[36px]">
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

            {/* Shutter Row with Native Camera and Flip Camera */}
            <div className="flex items-center justify-between w-full max-w-sm px-4 pt-1">
              {/* Native OS Camera Fallback */}
              <div className="w-14 flex justify-start">
                <NativeCameraInput
                  eventSlug={eventSlug}
                  onFileSelected={onNativePhoto}
                  lang={lang}
                  variant="secondary"
                />
              </div>

              {/* Shutter Button with Timer Countdown Ring */}
              <ShutterButton
                onShoot={handleShoot}
                disabled={shotsLeft <= 0 || !live}
                isProcessing={isProcessing}
                timerCountdown={timerCountdown}
                timerTotal={timerSeconds}
              />

              {/* Flip Camera Button */}
              <div className="w-14 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic([20]);
                    flip();
                  }}
                  aria-label={t(lang, "flip")}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all active:scale-90 touch-manipulation shadow-md cursor-pointer"
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
        </>
      )}

      {/* LANDSCAPE LAYOUT (Side Rail on Right) */}
      {isLandscape && (
        <div className="absolute inset-0 z-20 flex justify-between pointer-events-none">
          {/* Top Left info overlay */}
          <div className="p-4 flex items-center gap-3 pointer-events-auto">
            <ShotCounter shotsLeft={shotsLeft} lang={lang} />
            <SyncBadge pendingCount={pendingCount} lang={lang} />
          </div>

          {/* Right-hand side control rail */}
          <div
            style={{
              paddingRight: "max(env(safe-area-inset-right), 12px)",
              width: `${layout.bottomBarHeight}px`,
            }}
            className="h-full bg-black flex flex-col items-center justify-between py-6 px-2 pointer-events-auto border-l border-zinc-900"
          >
            {/* Top controls in rail */}
            <div className="flex flex-col items-center gap-3">
              <CameraTopBar
                torchAvailable={torchAvailable}
                torchOn={torchOn}
                onToggleTorch={toggleTorch}
                aspect={cameraAspect}
                onChangeAspect={setCameraAspect}
                timerSeconds={timerSeconds}
                onChangeTimer={setTimerSeconds}
                onOpenSettings={() => setSettingsOpen(true)}
                lang={lang}
              />
            </div>

            {/* Shutter in center of rail */}
            <div className="my-auto">
              <ShutterButton
                onShoot={handleShoot}
                disabled={shotsLeft <= 0 || !live}
                isProcessing={isProcessing}
                timerCountdown={timerCountdown}
                timerTotal={timerSeconds}
              />
            </div>

            {/* Bottom controls in rail */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic([20]);
                  flip();
                }}
                aria-label={t(lang, "flip")}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 active:scale-90 shadow-md cursor-pointer"
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
        </div>
      )}

      {/* Camera Settings / Tools Sheet */}
      <CameraSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showLevel={showLevel}
        onToggleLevel={() => setShowLevel((v) => !v)}
        mirrorFront={mirrorFront}
        onToggleMirrorFront={() => setMirrorFront((v) => !v)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        lang={lang}
      />

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
