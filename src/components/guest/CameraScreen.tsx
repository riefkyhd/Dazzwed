"use client";

import React, { useState, useRef, useEffect, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import { type Lang, t } from "@/lib/i18n";
import { useCamera } from "@/lib/camera/useCamera";
import { useViewportLayout } from "@/lib/camera/useViewportLayout";
import { triggerHaptic } from "@/lib/camera/haptics";
import { diagnostics } from "@/lib/camera/diagnostics";
import { CameraTopBar } from "./CameraTopBar";
import { ViewfinderGestures } from "./ViewfinderGestures";
import { ViewfinderFrame } from "./ViewfinderFrame";
import { CameraSettingsSheet } from "./CameraSettingsSheet";
import { ShutterButton } from "./ShutterButton";
import { LensBar } from "./LensBar";
import { NativeCameraInput } from "./NativeCameraInput";
import { CameraRecoveryOverlay } from "./CameraRecoveryOverlay";
import { CameraDebugHud } from "@/components/debug/CameraDebugHud";
import { ReviewModal } from "./ReviewModal";
import { LookDial } from "./LookDial";
import { GuestGalleryModal } from "./GuestGalleryModal";

interface CameraScreenProps {
  eventSlug: string;
  coupleNames: string;
  shotsLeft: number;
  totalShots?: number;
  pendingCount: number;
  guestId?: string | null;
  rollCode?: string | null;
  lang: Lang;
  onShotCaptured: (filteredBlob: Blob, originalBlob?: Blob) => Promise<void>;
  onNativePhoto: (file: File, quickThumb?: string) => void;
  allowedLookIds?: string[];
  defaultLookId?: string;
}

export function CameraScreen({
  eventSlug,
  coupleNames,
  shotsLeft,
  totalShots = 15,
  pendingCount,
  guestId,
  rollCode,
  lang,
  onShotCaptured,
  onNativePhoto,
  allowedLookIds,
  defaultLookId,
}: CameraScreenProps) {
  const searchParams = useSearchParams();
  const isDebug = searchParams?.get("debug") === "1";
  const [showHud, setShowHud] = useState(isDebug);

  const {
    videoRef,
    canvasRef,
    live,
    stream,
    trackSettings,
    measuredFps,
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
    hasHardwareFlash,
    torchOn,
    toggleTorch,
    flashMode,
    setFlashMode,
    capture,
    retry,
    cameraAspect,
    setCameraAspect,
    activeLook,
    setActiveLook,
    exposureCompSupported,
    exposureCompValue,
    setExposureCompensation,
    unfreezeViewfinder,
  } = useCamera(true, defaultLookId);

  // Responsive Layout Engine
  const layout = useViewportLayout(cameraAspect);

  // Shutter & capture state
  const [isShutterActive, setIsShutterActive] = useState(false);
  const [isScreenFlashActive, setIsScreenFlashActive] = useState(false);
  const [showNativeFlashTip, setShowNativeFlashTip] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  interface ReviewSession {
    previewBitmap?: ImageBitmap | null;
    blobsPromise: Promise<{ filteredBlob: Blob; originalBlob: Blob }>;
    filteredBlob?: Blob | null;
    originalBlob?: Blob | null;
  }

  const [activeReview, setActiveReview] = useState<ReviewSession | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

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

  // Transient Look Name Caption
  const [lookCaption, setLookCaption] = useState<string | null>(null);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Look Drawer State for L2 density
  const [lookDrawerOpen, setLookDrawerOpen] = useState(false);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    };
  }, []);

  // Transient look selection with caption toast
  const handleSelectLook = useCallback(
    (look: Parameters<typeof setActiveLook>[0]) => {
      setActiveLook(look);
      setLookCaption(look.name);
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
      captionTimerRef.current = setTimeout(() => {
        setLookCaption(null);
      }, 2000);
    },
    [setActiveLook]
  );

  // Sync status modal state
  const [syncStatusOpen, setSyncStatusOpen] = useState(false);

  // Web Audio click / mechanical shutter sound synthesizer
  const playShutterSound = useCallback(() => {
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

  // Transient Capture / System feedback toast
  const [captureToast, setCaptureToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExecutingCaptureRef = useRef(false);

  const showToast = useCallback((msg: string, duration = 3000) => {
    setCaptureToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setCaptureToast(null);
    }, duration);
  }, []);

  // Actual capture execution with fail-safe error handling and zero-lag pipeline
  const executeCapture = useCallback(async () => {
    if (shotsLeft <= 0 || isProcessing || !live || isExecutingCaptureRef.current) return;
    isExecutingCaptureRef.current = true;

    // Start high-precision shutter timing t0
    diagnostics.startShutterMark();

    // Instant sensory feedback (0ms)
    triggerHaptic([40]);
    playShutterSound();

    // Immediately trigger visual shutter snap and wait for paint (t1 budget <= 50ms)
    setIsShutterActive(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        diagnostics.recordMark("t1");
        resolve();
      });
    });
    setTimeout(() => setIsShutterActive(false), 140);

    // If front camera and flash enabled (or auto), trigger warm-white screen flash
    const shouldFrontFlash = facing === "user" && flashMode !== "off";
    if (shouldFrontFlash) {
      setIsScreenFlashActive(true);
      setTimeout(() => setIsScreenFlashActive(false), 80);
    }

    try {
      setIsProcessing(true);
      const isMirrored = facing === "user" && mirrorFront;

      let previewOpened = false;
      const capturePromise = capture(
        cameraAspect,
        undefined,
        isMirrored,
        (fastPreview) => {
          previewOpened = true;
          if (fastPreview instanceof ImageBitmap) {
            setActiveReview({
              previewBitmap: fastPreview,
              blobsPromise: capturePromise,
            });
          } else {
            setActiveReview({
              filteredBlob: fastPreview,
              blobsPromise: capturePromise,
            });
          }
        }
      );

      // Background listener for archival resolution completion
      capturePromise
        .then(({ filteredBlob, originalBlob }) => {
          setActiveReview((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              filteredBlob,
              originalBlob,
            };
          });
        })
        .catch((err) => {
          console.error("Background photo render failed:", err);
        });

      // Fallback if onPreviewReady did not open review within immediate frame
      if (!previewOpened) {
        const { filteredBlob, originalBlob } = await capturePromise;
        setActiveReview({
          previewBitmap: null,
          blobsPromise: capturePromise,
          filteredBlob,
          originalBlob,
        });
      }
    } catch (err) {
      console.error("Capture error:", err);
      unfreezeViewfinder();
      showToast(t(lang, "captureFailed"));
      triggerHaptic([100, 50, 100]);
    } finally {
      setIsProcessing(false);
      setIsScreenFlashActive(false);
      isExecutingCaptureRef.current = false;
    }
  }, [shotsLeft, isProcessing, live, playShutterSound, capture, cameraAspect, facing, flashMode, mirrorFront, showToast, lang, unfreezeViewfinder]);

  // Shutter button trigger with timer countdown
  const handleShoot = () => {
    if (shotsLeft <= 0 || isProcessing || !live || isExecutingCaptureRef.current) return;

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
    if (!activeReview) return;
    const session = activeReview;
    const tKeep = performance.now();
    unfreezeViewfinder();
    setActiveReview(null);
    diagnostics.recordKeepToLive(performance.now() - tKeep);

    // Asynchronous background persist and upload as soon as archival blobs are ready
    try {
      const { filteredBlob, originalBlob } = await session.blobsPromise;
      void onShotCaptured(filteredBlob, originalBlob);
    } catch (e) {
      console.error("Failed to persist shot in background:", e);
      showToast(t(lang, "keepFailed"));
    }
  };

  const handleRetakePhoto = () => {
    unfreezeViewfinder();
    if (activeReview?.previewBitmap) {
      try {
        activeReview.previewBitmap.close();
      } catch {
        /* ignore */
      }
    }
    setActiveReview(null);
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

  const { isLandscape, mode, viewfinderRect } = layout;

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden select-none touch-manipulation flex flex-col justify-between">
      {/* Warm-white front camera screen flash overlay */}
      <div
        className={`fixed inset-0 z-45 pointer-events-none transition-opacity duration-150 bg-[#fff9ea] ${
          isScreenFlashActive ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Mechanical shutter blink animation overlay */}
      <div
        className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-150 bg-black ${
          isShutterActive ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Off-screen video element feeding WebGL canvas (avoid display:none which suspends decoding in mobile Chrome) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -999,
        }}
        aria-hidden="true"
      />

      {/* Central Viewfinder Container anchored to calculated geometry */}
      <div
        data-viewfinder
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
          className={`w-full h-full object-cover pointer-events-none ${
            facing === "user" && mirrorFront ? "-scale-x-100" : ""
          } ${error ? "filter blur-md opacity-40 transition-all duration-300" : ""}`}
        />

        {/* In-place Recovery Ladder Overlay (screen never unmounts) */}
        {error && (
          <CameraRecoveryOverlay
            error={error}
            eventSlug={eventSlug}
            lang={lang}
            onRetry={retry}
            onNativePhoto={onNativePhoto}
          />
        )}

        {/* Viewfinder Gestures & Overlays (Focus Ring, Grid, Level, Exposure, Pinch-Zoom) */}
        <ViewfinderGestures
          showGrid={showGrid}
          showLevel={showLevel}
          zoom={currentDisplayZoom}
          onZoomChange={(z) => {
            if (zoomRange) setZoom(z);
            else setDigitalZoom(z);
          }}
          onResetZoom={handleResetZoom}
          onExposureChange={handleExposureChange}
          exposureCompensation={exposureCompValue}
          aeAfLocked={aeAfLocked}
          onToggleAeAfLock={() => setAeAfLocked((v) => !v)}
        />

        {/* Retro 4 Corner Brackets (always inside viewfinder, hidden in full-bleed 16:9) */}
        <ViewfinderFrame visible={mode === "banded"} />

        {/* L1 Floating Lens Chips (Floating over lower ~8% of viewfinder like iPhone) */}
        {layout.density === "L1" && facing === "environment" && lenses.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
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
          {/* Top Bar Zone (Strict 52px slim single row, NO overlap) */}
          <header
            style={{
              paddingTop: "max(env(safe-area-inset-top), 0px)",
              height: `${layout.topBarHeight}px`,
              minHeight: `${layout.topBarHeight}px`,
              maxHeight: `${layout.topBarHeight}px`,
            }}
            className={`relative z-20 flex items-center w-full transition-colors ${
              mode === "banded" ? "bg-black" : "bg-gradient-to-b from-black/80 via-black/40 to-transparent"
            }`}
          >
            <CameraTopBar
              flashAvailable={hasHardwareFlash || facing === "user"}
              flashMode={flashMode}
              onChangeFlashMode={setFlashMode}
              aspect={cameraAspect}
              onChangeAspect={setCameraAspect}
              timerSeconds={timerSeconds}
              onChangeTimer={setTimerSeconds}
              pendingCount={pendingCount}
              onOpenSyncStatus={() => setSyncStatusOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onNativeTipClick={() => setShowNativeFlashTip(true)}
              lang={lang}
            />
          </header>

          {/* Bottom Bar Zone */}
          <footer
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
              minHeight: `${layout.bottomBarHeight}px`,
            }}
            className={`relative z-20 flex flex-col items-center justify-between w-full px-4 pt-1 transition-colors ${
              mode === "banded" ? "bg-black" : "bg-gradient-to-t from-black/90 via-black/50 to-transparent"
            }`}
          >
            {/* Transient Look Caption or Capture Error Toast above controls */}
            <div className="h-5 flex items-center justify-center">
              {captureToast ? (
                <div className="px-3 py-0.5 rounded-full bg-red-500 text-white font-mono text-[10px] font-bold tracking-wider animate-in fade-in zoom-in-95 duration-150 shadow-md">
                  {captureToast}
                </div>
              ) : lookCaption ? (
                <div className="px-3 py-0.5 rounded-full bg-amber-400 text-black font-mono text-[10px] font-bold uppercase tracking-wider animate-in fade-in zoom-in-95 duration-150 shadow-md">
                  {lookCaption}
                </div>
              ) : null}
            </div>

            {/* Look Dial Switcher (Short chips or collapsed drawer trigger) */}
            <div className="w-full flex justify-center py-0.5">
              <LookDial
                activeLook={activeLook}
                onSelectLook={handleSelectLook}
                allowedLookIds={allowedLookIds}
                isCollapsed={layout.density === "L2"}
                onOpenLookDrawer={() => setLookDrawerOpen(true)}
              />
            </div>

            {/* Lens Bar (Shown in bottom cluster for L0; in L1 it floats over viewfinder) */}
            {layout.density === "L0" && facing === "environment" && (
              <div className="flex items-center justify-center w-full min-h-[36px]">
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
              </div>
            )}

            {/* Shutter Row with Film Badge and Flip Camera */}
            <div className="flex items-center justify-between w-full max-w-sm px-2 pt-1 pb-1">
              {/* Left slot: Film Roll thumbnail with shots badge */}
              <div className="w-16 flex justify-start">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic([20]);
                    setGalleryOpen(true);
                  }}
                  aria-label={t(lang, "myPhotos")}
                  className="w-13 h-13 rounded-2xl bg-zinc-900 border border-zinc-700/80 hover:border-amber-400/80 flex flex-col items-center justify-center text-zinc-300 hover:text-white transition active:scale-95 shadow-md relative overflow-hidden group cursor-pointer"
                >
                  <span className="text-base">🎞️</span>
                  {/* Single Clean Film Shots Counter Badge */}
                  <span className="absolute bottom-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-mono font-bold text-[9px] leading-tight shadow-sm">
                    {shotsLeft}
                  </span>
                </button>
              </div>

              {/* Center slot: Shutter Button (78px with countdown ring) */}
              <ShutterButton
                onShoot={handleShoot}
                disabled={shotsLeft <= 0 || !live}
                isProcessing={isProcessing}
                timerCountdown={timerCountdown}
                timerTotal={timerSeconds}
              />

              {/* Right slot: Flip Camera Button (48x48 hit target) */}
              <div className="w-16 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic([20]);
                    flip();
                  }}
                  aria-label={t(lang, "flip")}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-transform active:scale-90 touch-manipulation shadow-md cursor-pointer"
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
          {/* Top Left film badge overlay */}
          <div className="p-4 flex items-center gap-3 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                triggerHaptic([20]);
                setGalleryOpen(true);
              }}
              aria-label={t(lang, "myPhotos")}
              className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-300 relative"
            >
              <span className="text-sm">🎞️</span>
              <span className="absolute bottom-0.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-mono font-bold text-[8px]">
                {shotsLeft}
              </span>
            </button>
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
                flashAvailable={hasHardwareFlash || facing === "user"}
                flashMode={flashMode}
                onChangeFlashMode={setFlashMode}
                aspect={cameraAspect}
                onChangeAspect={setCameraAspect}
                timerSeconds={timerSeconds}
                onChangeTimer={setTimerSeconds}
                pendingCount={pendingCount}
                onOpenSyncStatus={() => setSyncStatusOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onNativeTipClick={() => setShowNativeFlashTip(true)}
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
        rollCode={rollCode}
        eventSlug={eventSlug}
        lang={lang}
      />

      {/* Sync Status Sheet */}
      {syncStatusOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs select-none">
          <div className="flex-1" onClick={() => setSyncStatusOpen(false)} />
          <div className="w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                {lang === "id" ? "Status Sinkronisasi" : "Upload & Sync Status"}
              </h2>
              <button
                type="button"
                onClick={() => setSyncStatusOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="py-2 text-center space-y-3">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-zinc-800">
                <span
                  className={`w-4 h-4 rounded-full ${
                    pendingCount > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                  }`}
                />
              </div>
              <p className="text-sm text-zinc-200 font-medium">
                {pendingCount > 0
                  ? t(lang, "pending", { n: pendingCount })
                  : t(lang, "synced")}
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {pendingCount > 0
                  ? lang === "id"
                    ? "Foto sedang diunggah secara aman di latar belakang. Jangan tutup tab."
                    : "Photos are being safely uploaded in the background. Keep this tab open."
                  : lang === "id"
                    ? "Semua foto telah tersimpan dengan aman."
                    : "All captured photos are safely synced."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSyncStatusOpen(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-xs hover:bg-zinc-700 active:scale-95 transition-all"
            >
              {t(lang, "close")}
            </button>
          </div>
        </div>
      )}

      {/* L2 Density: Film Look Bottom Drawer */}
      {lookDrawerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs select-none">
          <div className="flex-1" onClick={() => setLookDrawerOpen(false)} />
          <div className="w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                {lang === "id" ? "Pilih Filter Film" : "Select Film Look"}
              </h2>
              <button
                type="button"
                onClick={() => setLookDrawerOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="py-2">
              <div className="w-full">
                <LookDial
                  activeLook={activeLook}
                  onSelectLook={(l) => {
                    handleSelectLook(l);
                    setLookDrawerOpen(false);
                  }}
                  allowedLookIds={allowedLookIds}
                  isCollapsed={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retro Review & Print Develop Modal (Keep vs Retake) */}
      {activeReview && (
        <ReviewModal
          previewBitmap={activeReview.previewBitmap}
          photoBlob={activeReview.filteredBlob}
          aspect={cameraAspect}
          lookName={activeLook.name}
          shotsLeft={shotsLeft}
          totalShots={totalShots}
          lang={lang}
          onKeep={handleKeepPhoto}
          onRetake={handleRetakePhoto}
        />
      )}

      {/* Hardware Flash Unsupported Tip Modal */}
      {showNativeFlashTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-zinc-900 border border-zinc-700 rounded-2xl p-5 text-center shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 font-mono">
              {lang === "id" ? "Lampu Kilat Perangkat" : "Hardware Flash"}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              {lang === "id"
                ? "Untuk lampu kilat belakang di Safari, gunakan kamera bawaan ponsel Anda."
                : "For rear flash on Safari, use your phone's native camera app."}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNativeFlashTip(false);
                  const nativeBtn = document.querySelector<HTMLInputElement>("input[type=file][capture=environment]");
                  if (nativeBtn) nativeBtn.click();
                }}
                className="w-full py-2.5 rounded-xl bg-amber-400 text-black font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                {lang === "id" ? "Buka Kamera Bawaan" : "Use Phone Camera"}
              </button>
              <button
                type="button"
                onClick={() => setShowNativeFlashTip(false)}
                className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer"
              >
                {lang === "id" ? "Tutup" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Guest Private Gallery Modal */}
      {galleryOpen && guestId && (
        <GuestGalleryModal
          isOpen={galleryOpen}
          eventSlug={eventSlug}
          guestId={guestId}
          rollCode={rollCode || "ROLL"}
          shotsLeft={shotsLeft}
          totalShots={totalShots}
          lang={lang}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {/* In-App Diagnostics HUD (?debug=1) */}
      {showHud && (
        <CameraDebugHud
          layout={layout}
          stream={stream}
          trackSettings={trackSettings}
          exposureCompensation={exposureCompValue}
          zoom={currentDisplayZoom}
          facing={facing}
          measuredFps={measuredFps}
          onClose={() => setShowHud(false)}
        />
      )}
    </div>
  );
}
