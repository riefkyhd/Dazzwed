"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNativeZoom,
  applyTorch,
  hasTorch,
  hasImageCaptureFlash,
  pulseTorch,
  measureSceneLuminance,
  readZoomRange,
  readExposureCompRange,
  applyExposureCompensation,
  type ZoomRange,
  type ExposureCompRange,
} from "./caps";
import { CameraError, openStream, type CameraErrorKind } from "./constraints";
import { pickDefaultLens, pickerLenses, type Lens } from "./lenses";
import { renderShot, prewarmCapturePipeline } from "@/lib/imaging/render";
import { cropForAspectAndZoom, fitLongestEdge, type CameraAspect } from "@/lib/imaging/geometry";
import type { LookRecipe } from "@/lib/imaging/looks/types";
import { CPM35_LOOK, getLookById } from "@/lib/imaging/looks/presets";
import type { LookEnginePipeline } from "@/lib/imaging/looks/pipeline";
import { diagnostics } from "./diagnostics";

export type Facing = "environment" | "user";

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

/**
 * In-app camera. Never assumes lenses/zoom/torch exist: everything is feature-detected after
 * permission is granted. Restarts itself after interruptions; the shot counter lives in the parent
 * so it survives restarts.
 */
export function useCamera(enabled: boolean, defaultLookId?: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => {});
  const zoomQueue = useRef<Promise<void>>(Promise.resolve());
  const lookPipelineRef = useRef<LookEnginePipeline | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const frameTimes = useRef<number[]>([]);
  const isFrozenRef = useRef(false);
  const lastFpsUpdateRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    prewarmCapturePipeline();
  }, []);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [measuredFps, setMeasuredFps] = useState<number>(30);
  const [previewTier, setPreviewTier] = useState<"high" | "standard" | "lite">("high");
  const [facing, setFacing] = useState<Facing>("environment");
  const [lensChoice, setLensChoice] = useState<string | undefined>(undefined);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoom, setZoomValue] = useState(1);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [hasHardwareFlash, setHasHardwareFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashMode, setFlashMode] = useState<"auto" | "on" | "off">("auto");
  const [aspect, setAspect] = useState(9 / 16);
  const [cameraAspect, setCameraAspect] = useState<CameraAspect>("3:4");
  const [activeLook, setActiveLookState] = useState<LookRecipe>(() => {
    if (!defaultLookId) return CPM35_LOOK;
    if (defaultLookId.endsWith(".cube")) {
      return {
        ...CPM35_LOOK,
        id: defaultLookId,
        name: defaultLookId.replace(/\.cube$/, "").replace(/[-_]/g, " "),
        lutUrl: `/luts/${defaultLookId}`,
      };
    }
    return getLookById(defaultLookId);
  });
  const [disableAnimatedGrain, setDisableAnimatedGrain] = useState(false);
  const [exposureCompRange, setExposureCompRange] = useState<ExposureCompRange | null>(null);
  const [exposureCompValue, setExposureCompValue] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let muteTimer: ReturnType<typeof setTimeout> | undefined;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let first = true;

    let knownDevices: MediaDeviceInfo[] = [];

    const scheduleRestart = (delay = 300) => {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => !cancelled && void run(true), delay);
    };

    const watch = (track: MediaStreamTrack) => {
      track.onended = () => scheduleRestart();
      track.onmute = () => {
        clearTimeout(muteTimer);
        // On iOS Safari / Android Camera2, track temporarily mutes during sensor exposure adaptation or switching.
        // Wait 4 seconds before concluding the track is actually dead.
        muteTimer = setTimeout(() => {
          if (!cancelled && track.muted && document.visibilityState === "visible") scheduleRestart(0);
        }, 4000);
      };
      track.onunmute = () => clearTimeout(muteTimer);
    };

    async function run(isRestart = false) {
      setError(null);
      if (isRestart) {
        setRestarting(true);
      } else {
        setStarting(true);
      }

      if (streamRef.current) {
        stopStream(streamRef.current);
        streamRef.current = null;
        // Hardware daemon cooldown (AVFoundation / Camera2) to release camera sensor lock
        await new Promise((r) => setTimeout(r, 200));
      }

      try {
        // Enumerate devices if not yet known so we can directly pick the best lens
        if (knownDevices.length === 0 && typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
          try {
            knownDevices = await navigator.mediaDevices.enumerateDevices();
          } catch {
            /* ignore */
          }
        }

        // If flipping to environment and no explicit lens was chosen, check if we already know the default lens deviceId
        let targetDeviceId = lensChoice;
        if (facing === "environment" && !targetDeviceId && knownDevices.length > 0) {
          targetDeviceId = pickDefaultLens(knownDevices);
        }

        let s = await openStream({ deviceId: targetDeviceId, facing });
        if (cancelled) return stopStream(s);

        // Refresh device list now that permissions are guaranteed
        try {
          knownDevices = await navigator.mediaDevices.enumerateDevices();
        } catch {
          /* no lens info: stay on whatever we got */
        }

        const cur = s.getVideoTracks()[0]?.getSettings().deviceId;
        if (facing === "environment" && !lensChoice) {
          // If we didn't have deviceId initially or the device picked isn't the primary main lens
          const def = pickDefaultLens(knownDevices, cur);
          if (def && def !== cur) {
            stopStream(s);
            // Wait brief cooldown so the previous hardware stream terminates cleanly before switching lens
            await new Promise((r) => setTimeout(r, 180));
            try {
              s = await openStream({ deviceId: def, facing });
            } catch (e) {
              if (e instanceof CameraError && e.kind === "denied") throw e;
              s = await openStream({ facing }); // graceful fallback
            }
            if (cancelled) return stopStream(s);
          }
        }

        const track = s.getVideoTracks()[0];
        if (!track) throw new CameraError("unknown");
        watch(track);
        streamRef.current = s;
        setStream(s);
        setActiveId(track.getSettings().deviceId);
        setLenses(facing === "environment" ? pickerLenses(knownDevices) : []);
        const zr = readZoomRange(track);
        setZoomRange(zr);
        setZoomValue(zr?.min ?? 1);
        setDigitalZoom(1);
        setTorchAvailable(hasTorch(track));
        setHasHardwareFlash(hasImageCaptureFlash(track) || hasTorch(track));
        setTorchOn(false);

        // Apply track exposure compensation (-0.5 EV) to protect highlights if supported
        try {
          const ec = readExposureCompRange(track);
          setExposureCompRange(ec);
          if (ec) {
            const targetEV = Math.max(ec.min, Math.min(ec.max, -0.5));
            void applyExposureCompensation(track, targetEV).catch(() => {});
            setExposureCompValue(targetEV);
          } else {
            setExposureCompValue(0);
          }
        } catch {
          setExposureCompRange(null);
          setExposureCompValue(0);
        }

        first = false;
        setError(null);
        diagnostics.logEvent("TRACK_ACQUIRED", `${track.getSettings().width}x${track.getSettings().height}`);
      } catch (e) {
        if (cancelled) return;
        setStream(null);
        let kind: CameraErrorKind = e instanceof CameraError ? e.kind : "unknown";
        if (kind === "denied" && typeof navigator !== "undefined" && navigator.permissions?.query) {
          try {
            const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
            if (perm.state === "prompt") kind = "prompt";
          } catch {
            /* ignore */
          }
        }
        setError(kind);
        diagnostics.logEvent("CAMERA_ERROR", kind);
      } finally {
        if (!cancelled) {
          setStarting(false);
          setRestarting(false);
        }
      }
    }
    runRef.current = () => run(true);
    void run(!first);

    let suspendTimer: ReturnType<typeof setTimeout> | null = null;

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        diagnostics.logEvent("VISIBILITY_CHANGE", "hidden");
        if (suspendTimer) clearTimeout(suspendTimer);
        // Stop tracks after 45s hidden to preserve battery and privacy
        suspendTimer = setTimeout(() => {
          diagnostics.logEvent("TRACKS_SUSPENDED", "45s background timeout");
          stopStream(streamRef.current);
          streamRef.current = null;
          setStream(null);
        }, 45000);
      } else if (document.visibilityState === "visible") {
        diagnostics.logEvent("VISIBILITY_CHANGE", "visible");
        if (suspendTimer) {
          clearTimeout(suspendTimer);
          suspendTimer = null;
        }
        const t = streamRef.current?.getVideoTracks()[0];
        if (!t || t.readyState !== "live" || t.muted) {
          diagnostics.logEvent("REACQUIRE_STREAM", "silent resume");
          scheduleRestart(0);
        }
      }
    };

    const onResumeEvent = (evt: Event) => {
      if (cancelled) return;
      diagnostics.logEvent("RESUME_EVENT", evt.type);
      const t = streamRef.current?.getVideoTracks()[0];
      if (!t || t.readyState !== "live" || t.muted) {
        scheduleRestart(0);
      }
    };

    const onDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        knownDevices = devices;
        if (facing === "environment") setLenses(pickerLenses(devices));
        const id = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
        if (id && !devices.some((d) => d.deviceId === id)) scheduleRestart(0);
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onResumeEvent);
    window.addEventListener("focus", onResumeEvent);
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

    return () => {
      cancelled = true;
      if (suspendTimer) clearTimeout(suspendTimer);
      clearTimeout(muteTimer);
      clearTimeout(restartTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onResumeEvent);
      window.removeEventListener("focus", onResumeEvent);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      stopStream(streamRef.current);
      streamRef.current = null;
      setStream(null);
      isFrozenRef.current = false;
    };
  }, [enabled, facing, lensChoice]);

  // Attach stream to <video> and initialize live WebGL filter on <canvas>
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v) return;
    v.srcObject = stream;
    if (!stream) return;

    let destroyed = false;

    const sync = () => {
      if (v.videoWidth && v.videoHeight) {
        setAspect(v.videoWidth / v.videoHeight);
      }
    };

    // Ensure playback starts and recovers if paused/stalled
    const ensurePlay = () => {
      if (!destroyed && v.paused) {
        v.play().catch(() => {});
      }
    };

    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("resize", sync);
    v.addEventListener("canplay", ensurePlay);
    v.addEventListener("playing", sync);
    ensurePlay();

    // Watchdog: If video element gets paused or stalled while stream is active, kick it back to life
    const watchdogTimer = setInterval(() => {
      if (destroyed) return;
      const track = stream?.getVideoTracks()[0];
      if (track && track.readyState === "live") {
        if (v.paused || v.readyState < 2) {
          v.play().catch(() => {});
        }
      }
    }, 1000);

    // Lazy load and start Look Engine WebGL2 viewfinder loop
    if (c) {
      import("@/lib/imaging/looks/pipeline").then(({ LookEnginePipeline }) => {
        if (destroyed || !canvasRef.current) return;
        const pipeline = new LookEnginePipeline(canvasRef.current);
        lookPipelineRef.current = pipeline;

        let lastTime = performance.now();
        let loopTimer: number | null = null;

        const renderLoop = (now: DOMHighResTimeStamp) => {
          if (destroyed) return;

          // If viewfinder is frozen for capture / review, pause frame updates on canvas
          if (isFrozenRef.current) {
            animFrameRef.current = requestAnimationFrame(renderLoop);
            return;
          }

          // Measure fps over rolling window
          const delta = now - lastTime;
          lastTime = now;
          if (delta > 0) {
            frameTimes.current.push(1000 / delta);
            if (frameTimes.current.length > 30) frameTimes.current.shift();
            const avg = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;

            // Throttle React state update to at most once per 2.5s to prevent 60Hz component re-render churn
            if (now - lastFpsUpdateRef.current > 2500) {
              lastFpsUpdateRef.current = now;
              setMeasuredFps(Math.round(avg));
            }

            // Performance degradation ladder:
            // 1. animated grain off (< 24 fps)
            // 2. preview resolution tier down (< 20 fps, < 15 fps)
            if (avg < 24) {
              setDisableAnimatedGrain(true);
            }
            if (avg < 20 && previewTier === "high") {
              setPreviewTier("standard");
            } else if (avg < 15 && previewTier === "standard") {
              setPreviewTier("lite");
            }
          }

          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && lookPipelineRef.current) {
            const longEdge = previewTier === "high" ? 1280 : previewTier === "standard" ? 960 : 720;
            const vw = v.videoWidth;
            const vh = v.videoHeight;
            const targetAspect = cameraAspect || "3:4";
            const effectiveDigitalZoom = zoomRange ? 1 : digitalZoom;

            const targetCrop = cropForAspectAndZoom(vw, vh, targetAspect, effectiveDigitalZoom);
            const out = fitLongestEdge(targetCrop.sw, targetCrop.sh, longEdge);

            // Keep canvas backing buffer smooth; only change if long edge tier changed
            if (canvasRef.current && (canvasRef.current.width !== out.width || canvasRef.current.height !== out.height)) {
              canvasRef.current.width = out.width;
              canvasRef.current.height = out.height;
            }

            const normTargetCropRect = {
              x: targetCrop.sx / vw,
              y: targetCrop.sy / vh,
              width: targetCrop.sw / vw,
              height: targetCrop.sh / vh,
            };

            lookPipelineRef.current.render(v, activeLook, {
              width: out.width,
              height: out.height,
              isCapture: false,
              disableAnimatedGrain,
              cropRect: normTargetCropRect,
            });
          }

          // Schedule next frame using requestAnimationFrame
          animFrameRef.current = requestAnimationFrame(renderLoop);
        };

        animFrameRef.current = requestAnimationFrame(renderLoop);
      });
    }

    return () => {
      destroyed = true;
      clearInterval(watchdogTimer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (lookPipelineRef.current) lookPipelineRef.current.destroy();
      lookPipelineRef.current = null;
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("resize", sync);
      v.removeEventListener("canplay", ensurePlay);
      v.removeEventListener("playing", sync);
    };
  }, [stream, previewTier, activeLook, disableAnimatedGrain, cameraAspect, digitalZoom, zoomRange]);

  const setZoom = useCallback((value: number) => {
    setZoomValue(value);
    zoomQueue.current = zoomQueue.current
      .then(() => {
        const t = streamRef.current?.getVideoTracks()[0];
        return t ? applyNativeZoom(t, value) : undefined;
      })
      .catch(() => {});
  }, []);

  const toggleTorch = useCallback(async () => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (!t) return;
    const next = !torchOn;
    try {
      await applyTorch(t, next);
      setTorchOn(next);
    } catch {
      setTorchOn(false);
      setTorchAvailable(false);
    }
  }, [torchOn]);

  const setActiveLook = useCallback((look: LookRecipe) => {
    setActiveLookState(look);
  }, []);

  const setExposureCompensation = useCallback(
    async (ev: number) => {
      const t = streamRef.current?.getVideoTracks()[0];
      if (!t || !exposureCompRange) return;
      const clamped = Math.max(exposureCompRange.min, Math.min(exposureCompRange.max, ev));
      setExposureCompValue(clamped);
      await applyExposureCompensation(t, clamped);
    },
    [exposureCompRange]
  );

  const unfreezeViewfinder = useCallback(() => {
    isFrozenRef.current = false;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

    const capture = useCallback(
      async (
        aspectOverride?: CameraAspect,
        shotSeed = Math.floor(Math.random() * 100000),
        mirrorOverride?: boolean,
        onPreviewReady?: (preview: ImageBitmap | Blob) => void
      ): Promise<{ filteredBlob: Blob; originalBlob: Blob }> => {
        const v = videoRef.current;
        const c = canvasRef.current;
        const track = streamRef.current?.getVideoTracks()[0];
        if (!v || !streamRef.current || v.readyState < 2) throw new Error("camera not ready");
        const targetAspect = aspectOverride || cameraAspect;
        const isMirrored = mirrorOverride !== undefined ? mirrorOverride : facing === "user";

        // Cancel previous pending archival render if still active
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const abortCtrl = new AbortController();
        abortControllerRef.current = abortCtrl;

        // 1. Freeze viewfinder immediately
        isFrozenRef.current = true;

        // 2. Instant preview bitmap directly from the live WebGL canvas (< 1ms on mobile)
        if (c && onPreviewReady) {
          try {
            const previewBmp = await createImageBitmap(c);
            diagnostics.recordMark("t3");
            onPreviewReady(previewBmp);
          } catch (e) {
            console.warn("Instant preview bitmap grab failed:", e);
          }
        }

        // 3. Yield to main thread so ReviewModal mounts, paints, and records t4 (< 100ms budget)
        await new Promise((r) => setTimeout(r, 80));
        if (abortCtrl.signal.aborted) {
          return { filteredBlob: new Blob(), originalBlob: new Blob() };
        }

        // 4. Determine if flash should fire (only needed if environment camera has hardware torch)
        let shouldFireFlash = false;
        if (flashMode === "on") {
          shouldFireFlash = true;
        } else if (flashMode === "auto" && facing === "environment" && track && hasTorch(track)) {
          // Fast check using exposure metadata or downsampled luminance
          const luminance = measureSceneLuminance(v);
          shouldFireFlash = luminance < 0.28;
        }

        // 5. Acquire full-resolution raw frame snapshot from running video stream (~37ms)
        let frozenSource: ImageBitmap | HTMLVideoElement = v;
        if (shouldFireFlash && facing === "environment" && track && hasTorch(track)) {
          frozenSource = await pulseTorch(track, async () => {
            return typeof createImageBitmap === "function" ? await createImageBitmap(v) : v;
          });
        } else {
          try {
            if (typeof createImageBitmap === "function") {
              frozenSource = await createImageBitmap(v);
            }
          } catch {
            frozenSource = v;
          }
        }
        diagnostics.recordMark("t2");
        if (abortCtrl.signal.aborted) {
          if (frozenSource instanceof ImageBitmap) frozenSource.close();
          return { filteredBlob: new Blob(), originalBlob: new Blob() };
        }

        try {
          // Yield so main thread paints ReviewModal and processes touch events
          await new Promise((r) => setTimeout(r, 40));
          if (abortCtrl.signal.aborted) {
            return { filteredBlob: new Blob(), originalBlob: new Blob() };
          }

          // Background archival photos rendered at full resolution (2560px)
          const filteredBlob = await renderShot(frozenSource, {
            zoom: zoomRange ? 1 : digitalZoom,
            aspect: targetAspect,
            applyFilter: true,
            look: activeLook,
            seed: shotSeed,
            mirror: isMirrored,
            maxEdge: 2560,
            quality: 0.90,
          });

          await new Promise((r) => setTimeout(r, 20));

          const originalBlob = await renderShot(frozenSource, {
            zoom: zoomRange ? 1 : digitalZoom,
            aspect: targetAspect,
            applyFilter: false,
            mirror: isMirrored,
            maxEdge: 2560,
            quality: 0.90,
          });

          diagnostics.recordMark("t5");
          return { filteredBlob, originalBlob };
        } finally {
          if (frozenSource instanceof ImageBitmap) {
            frozenSource.close();
          }
        }
      },
      [zoomRange, digitalZoom, cameraAspect, activeLook, flashMode, facing]
    );

  return {
    videoRef,
    canvasRef,
    live: !!stream && !error,
    stream,
    trackSettings: stream?.getVideoTracks()[0]?.getSettings() ?? null,
    error,
    starting,
    restarting,
    measuredFps,
    previewTier,
    aspect,
    cameraAspect,
    setCameraAspect,
    activeLook,
    setActiveLook,
    exposureCompSupported: !!exposureCompRange,
    exposureCompValue,
    exposureCompRange,
    setExposureCompensation,
    facing,
    flip: () => {
      setLensChoice(undefined);
      setFacing((f) => (f === "environment" ? "user" : "environment"));
    },
    lenses,
    activeId,
    chooseLens: (id: string) => setLensChoice(id),
    zoomRange,
    zoom,
    setZoom,
    digitalZoom,
    setDigitalZoom,
    torchAvailable: torchAvailable && facing === "environment",
    hasHardwareFlash: hasHardwareFlash && facing === "environment",
    torchOn,
    toggleTorch,
    flashMode,
    setFlashMode,
    capture,
    unfreezeViewfinder,
    retry: () => void runRef.current(),
    hasTrack: () => !!streamRef.current?.getVideoTracks()[0],
  };
}
