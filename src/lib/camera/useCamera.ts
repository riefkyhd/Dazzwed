"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNativeZoom,
  applyTorch,
  hasTorch,
  readZoomRange,
  readExposureCompRange,
  applyExposureCompensation,
  type ZoomRange,
  type ExposureCompRange,
} from "./caps";
import { CameraError, openStream, type CameraErrorKind } from "./constraints";
import { pickDefaultLens, pickerLenses, type Lens } from "./lenses";
import { renderShot } from "@/lib/imaging/render";
import type { CameraAspect } from "@/lib/imaging/geometry";
import type { LookRecipe } from "@/lib/imaging/looks/types";
import { DISPOSABLE_400_LOOK } from "@/lib/imaging/looks/presets";

export type Facing = "environment" | "user";

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

/**
 * In-app camera. Never assumes lenses/zoom/torch exist: everything is feature-detected after
 * permission is granted. Restarts itself after interruptions; the shot counter lives in the parent
 * so it survives restarts.
 */
export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => {});
  const zoomQueue = useRef<Promise<void>>(Promise.resolve());
  const lookPipelineRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const frameTimes = useRef<number[]>([]);

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
  const [torchOn, setTorchOn] = useState(false);
  const [aspect, setAspect] = useState(9 / 16);
  const [cameraAspect, setCameraAspect] = useState<CameraAspect>("3:2");
  const [activeLook, setActiveLookState] = useState<LookRecipe>(DISPOSABLE_400_LOOK);
  const [disableAnimatedGrain, setDisableAnimatedGrain] = useState(false);
  const [exposureCompRange, setExposureCompRange] = useState<ExposureCompRange | null>(null);
  const [exposureCompValue, setExposureCompValue] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let muteTimer: ReturnType<typeof setTimeout> | undefined;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let first = true;

    const scheduleRestart = (delay = 300) => {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => !cancelled && void run(true), delay);
    };

    const watch = (track: MediaStreamTrack) => {
      track.onended = () => scheduleRestart();
      track.onmute = () => {
        clearTimeout(muteTimer);
        muteTimer = setTimeout(() => {
          if (!cancelled && track.muted && document.visibilityState === "visible") scheduleRestart(0);
        }, 3000);
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
      stopStream(streamRef.current);
      streamRef.current = null;
      try {
        let s = await openStream({ deviceId: lensChoice, facing });
        if (cancelled) return stopStream(s);

        // Labels (and thus lens info) are only available after permission is granted.
        let devices: MediaDeviceInfo[] = [];
        try {
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch {
          /* no lens info: stay on whatever we got */
        }
        const cur = s.getVideoTracks()[0]?.getSettings().deviceId;
        if (facing === "environment" && !lensChoice) {
          // iOS: facingMode alone may pick the ultra-wide / a virtual camera. Prefer the main lens.
          const def = pickDefaultLens(devices, cur);
          if (def && def !== cur) {
            stopStream(s);
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
        setLenses(facing === "environment" ? pickerLenses(devices) : []);
        const zr = readZoomRange(track);
        setZoomRange(zr);
        setZoomValue(zr?.min ?? 1);
        setDigitalZoom(1);
        setTorchAvailable(hasTorch(track));
        setTorchOn(false);

        // Apply track exposure compensation (-0.5 EV) to protect highlights if supported
        const ec = readExposureCompRange(track);
        setExposureCompRange(ec);
        if (ec) {
          const targetEV = Math.max(ec.min, Math.min(ec.max, -0.5));
          void applyExposureCompensation(track, targetEV);
          setExposureCompValue(targetEV);
        } else {
          setExposureCompValue(0);
        }

        first = false;
      } catch (e) {
        if (cancelled) return;
        setStream(null);
        setError(e instanceof CameraError ? e.kind : "unknown");
      } finally {
        if (!cancelled) {
          setStarting(false);
          setRestarting(false);
        }
      }
    }
    runRef.current = () => run(true);
    void run(!first);

    const onVisible = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      const t = streamRef.current?.getVideoTracks()[0];
      if (!t || t.readyState !== "live") scheduleRestart(0);
    };
    const onDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        if (facing === "environment") setLenses(pickerLenses(devices));
        const id = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
        if (id && !devices.some((d) => d.deviceId === id)) scheduleRestart(0);
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      cancelled = true;
      clearTimeout(muteTimer);
      clearTimeout(restartTimer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      stopStream(streamRef.current);
      streamRef.current = null;
      setStream(null);
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
    let webglFilter: any = null;

    const sync = () => {
      if (v.videoWidth && v.videoHeight) {
        setAspect(v.videoWidth / v.videoHeight);
      }
    };
    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("resize", sync);
    v.play().catch(() => {});

    // Lazy load and start Look Engine WebGL2 viewfinder loop
    if (c) {
      import("@/lib/imaging/looks/pipeline").then(({ LookEnginePipeline }) => {
        if (destroyed || !canvasRef.current) return;
        const pipeline = new LookEnginePipeline(canvasRef.current);
        lookPipelineRef.current = pipeline;

        let lastTime = performance.now();
        const renderLoop = (now: DOMHighResTimeStamp) => {
          if (destroyed) return;

          // Measure fps over rolling window
          const delta = now - lastTime;
          lastTime = now;
          if (delta > 0) {
            frameTimes.current.push(1000 / delta);
            if (frameTimes.current.length > 30) frameTimes.current.shift();
            const avg = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
            setMeasuredFps(Math.round(avg));

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

          if (v.readyState >= 2 && lookPipelineRef.current) {
            const longEdge = previewTier === "high" ? 1280 : previewTier === "standard" ? 960 : 720;
            const aspectVal = (v.videoWidth && v.videoHeight) ? v.videoWidth / v.videoHeight : 9 / 16;
            const w = aspectVal >= 1 ? longEdge : Math.round(longEdge * aspectVal);
            const h = aspectVal >= 1 ? Math.round(longEdge / aspectVal) : longEdge;

            lookPipelineRef.current.render(v, activeLook, {
              width: w,
              height: h,
              isCapture: false,
              disableAnimatedGrain,
            });
          }

          if ("requestVideoFrameCallback" in v) {
            (v as any).requestVideoFrameCallback(renderLoop);
          } else {
            animFrameRef.current = requestAnimationFrame(renderLoop);
          }
        };

        if ("requestVideoFrameCallback" in v) {
          (v as any).requestVideoFrameCallback(renderLoop);
        } else {
          animFrameRef.current = requestAnimationFrame(renderLoop);
        }
      });
    }

    return () => {
      destroyed = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (lookPipelineRef.current) lookPipelineRef.current.destroy();
      lookPipelineRef.current = null;
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("resize", sync);
    };
  }, [stream, previewTier, activeLook, disableAnimatedGrain]);

  const track = () => streamRef.current?.getVideoTracks()[0];

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
    if (look.aspectRatio) {
      setCameraAspect(look.aspectRatio as CameraAspect);
    }
  }, []);

  const capture = useCallback(
    async (
      aspectOverride?: CameraAspect,
      shotSeed = Math.floor(Math.random() * 100000)
    ): Promise<{ filteredBlob: Blob; originalBlob: Blob }> => {
      const v = videoRef.current;
      if (!v || !streamRef.current || v.readyState < 2) throw new Error("camera not ready");
      const targetAspect = aspectOverride || cameraAspect;
      // Native zoom is already in the frames; digital zoom and aspect ratio are applied by cropping.
      const [filteredBlob, originalBlob] = await Promise.all([
        renderShot(v, {
          zoom: zoomRange ? 1 : digitalZoom,
          aspect: targetAspect,
          applyFilter: true,
          look: activeLook,
          seed: shotSeed,
        }),
        renderShot(v, {
          zoom: zoomRange ? 1 : digitalZoom,
          aspect: targetAspect,
          applyFilter: false,
        }),
      ]);
      return { filteredBlob, originalBlob };
    },
    [zoomRange, digitalZoom, cameraAspect, activeLook]
  );

  return {
    videoRef,
    canvasRef,
    live: !!stream && !error,
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
    torchOn,
    toggleTorch,
    capture,
    retry: () => void runRef.current(),
    hasTrack: () => !!streamRef.current?.getVideoTracks()[0],
  };
}
