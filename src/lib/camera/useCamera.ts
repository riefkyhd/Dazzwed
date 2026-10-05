"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNativeZoom,
  applyTorch,
  hasTorch,
  readZoomRange,
  type ZoomRange,
} from "./caps";
import { CameraError, openStream, type CameraErrorKind } from "./constraints";
import { pickDefaultLens, pickerLenses, type Lens } from "./lenses";
import { renderShot } from "@/lib/imaging/render";

export type Facing = "environment" | "user";

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

/**
 * In-app camera. Never assumes lenses/zoom/torch exist: everything is feature-detected after
 * permission is granted. Restarts itself after interruptions; the shot counter lives in the parent
 * so it survives restarts.
 */
export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => {});
  const zoomQueue = useRef<Promise<void>>(Promise.resolve());

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
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

  // Attach stream to <video>
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    if (!stream) return;
    const sync = () => v.videoWidth && v.videoHeight && setAspect(v.videoWidth / v.videoHeight);
    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("resize", sync);
    v.play().catch(() => {});
    return () => {
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("resize", sync);
    };
  }, [stream]);

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

  const capture = useCallback(async (): Promise<Blob> => {
    const v = videoRef.current;
    if (!v || !streamRef.current || v.readyState < 2) throw new Error("camera not ready");
    // Native zoom is already in the frames; digital zoom is applied by cropping.
    return renderShot(v, { zoom: zoomRange ? 1 : digitalZoom });
  }, [zoomRange, digitalZoom]);

  return {
    videoRef,
    live: !!stream && !error,
    error,
    starting,
    restarting,
    aspect,
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
    hasTrack: () => !!track(),
  };
}
