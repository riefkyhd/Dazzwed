"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { type Lang, t } from "@/lib/i18n";
import { useCamera } from "@/lib/camera/useCamera";
import { getEffectiveDisplayZoom, resolveZoomPreset } from "@/lib/camera/lenses";
import { useViewportLayout } from "@/lib/camera/useViewportLayout";
import { triggerHaptic } from "@/lib/camera/haptics";
import { diagnostics } from "@/lib/camera/diagnostics";
import { CameraTopBar } from "./CameraTopBar";
import { ViewfinderGestures } from "./ViewfinderGestures";
import { ViewfinderFrame } from "./ViewfinderFrame";
import { CameraSettingsSheet } from "./CameraSettingsSheet";
import { SyncStatusSheet } from "./SyncStatusSheet";
import { LookDrawerSheet } from "./LookDrawerSheet";
import { ShutterButton } from "./ShutterButton";
import { LensBar } from "./LensBar";
import { CameraRecoveryOverlay } from "./CameraRecoveryOverlay";
import { CameraDebugHud } from "@/components/debug/CameraDebugHud";
import { ReviewModal } from "./ReviewModal";
import { LookDial } from "./LookDial";
import { GuestGalleryModal } from "./GuestGalleryModal";
import { getLookById, CPM35_LOOK } from "@/lib/imaging/looks/presets";
import { isBlobBlankOrBlack } from "@/lib/imaging/render";
import { createTimerScheduler, type TimerScheduler } from "@/lib/camera/timer-cadence";
export { isBlobBlankOrBlack };

interface CameraScreenProps {
  eventSlug: string;
  coupleNames: string;
  shotsLeft: number;
  totalShots?: number;
  pendingCount: number;
  syncError?: boolean;
  guestId?: string | null;
  rollCode?: string | null;
  lang: Lang;
  onShotCaptured: (
    filteredBlob: Blob,
    originalBlob?: Blob,
    meta?: {
      presetId?: string;
      captureSource?: "takePhoto" | "videoFrame";
      retakenPresetIds?: string[];
    }
  ) => Promise<void>;
  onNativePhoto: (file: File, quickThumb?: string) => void;
  allowedLookIds?: string[];
  defaultLookId?: string;
  onDeleteRoll?: () => Promise<void>;
}
async function imageBitmapToBlob(bmp: ImageBitmap): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(bmp, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      canvas.width = canvas.height = 0;
      if (b && b.size > 0) {
        resolve(b);
      } else {
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
          const parts = dataUrl.split(",");
          const byteString = atob(parts[1] || "");
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          resolve(new Blob([ab], { type: "image/jpeg" }));
        } catch (e) {
          reject(e);
        }
      }
    }, "image/jpeg", 0.90);
  });
}


export function CameraScreen({
  eventSlug,
  coupleNames,
  shotsLeft,
  totalShots = 15,
  pendingCount,
  syncError = false,
  guestId,
  rollCode,
  lang,
  onShotCaptured,
  onNativePhoto,
  allowedLookIds,
  defaultLookId,
  onDeleteRoll,
}: CameraScreenProps) {
  const searchParams = useSearchParams();
  const isDebug = searchParams?.get("debug") === "1";
  const [showHud, setShowHud] = useState(isDebug);
  const [mirrorFront, setMirrorFront] = useState(true);

  // Sync indicator tooltip (First kept photo in session, auto-vanishes after ~2s)
  const [showSyncTooltip, setShowSyncTooltip] = useState(false);
  const [syncTooltipFading, setSyncTooltipFading] = useState(false);
  const hasTriggeredSyncTipRef = useRef(false);

  const {
    videoRef,
    canvasRef,
    live,
    stream,
    trackSettings,
    measuredFps,
    error,
    isYieldedToOtherTab,
    takeOverCamera,
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
    hasHardwareFlash,
    setTorchSafe,
    pulseTorchSafe,
    flashMode,
    setFlashMode,
    flashIntensity,
    setFlashIntensity,
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
    performanceMode,
    setPerformanceMode,
    qualityTier,
  } = useCamera(true, defaultLookId, mirrorFront);

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
    abortCapture?: () => void;
    filteredBlob?: Blob | null;
    originalBlob?: Blob | null;
  }

  const [activeReview, setActiveReview] = useState<ReviewSession | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Vintage Self-Timer state (0s, 3s, 10s) with flash cadence
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerCountdown, setTimerCountdown] = useState<number>(0);
  const [timerCueActive, setTimerCueActive] = useState(false);
  const timerSchedulerRef = useRef<TimerScheduler | null>(null);

  // Camera Settings & Tools
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aeAfLocked, setAeAfLocked] = useState(false);

  // Transient Look Name Caption
  const [lookCaption, setLookCaption] = useState<string | null>(null);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Look Drawer State for L2 density
  const [lookDrawerOpen, setLookDrawerOpen] = useState(false);

  // Initial loading tracking so flip camera switches are completely silent without overlays
  const [hasInitialized, setHasInitialized] = useState(false);
  if (live && !hasInitialized) {
    setHasInitialized(true);
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerSchedulerRef.current) timerSchedulerRef.current.cancel();
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    };
  }, []);

  // Ensure scroll is at 0, 0 and suppress iOS Safari page zoom gestures while camera is active
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("scrollRestoration" in window.history) {
        try {
          window.history.scrollRestoration = "manual";
        } catch {
          /* ignore */
        }
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    const preventPageZoom = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("gesturestart", preventPageZoom, { passive: false });
    document.addEventListener("gesturechange", preventPageZoom, { passive: false });
    document.addEventListener("gestureend", preventPageZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventPageZoom);
      document.removeEventListener("gesturechange", preventPageZoom);
      document.removeEventListener("gestureend", preventPageZoom);
    };
  }, []);

  // Transient look selection with caption toast
  const handleSelectLook = useCallback(
    (look: Parameters<typeof setActiveLook>[0]) => {
      if (allowedLookIds && allowedLookIds.length > 0 && !allowedLookIds.includes(look.id)) {
        return;
      }
      setActiveLook(look);
      setLookCaption(look.name);
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
      captionTimerRef.current = setTimeout(() => {
        setLookCaption(null);
      }, 2000);
    },
    [allowedLookIds, setActiveLook]
  );

  // Enforce allowedLookIds on activeLook
  useEffect(() => {
    if (allowedLookIds && allowedLookIds.length > 0 && !allowedLookIds.includes(activeLook.id)) {
      const fallback = getLookById(allowedLookIds[0]) ?? CPM35_LOOK;
      setActiveLook(fallback);
    }
  }, [allowedLookIds, activeLook.id, setActiveLook]);

  // Sync status modal state
  const [syncStatusOpen, setSyncStatusOpen] = useState(false);

  // Web Audio click / mechanical shutter sound synthesizer
  const playShutterSound = useCallback(() => {
    if (!soundEnabled) return;
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

  // Web Audio self-timer cadence blip tick
  const playTimerTick = useCallback(
    (pitch: number = 880, durationMs: number = 60) => {
      if (!soundEnabled) return;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(pitch, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
      } catch {
        // AudioContext might be blocked before first user gesture
      }
    },
    [soundEnabled]
  );

  // Transient Capture / System feedback toast
  const [captureToast, setCaptureToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExecutingCaptureRef = useRef(false);
  const captureSessionCounterRef = useRef<number>(0);
  const activeSessionIdRef = useRef<number | null>(null);
  const retakenPresetsRef = useRef<string[]>([]);

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
    const sessionId = ++captureSessionCounterRef.current;
    activeSessionIdRef.current = sessionId;

    // Start high-precision shutter timing t0
    diagnostics.startShutterMark();

    // Instant tactile feedback on shutter tap (0ms)
    triggerHaptic([40]);

    try {
      setIsProcessing(true);

      let fastPreviewBitmap: ImageBitmap | null = null;
      let fastPreviewBlob: Blob | null = null;

      const capturePromise = capture(
        cameraAspect,
        undefined,
        undefined,
        (fastPreview) => {
          if (activeSessionIdRef.current !== sessionId) {
            if (fastPreview instanceof ImageBitmap) {
              try { fastPreview.close(); } catch {}
            }
            return;
          }
          if (fastPreview instanceof ImageBitmap) {
            fastPreviewBitmap = fastPreview;
          } else {
            fastPreviewBlob = fastPreview;
          }
        },
        {
          onScreenFlash: (active) => setIsScreenFlashActive(active),
          onShutterSnap: () => {
            playShutterSound();
            setIsShutterActive(true);
            requestAnimationFrame(() => {
              diagnostics.recordMark("t1");
            });
          },
        }
      );

      // Race capturePromise against a 160ms mechanical shutter curtain window.
      // In 95%+ of captures, renderShot completes in ~90-120ms, allowing ReviewModal
      // to open DIRECTLY with the 100% final developed photo (zero preview swap or visual hop).
      const result = await Promise.race([
        capturePromise,
        new Promise<{ filteredBlob: null; originalBlob: null }>((r) =>
          setTimeout(() => r({ filteredBlob: null, originalBlob: null }), 160)
        ),
      ]);

      if (activeSessionIdRef.current !== sessionId) return;

      if (result.filteredBlob && result.filteredBlob.size > 0) {
        // Unified 1-step mount: ReviewModal opens directly with the fully developed photo!
        setActiveReview({
          filteredBlob: result.filteredBlob,
          originalBlob: result.originalBlob ?? undefined,
          blobsPromise: capturePromise,
          abortCapture: capturePromise.abort,
        });
      } else {
        // Fallback: If archival render took > 160ms on low-tier hardware, mount with fast preview
        if (fastPreviewBitmap) {
          setActiveReview({
            previewBitmap: fastPreviewBitmap,
            blobsPromise: capturePromise,
            abortCapture: capturePromise.abort,
          });
        } else if (fastPreviewBlob) {
          setActiveReview({
            filteredBlob: fastPreviewBlob,
            blobsPromise: capturePromise,
            abortCapture: capturePromise.abort,
          });
        }
      }

      // Background listener for archival resolution completion
      capturePromise
        .then(({ filteredBlob, originalBlob }) => {
          if (activeSessionIdRef.current !== sessionId) {
            // Dismissed by user clicking Retake
            return;
          }
          if (filteredBlob && filteredBlob.size > 0) {
            setActiveReview((prev) => {
              if (!prev || activeSessionIdRef.current !== sessionId) {
                return null;
              }
              return {
                ...prev,
                filteredBlob,
                originalBlob,
              };
            });
          }
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            console.error("Background photo render failed:", err);
          }
        });
    } catch (err) {
      console.error("Capture error:", err);
      unfreezeViewfinder();
      showToast(t(lang, "captureFailed"));
      triggerHaptic([100, 50, 100]);
    } finally {
      setIsProcessing(false);
      setIsScreenFlashActive(false);
      setIsShutterActive(false);
      isExecutingCaptureRef.current = false;
    }
  }, [shotsLeft, isProcessing, live, playShutterSound, capture, cameraAspect, facing, mirrorFront, showToast, lang, unfreezeViewfinder]);

  // Shutter button trigger with vintage timer countdown
  const handleShoot = () => {
    if (shotsLeft <= 0 || isProcessing || !live || isExecutingCaptureRef.current) return;

    if (timerSchedulerRef.current?.isActive() || timerCountdown > 0) {
      // Cancel active countdown immediately
      timerSchedulerRef.current?.cancel();
      timerSchedulerRef.current = null;
      setTimerCountdown(0);
      setTimerCueActive(false);
      void setTorchSafe(false);
      return;
    }

    if (timerSeconds === 0) {
      void executeCapture();
      return;
    }

    // Start precision self-timer scheduler
    triggerHaptic([20]);
    const scheduler = createTimerScheduler({
      totalSeconds: timerSeconds,
      onCountdownUpdate: (remaining) => {
        setTimerCountdown(remaining);
      },
      onCueChange: (active) => {
        setTimerCueActive(active);
      },
      onTorchPulse: (durationMs) => {
        if (facing === "environment") {
          void pulseTorchSafe(durationMs);
        }
      },
      onTorchHold: (on) => {
        if (facing === "environment") {
          void setTorchSafe(on);
        }
      },
      onCapture: () => {
        void executeCapture();
      },
      onTickAudio: (type) => {
        if (type === "single") {
          playTimerTick(880, 70);
        } else if (type === "double") {
          playTimerTick(1100, 60);
        } else if (type === "hold") {
          playTimerTick(1320, 150);
        }
      },
      onHaptic: (pattern) => {
        triggerHaptic(pattern);
      },
    });

    timerSchedulerRef.current = scheduler;
    scheduler.start();
  };

  const handleKeepPhoto = useCallback(async () => {
    if (!activeReview) return;
    const session = activeReview;
    const tKeep = performance.now();
    unfreezeViewfinder();
    setActiveReview(null);
    diagnostics.recordKeepToLive(performance.now() - tKeep);

    // Asynchronous background persist and upload as soon as archival blobs are ready
    try {
      let filteredBlob: Blob | null = null;
      let originalBlob: Blob | undefined = undefined;

      try {
        const res = await session.blobsPromise;
        filteredBlob = res.filteredBlob;
        originalBlob = res.originalBlob;
      } catch (err) {
        console.warn("Archival blobsPromise threw, using fast preview fallback:", err);
        if (session.filteredBlob && session.filteredBlob.size > 0) {
          filteredBlob = session.filteredBlob;
        } else if (session.previewBitmap) {
          try {
            filteredBlob = await imageBitmapToBlob(session.previewBitmap);
          } catch (e2) {
            console.error("Failed to convert previewBitmap to blob:", e2);
          }
        }
      }

      // Sanity Guard: If filteredBlob is solid black (e.g. iOS WebKit video draw failure), reject and salvage preview
      if (filteredBlob && (await isBlobBlankOrBlack(filteredBlob))) {
        console.warn("Archival filteredBlob was solid black, recovering from previewBitmap");
        filteredBlob = null;
      }

      if (!filteredBlob || filteredBlob.size === 0) {
        if (session.previewBitmap) {
          try {
            filteredBlob = await imageBitmapToBlob(session.previewBitmap);
          } catch {}
        } else if (session.filteredBlob && session.filteredBlob.size > 0) {
          filteredBlob = session.filteredBlob;
        }
      }

      // If originalBlob was also solid black, salvage from filteredBlob so RAW original is never saved as black
      if (originalBlob && (await isBlobBlankOrBlack(originalBlob))) {
        originalBlob = filteredBlob || undefined;
      }

      if (filteredBlob && filteredBlob.size > 0) {
        const retaken = [...retakenPresetsRef.current];
        retakenPresetsRef.current = [];
        void onShotCaptured(filteredBlob, originalBlob, {
          presetId: activeLook.id,
          captureSource: typeof window !== "undefined" && "ImageCapture" in window ? "takePhoto" : "videoFrame",
          retakenPresetIds: retaken,
        });

        // Trigger first-time photo save sync indicator tooltip (Part 4)
        if (!hasTriggeredSyncTipRef.current) {
          try {
            const alreadyShown = typeof window !== "undefined" && window.sessionStorage.getItem("dc_sync_tip_shown");
            if (!alreadyShown) {
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem("dc_sync_tip_shown", "1");
              }
              hasTriggeredSyncTipRef.current = true;
              setShowSyncTooltip(true);
              setSyncTooltipFading(false);
              setTimeout(() => {
                setSyncTooltipFading(true);
                setTimeout(() => {
                  setShowSyncTooltip(false);
                }, 500);
              }, 2000);
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error("Failed to persist shot in background:", e);
      showToast(t(lang, "keepFailed"));
    } finally {
      if (session.previewBitmap && typeof session.previewBitmap.close === "function") {
        try {
          session.previewBitmap.close();
        } catch {}
      }
    }
  }, [activeReview, unfreezeViewfinder, onShotCaptured, showToast, lang, activeLook.id]);

  const handleRetakePhoto = useCallback(() => {
    if (activeLook?.id) {
      retakenPresetsRef.current.push(activeLook.id);
      if (retakenPresetsRef.current.length > 50) {
        retakenPresetsRef.current.shift();
      }
    }
    activeSessionIdRef.current = null;
    unfreezeViewfinder();
    if (activeReview?.abortCapture) {
      activeReview.abortCapture();
    }
    if (activeReview?.previewBitmap) {
      try {
        activeReview.previewBitmap.close();
      } catch {
        /* ignore */
      }
    }
    setActiveReview(null);
  }, [unfreezeViewfinder, activeReview, activeLook?.id]);

  // Viewfinder gestures & exposure
  const handleExposureChange = (deltaEV: number) => {
    void setExposureCompensation(deltaEV);
  };

  const handleResetZoom = () => {
    triggerHaptic([20]);
    const decision = resolveZoomPreset({ preset: 1, lenses, activeId, zoomRange });
    if (decision.mechanism === "camera-switch" && decision.targetDeviceId) {
      chooseLens(decision.targetDeviceId, 1);
      return;
    }
    if (zoomRange) setZoom(1);
    setDigitalZoom(1);
  };

  const currentDisplayZoom = getEffectiveDisplayZoom({
    activeId,
    lenses,
    zoom,
    digitalZoom,
    zoomRange,
  });

  const { isLandscape, mode, viewfinderRect } = layout;

  return (
    <div className="fixed inset-0 w-full h-dvh bg-black overflow-hidden select-none touch-manipulation flex flex-col justify-between">
      {/* Front camera screen flash overlay */}
      <div
        className={`fixed inset-0 z-45 pointer-events-none transition-opacity duration-150 ${
          flashIntensity === "soft" ? "bg-[#fff8ea]" : "bg-white"
        } ${
          isScreenFlashActive
            ? flashIntensity === "soft"
              ? "opacity-65"
              : "opacity-90"
            : "opacity-0"
        }`}
      />

      {/* Mechanical shutter blink animation overlay */}
      <div
        className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-150 bg-black ${
          isShutterActive ? "opacity-95" : "opacity-0"
        }`}
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
          transition: "width 380ms cubic-bezier(0.32, 0.72, 0, 1), height 380ms cubic-bezier(0.32, 0.72, 0, 1), top 380ms cubic-bezier(0.32, 0.72, 0, 1), left 380ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: "width, height, top, left",
        }}
        className="overflow-hidden bg-black flex items-center justify-center rounded-sm shadow-2xl z-0 relative"
      >
        {/* Under-canvas video element kept actively decoded by iOS Safari WebKit */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.001,
            pointerEvents: "none",
            zIndex: 0,
          }}
          aria-hidden="true"
        />

        {/* WebGL Canvas with persistent baseline dimensions and Apple spring scale */}
        <canvas
          ref={canvasRef}
          style={{
            width: `${layout.baselineRect.width}px`,
            height: `${layout.baselineRect.height}px`,
            transform: `scale(${cameraAspect === "16:9" ? 1.3333 : 1.0}) translateZ(0)`,
            transition: "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)",
            willChange: "transform",
            zIndex: 1,
          }}
          className={`relative pointer-events-none transform-gpu flex-shrink-0 ${
            error || isYieldedToOtherTab ? "filter blur-md opacity-40 transition-all duration-300" : ""
          }`}
        />

        {/* In-place Recovery Ladder Overlay (screen never unmounts) */}
        {error && (
          <CameraRecoveryOverlay
            error={error}
            eventSlug={eventSlug}
            lang={lang}
            onRetry={retry}
            onTakeOverCamera={takeOverCamera}
            onNativePhoto={onNativePhoto}
          />
        )}

        {/* Multi-Tab Inactive / Yielded State (calm, non-error status) */}
        {isYieldedToOtherTab && !error && (
          <div
            role="status"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/80 backdrop-blur-md animate-in fade-in"
          >
            <div className="w-full max-w-xs flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
              </div>
              <div>
                <h3 className="font-serif text-base text-zinc-200 font-semibold">{t(lang, "cameraInOtherTabTitle")}</h3>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  {t(lang, "cameraInOtherTabBody")}
                </p>
              </div>
              <button
                type="button"
                onClick={takeOverCamera}
                className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                {t(lang, "useCameraHere")}
              </button>
            </div>
          </div>
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

        {/* Self-Timer Cadence: Subtle Viewfinder border indicator */}
        <div
          data-testid="timer-cue-border"
          className={`absolute inset-0 pointer-events-none transition-opacity duration-150 z-20 border border-amber-400/25 ${
            timerCueActive ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />

        {/* Self-Timer Cadence: Front Camera subtle selfie indicator */}
        {facing === "user" && (
          <div
            data-testid="timer-selfie-glow"
            className={`absolute inset-0 pointer-events-none transition-opacity duration-150 z-20 bg-amber-400/5 ${
              timerCueActive ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          />
        )}

        {/* Self-Timer Cadence: Minimalist, steady countdown badge */}
        {timerCountdown > 0 && (
          <div
            data-testid="timer-countdown-badge"
            className="absolute top-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
          >
            <div
              className={`px-3.5 py-1.5 rounded-full bg-black/80 border backdrop-blur-sm font-mono font-bold text-xl shadow-xl flex items-center gap-2 transition-colors duration-150 ${
                timerCueActive
                  ? "border-amber-300 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                  : "border-amber-400/40 text-amber-400 shadow-black/80"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors duration-150 ${
                  timerCueActive ? "bg-amber-300" : "bg-amber-400/50"
                }`}
              />
              <span>{timerCountdown}s</span>
            </div>
          </div>
        )}

        {/* Starting Spinner (initial entry only, silent seamless switch on flip) */}
        {!hasInitialized && starting && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-3" />
            <p className="text-xs font-mono text-zinc-300 uppercase tracking-widest">
              {coupleNames}
            </p>
          </div>
        )}
      </div>

      {/* Floating Lens Zoom Toggle anchored consistently above bottom control bar across all aspect ratios */}
      {facing === "environment" && (
        <div
          style={{
            bottom: isLandscape ? "16px" : `calc(${layout.bottomBarHeight}px + 14px)`,
            left: isLandscape ? `calc((100% - ${layout.bottomBarHeight}px) / 2)` : "50%",
            transform: "translateX(-50%)",
          }}
          className="absolute z-20 pointer-events-auto transition-[bottom,left] duration-250 ease-out"
        >
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
              syncError={syncError}
              onOpenSyncStatus={() => setSyncStatusOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onNativeTipClick={() => setShowNativeFlashTip(true)}
              lang={lang}
              showSyncTooltip={showSyncTooltip}
              syncTooltipFading={syncTooltipFading}
            />
          </header>

          {/* Bottom Bar Zone (Streamlined without zoom crowding) */}
          <footer
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
              height: `${layout.bottomBarHeight}px`,
            }}
            className={`relative z-10 flex flex-col items-center justify-center gap-1.5 w-full px-4 pt-1 transition-colors ${
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
                  disabled={starting || restarting || isProcessing}
                  onClick={() => {
                    triggerHaptic([20]);
                    flip();
                  }}
                  aria-label={t(lang, "flip")}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-transform active:scale-90 touch-manipulation shadow-md disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
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
                syncError={syncError}
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
                disabled={starting || restarting || isProcessing}
                onClick={() => {
                  triggerHaptic([20]);
                  flip();
                }}
                aria-label={t(lang, "flip")}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 active:scale-90 shadow-md disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
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
        flashIntensity={flashIntensity}
        onChangeFlashIntensity={setFlashIntensity}
        rollCode={rollCode}
        eventSlug={eventSlug}
        lang={lang}
        performanceMode={performanceMode}
        onSelectPerformanceMode={setPerformanceMode}
        qualityTier={qualityTier}
        onDeleteRoll={onDeleteRoll}
      />

      {/* Sync Status Sheet with natural slide up/down animation */}
      <SyncStatusSheet
        open={syncStatusOpen}
        onClose={() => setSyncStatusOpen(false)}
        syncError={syncError}
        pendingCount={pendingCount}
        lang={lang}
      />

      {/* L2 Density: Film Look Bottom Drawer with natural slide up/down animation */}
      <LookDrawerSheet
        open={lookDrawerOpen}
        onClose={() => setLookDrawerOpen(false)}
        activeLook={activeLook}
        onSelectLook={handleSelectLook}
        allowedLookIds={allowedLookIds}
        lang={lang}
      />

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
          <div className="w-full max-w-xs bg-zinc-900 border border-zinc-700 rounded-2xl p-5 text-center shadow-2xl animate-in zoom-in-95 duration-150">
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
          nativeZoom={zoom}
          digitalZoom={digitalZoom}
          zoomRange={zoomRange}
          facing={facing}
          measuredFps={measuredFps}
          onClose={() => setShowHud(false)}
        />
      )}
    </div>
  );
}
