"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNativeZoom,
  applyTorch,
  clampZoomToRange,
  hasTorch,
  hasImageCaptureFlash,
  pulseTorch,
  applyFlashConstraints,
  measureSceneLuminance,
  readZoomRange,
  readExposureCompRange,
  applyExposureCompensation,
  type ZoomRange,
  type ExposureCompRange,
} from "./caps";
import { CameraError, openStream, type CameraErrorKind } from "./constraints";
import { pickDefaultLens, pickerLenses, toLens, type Lens } from "./lenses";
import { renderShot, prewarmCapturePipeline, isCanvasBlankOrBlack, isBlobBlankOrBlack } from "@/lib/imaging/render";
import { cropForAspectAndZoom, fitLongestEdge, type CameraAspect } from "@/lib/imaging/geometry";
import type { LookRecipe } from "@/lib/imaging/looks/types";
import { CPM35_LOOK, getLookById } from "@/lib/imaging/looks/presets";
import type { LookEnginePipeline } from "@/lib/imaging/looks/pipeline";
import { diagnostics, redactDeviceId, type EnumeratedVideoInput } from "./diagnostics";
import { getCameraCoordinator } from "./camera-tab-lock";
import {
  AdaptivePerformanceController,
  resolveInitialPerfMode,
  resolveInitialTier,
  type QualityTier,
  type PerformanceMode,
} from "./adaptive-controller";

export type Facing = "environment" | "user";
export type FlashIntensity = "soft" | "standard";

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

function formatZoomActionLabel(val: number, zr: ZoomRange | null): string {
  if (Math.abs(val - 0.5) < 0.05 || (zr && zr.min < 1 && Math.abs(val - zr.min) < 0.05)) return "0.5x";
  if (Math.abs(val - 1) < 0.02) return "1x";
  if (Math.abs(val - 2) < 0.02) return "2x";
  if (Math.abs(val - 3) < 0.02) return "3x";
  return "pinch";
}

function recordEnumeratedInputs(
  devices: readonly MediaDeviceInfo[],
  currentActiveId: string | undefined,
  pickerList: readonly Lens[]
) {
  const pickerIds = new Set(pickerList.map((l) => l.deviceId));
  const videoDevices = devices.filter((d) => d.kind === "videoinput");
  const mapped: EnumeratedVideoInput[] = videoDevices.map((d, idx) => {
    const classified = toLens(d);
    return {
      index: idx + 1,
      redactedId: redactDeviceId(d.deviceId),
      redactedGroupId: redactDeviceId(d.groupId),
      label: d.label || `(unlabeled camera #${idx + 1})`,
      classifiedKind: classified.kind,
      classifiedFacing: classified.facing,
      isActive: Boolean(currentActiveId && d.deviceId === currentActiveId),
      inPicker: pickerIds.has(d.deviceId),
    };
  });
  diagnostics.setVideoInputs(mapped);
}

/**
 * In-app camera. Never assumes lenses/zoom/torch exist: everything is feature-detected after
 * permission is granted. Restarts itself after interruptions; the shot counter lives in the parent
 * so it survives restarts.
 */
export function useCamera(enabled: boolean, defaultLookId?: string, mirrorFront: boolean = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => {});
  const zoomQueue = useRef<Promise<void>>(Promise.resolve());
  const torchQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lookPipelineRef = useRef<LookEnginePipeline | null>(null);
  const isFrozenRef = useRef(false);
  const lastFpsUpdateRef = useRef<number>(0);
  const activeIdRef = useRef<string | undefined>(undefined);
  const zoomRangeRef = useRef<ZoomRange | null>(null);
  const digitalZoomRef = useRef<number>(1);
  const pendingPresetZoomRef = useRef<number | null>(null);

  useEffect(() => {
    prewarmCapturePipeline();
  }, []);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [reportedTrackSettings, setReportedTrackSettings] = useState<MediaTrackSettings | null>(null);
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [isYieldedToOtherTab, setIsYieldedToOtherTab] = useState(false);
  const isYieldedToOtherTabRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [measuredFps, setMeasuredFps] = useState<number>(30);
  const [performanceMode, setPerformanceModeState] = useState<PerformanceMode>(resolveInitialPerfMode);
  const [qualityTier, setQualityTierState] = useState<QualityTier>(() =>
    resolveInitialTier(resolveInitialPerfMode())
  );
  const perfControllerRef = useRef<AdaptivePerformanceController | null>(null);
  if (perfControllerRef.current == null) {
    perfControllerRef.current = new AdaptivePerformanceController(performanceMode, qualityTier);
  }

  const setPerformanceMode = useCallback((m: PerformanceMode) => {
    perfControllerRef.current?.setMode(m);
    setPerformanceModeState(m);
    if (perfControllerRef.current) {
      setQualityTierState(perfControllerRef.current.getTier());
    }
  }, []);

  const isCapturingRef = useRef(false);
  const isGesturingRef = useRef(false);
  const gestureDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markGesturing = useCallback(() => {
    isGesturingRef.current = true;
    if (gestureDebounceRef.current) clearTimeout(gestureDebounceRef.current);
    gestureDebounceRef.current = setTimeout(() => {
      isGesturingRef.current = false;
    }, 500);
  }, []);

  const [facing, setFacing] = useState<Facing>("environment");
  const [actualFacing, setActualFacing] = useState<Facing>("environment");
  const actualFacingRef = useRef<Facing>("environment");
  const [lensChoice, setLensChoice] = useState<string | undefined>(undefined);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoom, setZoomValue] = useState(1);
  const [digitalZoom, setDigitalZoomState] = useState(1);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [hasHardwareFlash, setHasHardwareFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashMode, setFlashMode] = useState<"auto" | "on" | "off">("auto");
  const [flashIntensity, setFlashIntensityState] = useState<FlashIntensity>(() => {
    if (typeof window === "undefined") return "soft";
    try {
      const saved = localStorage.getItem("dazzwed_flash_intensity");
      return saved === "standard" ? "standard" : "soft";
    } catch {
      return "soft";
    }
  });

  const setFlashIntensity = useCallback((intensity: FlashIntensity) => {
    setFlashIntensityState(intensity);
    try {
      localStorage.setItem("dazzwed_flash_intensity", intensity);
    } catch {}
  }, []);
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
  const activeLookRef = useRef(activeLook);
  const cameraAspectRef = useRef(cameraAspect);
  const facingRef = useRef(facing);
  const mirrorFrontRef = useRef(mirrorFront);

  useEffect(() => {
    activeLookRef.current = activeLook;
    cameraAspectRef.current = cameraAspect;
    facingRef.current = facing;
    mirrorFrontRef.current = mirrorFront;
  }, [activeLook, cameraAspect, facing, mirrorFront]);

  const [exposureCompRange, setExposureCompRange] = useState<ExposureCompRange | null>(null);
  const [exposureCompValue, setExposureCompValue] = useState<number>(0);
  const exposureCompValueRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const coordinator = getCameraCoordinator();
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

    let runInFlight = false;
    let nextRunQueued: boolean | null = null;

    async function run(isRestart = false) {
      if (runInFlight) {
        nextRunQueued = isRestart;
        return;
      }
      runInFlight = true;

      try {
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

        // Coordinate with any other tabs to claim camera exclusive lease
        const coordinator = getCameraCoordinator();
        await coordinator.claimCamera(180);
        if (cancelled) return;

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
        if (facing === "environment" && !lensChoice && !targetDeviceId) {
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
        let settingsAfter = track.getSettings();
        const prevActiveId = activeIdRef.current;
        const newDeviceId = settingsAfter.deviceId;
        activeIdRef.current = newDeviceId;
        setActiveId(newDeviceId);
        setReportedTrackSettings(settingsAfter);
        const picker = facing === "environment" ? pickerLenses(knownDevices) : [];
        setLenses(picker);
        const zr = readZoomRange(track);
        zoomRangeRef.current = zr;
        setZoomRange(zr);

        const requestedPreset = pendingPresetZoomRef.current;
        pendingPresetZoomRef.current = null;
        const matchedLens = picker.find((l) => l.deviceId === newDeviceId);
        const isLensSwitch = Boolean(lensChoice && prevActiveId && prevActiveId !== newDeviceId);

        setTorchAvailable(hasTorch(track));
        setHasHardwareFlash(hasImageCaptureFlash(track) || hasTorch(track));
        setTorchOn(false);

        recordEnumeratedInputs(knownDevices, newDeviceId, picker);

        if (
          requestedPreset &&
          requestedPreset > 1 &&
          matchedLens?.explicitZoom !== requestedPreset
        ) {
          // Switched back from a secondary lens (e.g. 0.5x ultrawide) to main in order to apply 2x or 3x
          if (zr && zr.min <= requestedPreset && zr.max >= requestedPreset) {
            const clamped = clampZoomToRange(requestedPreset, zr);
            setZoomValue(clamped);
            digitalZoomRef.current = 1;
            setDigitalZoomState(1);
            try {
              await applyNativeZoom(track, clamped, zr);
              settingsAfter = track.getSettings();
              setReportedTrackSettings(settingsAfter);
              diagnostics.logZoomAction({
                action: formatZoomActionLabel(requestedPreset, zr),
                requestedValue: requestedPreset,
                mechanism: "browser-zoom-constraint",
                opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
                streamRetained: false,
                previousDeviceIdRedacted: redactDeviceId(prevActiveId),
                activeDeviceIdRedacted: redactDeviceId(newDeviceId),
                activeDeviceLabel: track.label || "(unlabeled track)",
                constraintApplied: `getUserMedia(deviceId=${redactDeviceId(newDeviceId)}) + applyConstraints({ advanced: [{ zoom: ${Number(clamped.toFixed(2))} }] })`,
                constraintStatus: "success",
                reportedZoomAfter:
                  typeof (settingsAfter as MediaTrackSettings & { zoom?: number }).zoom === "number"
                    ? (settingsAfter as MediaTrackSettings & { zoom?: number }).zoom!
                    : null,
                supportedZoomRange: zr,
                effectiveAppDigitalCrop: 1,
                resolutionAfter:
                  settingsAfter.width && settingsAfter.height
                    ? `${settingsAfter.width}x${settingsAfter.height}`
                    : "unknown",
              });
            } catch (err) {
              const fallbackCrop = clampZoomToRange(requestedPreset, null);
              setZoomValue(zr ? clampZoomToRange(1, zr) : 1);
              digitalZoomRef.current = fallbackCrop;
              setDigitalZoomState(fallbackCrop);
              const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
              diagnostics.logZoomAction({
                action: formatZoomActionLabel(requestedPreset, null),
                requestedValue: requestedPreset,
                mechanism: "app-digital-crop",
                opticalVerification: "DIGITAL_CROP_ONLY",
                streamRetained: false,
                previousDeviceIdRedacted: redactDeviceId(prevActiveId),
                activeDeviceIdRedacted: redactDeviceId(newDeviceId),
                activeDeviceLabel: track.label || "(unlabeled track)",
                constraintApplied: `applyConstraints failed (${errMsg}); fallback cropForAspectAndZoom(${fallbackCrop})`,
                constraintStatus: "error",
                constraintError: errMsg,
                reportedZoomAfter: null,
                supportedZoomRange: zr,
                effectiveAppDigitalCrop: fallbackCrop,
                resolutionAfter:
                  settingsAfter.width && settingsAfter.height
                    ? `${settingsAfter.width}x${settingsAfter.height}`
                    : "unknown",
              });
            }
          } else {
            const initNative = zr ? clampZoomToRange(1, zr) : 1;
            const cropVal = clampZoomToRange(requestedPreset, null);
            setZoomValue(initNative);
            digitalZoomRef.current = cropVal;
            setDigitalZoomState(cropVal);
            diagnostics.logZoomAction({
              action: formatZoomActionLabel(requestedPreset, null),
              requestedValue: requestedPreset,
              mechanism: "app-digital-crop",
              opticalVerification: "DIGITAL_CROP_ONLY",
              streamRetained: false,
              previousDeviceIdRedacted: redactDeviceId(prevActiveId),
              activeDeviceIdRedacted: redactDeviceId(newDeviceId),
              activeDeviceLabel: track.label || "(unlabeled track)",
              constraintApplied: `getUserMedia(deviceId=${redactDeviceId(newDeviceId)}) + cropForAspectAndZoom(effectiveDigitalZoom=${cropVal})`,
              constraintStatus: "not-applicable",
              reportedZoomAfter:
                typeof (settingsAfter as MediaTrackSettings & { zoom?: number }).zoom === "number"
                  ? (settingsAfter as MediaTrackSettings & { zoom?: number }).zoom!
                  : null,
              supportedZoomRange: zr,
              effectiveAppDigitalCrop: cropVal,
              resolutionAfter:
                settingsAfter.width && settingsAfter.height
                  ? `${settingsAfter.width}x${settingsAfter.height}`
                  : "unknown",
            });
          }
        } else {
          const initZoom = zr ? clampZoomToRange(1, zr) : 1;
          setZoomValue(initZoom);
          digitalZoomRef.current = 1;
          setDigitalZoomState(1);

          const actionLabel: "0.5x" | "1x" | "2x" | "3x" | "stream-init" =
            matchedLens?.kind === "ultrawide"
              ? "0.5x"
              : matchedLens?.kind === "tele" && matchedLens.explicitZoom === 3
              ? "3x"
              : matchedLens?.kind === "tele" && matchedLens.explicitZoom === 2
              ? "2x"
              : isLensSwitch
              ? "1x"
              : "stream-init";
          const matchedZoomValue =
            matchedLens?.kind === "ultrawide"
              ? matchedLens.explicitZoom ?? 0.5
              : matchedLens?.kind === "tele" && matchedLens.explicitZoom
              ? matchedLens.explicitZoom
              : initZoom;

          diagnostics.logZoomAction({
            action: actionLabel,
            requestedValue: matchedZoomValue,
            mechanism: isLensSwitch ? "camera-switch" : "base-1x",
            opticalVerification: isLensSwitch ? "SEPARATE_DEVICE_STREAM" : "CANNOT_VERIFY_FROM_BROWSER_API",
            streamRetained: false,
            previousDeviceIdRedacted: redactDeviceId(prevActiveId),
            activeDeviceIdRedacted: redactDeviceId(newDeviceId),
            activeDeviceLabel: track.label || "(unlabeled track)",
            constraintApplied: isLensSwitch
              ? `getUserMedia({ video: { deviceId: { exact: "${redactDeviceId(newDeviceId)}" } } })`
              : `getUserMedia(facing=${facing})`,
            constraintStatus: "not-applicable",
            reportedZoomAfter:
              typeof (settingsAfter as MediaTrackSettings & { zoom?: number }).zoom === "number"
                ? (settingsAfter as MediaTrackSettings & { zoom?: number }).zoom!
                : null,
            supportedZoomRange: zr,
            effectiveAppDigitalCrop: 1,
            resolutionAfter:
              settingsAfter.width && settingsAfter.height
                ? `${settingsAfter.width}x${settingsAfter.height}`
                : "unknown",
          });
        }

        // Apply track exposure compensation (-0.5 EV) to protect highlights if supported
        try {
          const ec = readExposureCompRange(track);
          setExposureCompRange(ec);
          if (ec) {
            const targetEV = Math.max(ec.min, Math.min(ec.max, -0.5));
            void applyExposureCompensation(track, targetEV).catch(() => {});
            setExposureCompValue(targetEV);
            exposureCompValueRef.current = targetEV;
          } else {
            setExposureCompValue(0);
            exposureCompValueRef.current = 0;
          }
        } catch {
          setExposureCompRange(null);
          setExposureCompValue(0);
          exposureCompValueRef.current = 0;
        }

        first = false;
        setError(null);
        isYieldedToOtherTabRef.current = false;
        setIsYieldedToOtherTab(false);
        const detectedFacing = (s.getVideoTracks()[0]?.getSettings().facingMode as Facing) || facing;
        actualFacingRef.current = detectedFacing;
        setActualFacing(detectedFacing);
        setFacing(detectedFacing);
        coordinator.notifyActive();
        diagnostics.logEvent("TRACK_ACQUIRED", `${settingsAfter.width}x${settingsAfter.height}`);
      } catch (e) {
        if (cancelled) return;
        setStream(null);
        // If switching cameras failed, restore facing state back to the active camera
        if (facing !== actualFacingRef.current) {
          setFacing(actualFacingRef.current);
        }
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
        setStarting(false);
        setRestarting(false);
        runInFlight = false;
        if (nextRunQueued !== null) {
          const next = nextRunQueued;
          nextRunQueued = null;
          setTimeout(() => !cancelled && void run(next), 30);
        }
      }
    }
    runRef.current = () => run(true);

    const unsubscribeCoordinator = coordinator.subscribe({
      onClaim: (requesterTabId: string) => {
        if (streamRef.current) {
          diagnostics.logEvent("CROSS_TAB_YIELD", `Yielding camera sensor to tab ${requesterTabId}`);
          stopStream(streamRef.current);
          streamRef.current = null;
          setStream(null);
          isYieldedToOtherTabRef.current = true;
          setIsYieldedToOtherTab(true);
          coordinator.notifyYielded(requesterTabId);
        } else {
          // Immediately acknowledge so the claiming tab does not stall waiting for a timeout
          coordinator.notifyYielded(requesterTabId);
        }
      },
    });

    void run(!first);

    let suspendTimer: ReturnType<typeof setTimeout> | null = null;

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        diagnostics.logEvent("VISIBILITY_CHANGE", "hidden");
        if (suspendTimer) clearTimeout(suspendTimer);
        // Fast background suspend (1.2 seconds) so other tabs or apps aren't blocked
        suspendTimer = setTimeout(() => {
          diagnostics.logEvent("TRACKS_SUSPENDED", "1.2s background timeout");
          stopStream(streamRef.current);
          streamRef.current = null;
          setStream(null);
          coordinator.notifyReleased();
        }, 1200);
      } else if (document.visibilityState === "visible") {
        diagnostics.logEvent("VISIBILITY_CHANGE", "visible");
        if (suspendTimer) {
          clearTimeout(suspendTimer);
          suspendTimer = null;
        }
        const t = streamRef.current?.getVideoTracks()[0];
        if (!t || t.readyState !== "live" || t.muted || isYieldedToOtherTabRef.current) {
          diagnostics.logEvent("REACQUIRE_STREAM", "silent resume / reclaim lease");
          isYieldedToOtherTabRef.current = false;
          setIsYieldedToOtherTab(false);
          scheduleRestart(160);
        } else {
          const v = videoRef.current;
          if (v && v.paused) {
            v.play().catch(() => {});
          }
        }
      }
    };

    const onResumeEvent = (evt: Event) => {
      if (cancelled) return;
      diagnostics.logEvent("RESUME_EVENT", evt.type);
      const t = streamRef.current?.getVideoTracks()[0];
      if (!t || t.readyState !== "live" || t.muted || isYieldedToOtherTabRef.current) {
        isYieldedToOtherTabRef.current = false;
        setIsYieldedToOtherTab(false);
        scheduleRestart(160);
      } else {
        const v = videoRef.current;
        if (v && v.paused) {
          v.play().catch(() => {});
        }
      }
    };

    const onDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        knownDevices = devices;
        const picker = facing === "environment" ? pickerLenses(devices) : [];
        if (facing === "environment") setLenses(picker);
        const id = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
        recordEnumeratedInputs(devices, id, picker);
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
      unsubscribeCoordinator();
      coordinator.notifyReleased();
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
        setStarting(false);
        setRestarting(false);
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

    // Lazy load and start Look Engine WebGL2 viewfinder loop driven by rVFC (or rAF)
    if (c) {
      import("@/lib/imaging/looks/pipeline").then(({ LookEnginePipeline }) => {
        if (destroyed || !canvasRef.current) return;
        const pipeline = new LookEnginePipeline(canvasRef.current, { preserveDrawingBuffer: true });
        lookPipelineRef.current = pipeline;

        let lastTime = performance.now();
        let inFlight = false;
        let rvfcHandle: number | null = null;
        let rafHandle: number | null = null;

        const videoEl = v as HTMLVideoElement & {
          requestVideoFrameCallback?: (callback: (now: number, metadata: { captureTime?: number; expectedDisplayTime?: number }) => void) => number;
          cancelVideoFrameCallback?: (handle: number) => void;
        };
        const hasRvfc = typeof videoEl.requestVideoFrameCallback === "function";

        // Pre-allocated crop rectangle to prevent 30/60fps heap allocations
        const normTargetCropRect = { x: 0, y: 0, width: 1, height: 1 };

        const processTick = (
          now: DOMHighResTimeStamp,
          metadata?: { captureTime?: number; expectedDisplayTime?: number }
        ) => {
          if (destroyed) return;

          // Track rVFC sensor-to-presentation latency if metadata is present
          if (
            metadata &&
            typeof metadata.captureTime === "number" &&
            typeof metadata.expectedDisplayTime === "number"
          ) {
            const sensorLatency = metadata.expectedDisplayTime - metadata.captureTime;
            if (sensorLatency > 0 && sensorLatency < 1000) {
              diagnostics.recordRvfcLatency(sensorLatency);
            }
          }

          // If viewfinder is frozen for capture / review, or page is hidden, pause rendering
          if (
            isFrozenRef.current ||
            (typeof document !== "undefined" && document.visibilityState === "hidden")
          ) {
            scheduleNext();
            return;
          }

          // One frame in flight: drop stale frames if previous render is still executing
          if (inFlight) {
            scheduleNext();
            return;
          }

          const delta = now - lastTime;
          lastTime = now;

          const ctrl = perfControllerRef.current;
          if (ctrl && delta > 0) {
            ctrl.recordFrame(delta, now, isCapturingRef.current, isGesturingRef.current);

            // Throttle React state telemetry to at most once per 2 seconds
            if (now - lastFpsUpdateRef.current > 2000) {
              lastFpsUpdateRef.current = now;
              const { measuredFps: curFps } = ctrl.getTelemetry();
              setMeasuredFps(curFps);
              setQualityTierState(ctrl.getTier());
            }
          }

          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && lookPipelineRef.current) {
            setStarting(false);
            setRestarting(false);

            inFlight = true;

            const config = ctrl ? ctrl.getConfig() : null;
            const longEdge = config ? config.previewLongEdge : 1280;
            const vw = v.videoWidth;
            const vh = v.videoHeight;
            // Native sensor baseline: 3:4 in portrait or 4:3 in landscape
            const isLandscape = vw > vh;
            const previewBaselineAspect: CameraAspect = isLandscape ? "4:3" : "3:4";
            const effectiveDigitalZoom = Math.max(1, digitalZoomRef.current);

            const targetCrop = cropForAspectAndZoom(vw, vh, previewBaselineAspect, effectiveDigitalZoom);
            const out = fitLongestEdge(targetCrop.sw, targetCrop.sh, longEdge);

            // Keep canvas backing buffer smooth; only change if long edge tier changed
            if (canvasRef.current && (canvasRef.current.width !== out.width || canvasRef.current.height !== out.height)) {
              canvasRef.current.width = out.width;
              canvasRef.current.height = out.height;
            }

            normTargetCropRect.x = targetCrop.sx / vw;
            normTargetCropRect.y = targetCrop.sy / vh;
            normTargetCropRect.width = targetCrop.sw / vw;
            normTargetCropRect.height = targetCrop.sh / vh;

            const isMirrored = actualFacingRef.current === "user" && mirrorFrontRef.current;
            const currentLook = activeLookRef.current;

            try {
              const swEV = exposureCompRange ? 0 : exposureCompValueRef.current;
              lookPipelineRef.current.render(v, currentLook, {
                width: out.width,
                height: out.height,
                isCapture: false,
                disableAnimatedGrain: config ? !config.animatedGrain : false,
                grainTickHz: config ? config.grainTickHz : 24,
                cropRect: normTargetCropRect,
                mirror: isMirrored,
                exposureCompensation: swEV,
              });
            } finally {
              inFlight = false;
            }
          }

          scheduleNext();
        };

        const scheduleNext = () => {
          if (destroyed) return;
          if (hasRvfc && typeof videoEl.requestVideoFrameCallback === "function") {
            rvfcHandle = videoEl.requestVideoFrameCallback((now, meta) => processTick(now, meta));
          } else {
            rafHandle = requestAnimationFrame((now) => processTick(now));
          }
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            lastTime = performance.now();
            scheduleNext();
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        scheduleNext();

        return () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          if (hasRvfc && rvfcHandle !== null && typeof videoEl.cancelVideoFrameCallback === "function") {
            videoEl.cancelVideoFrameCallback(rvfcHandle);
          }
          if (rafHandle !== null) cancelAnimationFrame(rafHandle);
        };
      });
    }

    return () => {
      destroyed = true;
      clearInterval(watchdogTimer);
      if (lookPipelineRef.current) lookPipelineRef.current.destroy();
      lookPipelineRef.current = null;
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("resize", sync);
      v.removeEventListener("canplay", ensurePlay);
      v.removeEventListener("playing", sync);
    };
  }, [stream]);

  const setZoom = useCallback((value: number) => {
    markGesturing();
    const currentZr = zoomRangeRef.current;
    const clamped = currentZr ? clampZoomToRange(value, currentZr) : value;
    setZoomValue(clamped);
    zoomQueue.current = zoomQueue.current
      .then(async () => {
        const t = streamRef.current?.getVideoTracks()[0];
        const zr = zoomRangeRef.current;
        if (!t) return;
        const targetVal = zr ? clampZoomToRange(value, zr) : value;
        const actionLabel = formatZoomActionLabel(targetVal, zr);
        const constraintStr = `applyConstraints({ advanced: [{ zoom: ${Number(targetVal.toFixed(2))} }] })`;
        try {
          await applyNativeZoom(t, targetVal, zr);
          const after = t.getSettings();
          setReportedTrackSettings(after);
          const reportedZoom =
            typeof (after as MediaTrackSettings & { zoom?: number }).zoom === "number"
              ? (after as MediaTrackSettings & { zoom?: number }).zoom!
              : null;
          diagnostics.logZoomAction({
            action: actionLabel,
            requestedValue: Number(targetVal.toFixed(2)),
            mechanism: "browser-zoom-constraint",
            opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
            streamRetained: true,
            previousDeviceIdRedacted: redactDeviceId(after.deviceId),
            activeDeviceIdRedacted: redactDeviceId(after.deviceId),
            activeDeviceLabel: t.label || "(unlabeled track)",
            constraintApplied: constraintStr,
            constraintStatus: "success",
            reportedZoomAfter: reportedZoom,
            supportedZoomRange: zr,
            effectiveAppDigitalCrop: Math.max(1, digitalZoomRef.current),
            resolutionAfter:
              after.width && after.height ? `${after.width}x${after.height}` : "unknown",
          });
        } catch (err) {
          const after = t.getSettings();
          setReportedTrackSettings(after);
          const reportedZoom =
            typeof (after as MediaTrackSettings & { zoom?: number }).zoom === "number"
              ? (after as MediaTrackSettings & { zoom?: number }).zoom!
              : null;
          const errMsg =
            err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          // If native zoom constraint failed for a >1x request, fall back to app digital crop so framing still matches request
          if (value > 1) {
            const fallbackCrop = clampZoomToRange(value, null);
            digitalZoomRef.current = fallbackCrop;
            setDigitalZoomState(fallbackCrop);
            setZoomValue(zr ? clampZoomToRange(1, zr) : 1);
          }
          diagnostics.logZoomAction({
            action: actionLabel,
            requestedValue: Number(targetVal.toFixed(2)),
            mechanism: "browser-zoom-constraint",
            opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
            streamRetained: true,
            previousDeviceIdRedacted: redactDeviceId(after.deviceId),
            activeDeviceIdRedacted: redactDeviceId(after.deviceId),
            activeDeviceLabel: t.label || "(unlabeled track)",
            constraintApplied: constraintStr,
            constraintStatus: "error",
            constraintError: errMsg,
            reportedZoomAfter: reportedZoom,
            supportedZoomRange: zr,
            effectiveAppDigitalCrop: Math.max(1, digitalZoomRef.current),
            resolutionAfter:
              after.width && after.height ? `${after.width}x${after.height}` : "unknown",
          });
        }
      })
      .catch(() => {});
  }, [markGesturing]);

  const setDigitalZoom = useCallback((value: number) => {
    markGesturing();
    const clamped = clampZoomToRange(value, null);
    const prevDigital = digitalZoomRef.current;
    digitalZoomRef.current = clamped;
    setDigitalZoomState(clamped);

    const zr = zoomRangeRef.current;
    // When native zoomRange is active, LensBar resets digitalZoom to 1 alongside setZoom(2/3).
    // Only log digital crop when digital zoom is actually used or when native zoomRange is absent.
    if (zr && clamped === 1 && prevDigital === 1) {
      return;
    }

    const t = streamRef.current?.getVideoTracks()[0];
    const settings = t?.getSettings();
    const reportedZoom =
      settings && typeof (settings as MediaTrackSettings & { zoom?: number }).zoom === "number"
        ? (settings as MediaTrackSettings & { zoom?: number }).zoom!
        : null;

    diagnostics.logZoomAction({
      action: formatZoomActionLabel(clamped, null),
      requestedValue: Number(clamped.toFixed(2)),
      mechanism: "app-digital-crop",
      opticalVerification: "DIGITAL_CROP_ONLY",
      streamRetained: true,
      previousDeviceIdRedacted: redactDeviceId(settings?.deviceId),
      activeDeviceIdRedacted: redactDeviceId(settings?.deviceId),
      activeDeviceLabel: t?.label || "(unlabeled track)",
      constraintApplied: `cropForAspectAndZoom(effectiveDigitalZoom=${Number(clamped.toFixed(2))})`,
      constraintStatus: "not-applicable",
      reportedZoomAfter: reportedZoom,
      supportedZoomRange: zr,
      effectiveAppDigitalCrop: Number(clamped.toFixed(2)),
      resolutionAfter:
        settings?.width && settings?.height
          ? `${settings.width}x${settings.height}`
          : "unknown",
    });
  }, [markGesturing]);

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

  const setTorchSafe = useCallback(async (on: boolean) => {
    torchQueueRef.current = torchQueueRef.current.then(async () => {
      const t = streamRef.current?.getVideoTracks()[0];
      if (!t) return;
      try {
        const caps = (t.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (!caps.torch) return;
        await t.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
        setTorchOn(on);
      } catch {
        // Silently swallow errors on unsupported hardware or drivers
      }
    });
    return torchQueueRef.current;
  }, []);

  const pulseTorchSafe = useCallback(async (durationMs: number) => {
    await setTorchSafe(true);
    await new Promise((r) => setTimeout(r, durationMs));
    await setTorchSafe(false);
  }, [setTorchSafe]);

  const setActiveLook = useCallback((look: LookRecipe) => {
    setActiveLookState(look);
  }, []);

  const setExposureCompensation = useCallback(
    async (ev: number) => {
      markGesturing();
      const t = streamRef.current?.getVideoTracks()[0];
      const min = exposureCompRange?.min ?? -2.0;
      const max = exposureCompRange?.max ?? 2.0;
      const clamped = Math.max(min, Math.min(max, ev));
      exposureCompValueRef.current = clamped;
      setExposureCompValue(clamped);
      if (t && exposureCompRange) {
        await applyExposureCompensation(t, clamped);
      }
    },
    [exposureCompRange, markGesturing]
  );

  const unfreezeViewfinder = useCallback(() => {
    isFrozenRef.current = false;
  }, []);

    const capture = useCallback(
      (
        aspectOverride?: CameraAspect,
        shotSeed = Math.floor(Math.random() * 100000),
        mirrorOverride?: boolean,
        onPreviewReady?: (preview: ImageBitmap | Blob) => void,
        callbacks?: {
          onScreenFlash?: (active: boolean) => void;
          onShutterSnap?: () => void;
        }
      ): Promise<{ filteredBlob: Blob; originalBlob: Blob }> & { abort: () => void } => {
        const v = videoRef.current;
        const c = canvasRef.current;
        const track = streamRef.current?.getVideoTracks()[0];
        if (!v || !streamRef.current || v.readyState < 2) throw new Error("camera not ready");
        isCapturingRef.current = true;
        const targetAspect = aspectOverride || cameraAspect;
        const isMirrored = mirrorOverride !== undefined ? mirrorOverride : (actualFacingRef.current === "user" && mirrorFrontRef.current);

        // Independent AbortController for this specific capture
        const abortCtrl = new AbortController();

        const runCapture = async (): Promise<{ filteredBlob: Blob; originalBlob: Blob }> => {
          // Determine whether flash is required
          const isEnvironment = actualFacingRef.current === "environment" || facing === "environment";
          const isUser = actualFacingRef.current === "user" || facing === "user";
          const hasHardwareTorch = isEnvironment && !!track && hasTorch(track);

        let shouldFireTorch = false;
        let shouldFireScreenFlash = false;

        if (flashMode === "on") {
          if (hasHardwareTorch) shouldFireTorch = true;
          else if (isUser) shouldFireScreenFlash = true;
          else if (isEnvironment && !hasHardwareTorch) shouldFireScreenFlash = true;
        } else if (flashMode === "auto") {
          const luminance = measureSceneLuminance(v);
          if (luminance < 0.28) {
            if (hasHardwareTorch) shouldFireTorch = true;
            else if (isUser) shouldFireScreenFlash = true;
            else if (isEnvironment && !hasHardwareTorch) shouldFireScreenFlash = true;
          }
        }
        let frozenSource: ImageBitmap | HTMLVideoElement | HTMLCanvasElement = v;
        let snapCanvasFallback: HTMLCanvasElement | null = null;
        let passedFrozenSourceToPreview = false;

        const takeFrameSnapshots = async (): Promise<{
          previewBmp: ImageBitmap | null;
          snapCanvas: HTMLCanvasElement | null;
        }> => {
          let previewBmp: ImageBitmap | null = null;
          let snapCanvas: HTMLCanvasElement | null = null;

          // 1. Snapshot from active in-DOM WebGL preview canvas (guaranteed hardware pixels & preserveDrawingBuffer)
          if (c && c.width > 0 && c.height > 0 && !isCanvasBlankOrBlack(c)) {
            try {
              // Create a 2D snapshot canvas to guarantee pixels stay preserved regardless of WebKit video lifecycle
              snapCanvas = document.createElement("canvas");
              snapCanvas.width = c.width;
              snapCanvas.height = c.height;
              const sCtx = snapCanvas.getContext("2d");
              if (sCtx) {
                sCtx.drawImage(c, 0, 0);
              }
              const crop = cropForAspectAndZoom(c.width, c.height, targetAspect, 1);
              if (snapCanvas && !isCanvasBlankOrBlack(snapCanvas)) {
                previewBmp = await createImageBitmap(snapCanvas, crop.sx, crop.sy, crop.sw, crop.sh);
              } else {
                previewBmp = await createImageBitmap(c, crop.sx, crop.sy, crop.sw, crop.sh);
              }
            } catch {
              try {
                previewBmp = await createImageBitmap(c).catch(() => null);
              } catch {}
            }
          }

          // 2. If WebGL preview was blank or failed, attempt createImageBitmap directly from video
          if (!previewBmp && typeof createImageBitmap === "function") {
            try {
              const vw = v.videoWidth || 1920;
              const vh = v.videoHeight || 1080;
              const crop = cropForAspectAndZoom(vw, vh, targetAspect, 1);
              previewBmp = await createImageBitmap(v, crop.sx, crop.sy, crop.sw, crop.sh);
            } catch {
              // fallback
            }
          }

          return { previewBmp, snapCanvas };
        };

        if (!shouldFireTorch && !shouldFireScreenFlash) {
          // --- Non-flash Instant Capture Pipeline (< 80ms) ---
          // 1. Snapshot video and canvas synchronously BEFORE freezing RAF loop
          const { previewBmp, snapCanvas } = await takeFrameSnapshots();
          snapCanvasFallback = snapCanvas;
          // Prefer live video stream for full sensor resolution (2560px on iOS, 3840px on Android);
          // if video texture extraction produces black, archival pass will automatically recover from snapCanvasFallback
          frozenSource = v;

          // 2. Freeze viewfinder immediately
          isFrozenRef.current = true;
          callbacks?.onShutterSnap?.();

          if (previewBmp && onPreviewReady) {
            diagnostics.recordMark("t3");
            onPreviewReady(previewBmp);
          }

          diagnostics.recordMark("t2");

          // 3. Yield to main thread so ReviewModal mounts, paints, and records t4 (< 100ms budget)
          await new Promise((r) => setTimeout(r, 60));
          if (abortCtrl.signal.aborted) {
            throw new DOMException("Capture aborted", "AbortError");
          }
        } else {
          // --- Flash Illuminated Capture Pipeline (Deterministic Pre-Flash Metering & Convergence) ---
          let previewBmp: ImageBitmap | null = null;
          const isSoft = flashIntensity === "soft";

          if (shouldFireTorch && track) {
            // 1. Ignite torch and lock hardware negative exposure bias (-0.5 EV) atomically
            const biasEV = isSoft ? -0.7 : -0.5;
            await applyFlashConstraints(track, { torch: true, exposureBiasEV: biasEV });

            // 2. Pre-flash metering & convergence loop with Safeguard #1:
            // Minimum 240ms hardware warmup floor before checking Delta < 5% luminance stability
            const tStart = performance.now();
            const baselineLuma = measureSceneLuminance(v, 16);
            let prevLuma = baselineLuma;
            const warmupFloor = 240;
            const maxTimeout = isSoft ? 400 : 520;

            await new Promise<void>((resolve) => {
              let animId: number;
              const checkConvergence = () => {
                if (abortCtrl.signal.aborted) {
                  resolve();
                  return;
                }
                const elapsed = performance.now() - tStart;
                const currentLuma = measureSceneLuminance(v, 16);

                // Enforce minimum 240ms warmup floor before checking stability
                if (elapsed >= warmupFloor) {
                  const delta = Math.abs(currentLuma - prevLuma) / Math.max(0.01, prevLuma);
                  if (delta < 0.05 || elapsed >= maxTimeout) {
                    resolve();
                    return;
                  }
                } else if (elapsed >= maxTimeout) {
                  resolve();
                  return;
                }
                prevLuma = currentLuma;
                animId = requestAnimationFrame(checkConvergence);
              };
              animId = requestAnimationFrame(checkConvergence);
            });

            // 3. Readout frame pixels with torch GUARANTEED ON
            const snap = await takeFrameSnapshots();
            previewBmp = snap.previewBmp;
            snapCanvasFallback = snap.snapCanvas;
            frozenSource = v;

            // 4. Guaranteed Post-Readout Release: 60ms guard tick before turning torch off
            await new Promise((r) => setTimeout(r, 60));
            try {
              await applyFlashConstraints(track, { torch: false, exposureBiasEV: 0 });
            } catch (err) {
              console.warn("Failed to release flash constraints:", err);
            }
          } else if (shouldFireScreenFlash) {
            // Front camera screen flash
            callbacks?.onScreenFlash?.(true);
            const tStart = performance.now();
            const warmupFloor = 240;
            const maxTimeout = isSoft ? 360 : 480;

            await new Promise<void>((resolve) => {
              let animId: number;
              const checkScreen = () => {
                if (abortCtrl.signal.aborted) {
                  resolve();
                  return;
                }
                const elapsed = performance.now() - tStart;
                if (elapsed >= warmupFloor || elapsed >= maxTimeout) {
                  resolve();
                  return;
                }
                animId = requestAnimationFrame(checkScreen);
              };
              animId = requestAnimationFrame(checkScreen);
            });

            try {
              const snap = await takeFrameSnapshots();
              previewBmp = snap.previewBmp;
              snapCanvasFallback = snap.snapCanvas;
              frozenSource = v;
            } finally {
              callbacks?.onScreenFlash?.(false);
            }
          }

          // Freeze viewfinder on the illuminated scene
          isFrozenRef.current = true;

          // Trigger shutter snap animation and audio
          callbacks?.onShutterSnap?.();

          diagnostics.recordMark("t2");

          // Pass preview bitmap to preview callback
          if (previewBmp && onPreviewReady) {
            diagnostics.recordMark("t3");
            onPreviewReady(previewBmp);
          }
        }

        if (abortCtrl.signal.aborted) {
          if (frozenSource instanceof ImageBitmap && !passedFrozenSourceToPreview) frozenSource.close();
          throw new DOMException("Capture aborted", "AbortError");
        }

        try {
          // Yield so main thread paints and processes events
          await new Promise((r) => setTimeout(r, 20));
          if (abortCtrl.signal.aborted) {
            if (frozenSource instanceof ImageBitmap && !passedFrozenSourceToPreview) frozenSource.close();
            throw new DOMException("Capture aborted", "AbortError");
          }

          // Archival photos rendered at tier high resolution (max 2560px on iOS, 3840px elsewhere)
          const isIOS =
            typeof navigator !== "undefined" &&
            (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
          const safeMaxEdge = isIOS ? 2560 : 3840;

          const effectiveDigitalZoom = Math.max(1, digitalZoom);
          const swEV = exposureCompRange ? 0 : exposureCompValueRef.current;
          const isFromSnapCanvas = (frozenSource as unknown) === snapCanvasFallback;
          const flashIlluminated = shouldFireTorch || shouldFireScreenFlash;

          let filteredBlob: Blob;
          try {
            filteredBlob = await renderShot(frozenSource, {
              zoom: isFromSnapCanvas ? 1 : effectiveDigitalZoom,
              aspect: targetAspect,
              applyFilter: isFromSnapCanvas ? false : true,
              look: activeLook,
              seed: shotSeed,
              mirror: isFromSnapCanvas ? false : isMirrored,
              maxEdge: safeMaxEdge,
              quality: 0.92,
              exposureCompensation: swEV,
              flashUsed: flashIlluminated,
            });
          } catch (err) {
            console.warn("Archival filtered renderShot failed, falling back to clean render:", err);
            filteredBlob = await renderShot(frozenSource, {
              zoom: isFromSnapCanvas ? 1 : effectiveDigitalZoom,
              aspect: targetAspect,
              applyFilter: false,
              mirror: isFromSnapCanvas ? false : isMirrored,
              maxEdge: Math.min(safeMaxEdge, 1920),
              quality: 0.85,
              flashUsed: false,
            });
          }

          // Black-Blob Sanity Guard: If filteredBlob was black, recover from snapCanvasFallback
          if (filteredBlob && (await isBlobBlankOrBlack(filteredBlob)) && snapCanvasFallback) {
            console.warn("Archival filteredBlob was solid black, recovering from snapCanvasFallback");
            try {
              filteredBlob = await renderShot(snapCanvasFallback, {
                zoom: 1,
                aspect: targetAspect,
                applyFilter: false,
                look: activeLook,
                seed: shotSeed,
                mirror: false,
                maxEdge: safeMaxEdge,
                quality: 0.92,
                flashUsed: false,
              });
            } catch {}
          }

          await new Promise((r) => setTimeout(r, 20));

          let originalBlob: Blob;
          try {
            originalBlob = await renderShot(frozenSource, {
              zoom: isFromSnapCanvas ? 1 : effectiveDigitalZoom,
              aspect: targetAspect,
              applyFilter: false,
              mirror: isFromSnapCanvas ? false : isMirrored,
              maxEdge: safeMaxEdge,
              quality: 0.92,
              flashUsed: false,
            });
          } catch (err) {
            console.warn("Archival original renderShot failed, reusing filtered:", err);
            originalBlob = filteredBlob;
          }

          if (originalBlob && (await isBlobBlankOrBlack(originalBlob))) {
            originalBlob = filteredBlob;
          }

          diagnostics.recordMark("t5");
          return { filteredBlob, originalBlob };
        } finally {
          isCapturingRef.current = false;
          if (frozenSource instanceof ImageBitmap && !passedFrozenSourceToPreview) {
            frozenSource.close();
          }
        }
      };

      const capturePromise = runCapture() as Promise<{ filteredBlob: Blob; originalBlob: Blob }> & { abort: () => void };
      capturePromise.abort = () => {
        abortCtrl.abort();
      };
      return capturePromise;
    },
      [digitalZoom, cameraAspect, activeLook, flashMode, flashIntensity, facing, mirrorFront, exposureCompRange]
    );

  const takeOverCamera = useCallback(async () => {
    setError(null);
    isYieldedToOtherTabRef.current = false;
    setIsYieldedToOtherTab(false);
    if (streamRef.current) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setStream(null);
    }
    const coordinator = getCameraCoordinator();
    await coordinator.claimCamera(300);
    await runRef.current();
  }, []);

  return {
    videoRef,
    canvasRef,
    live: !!stream && !error && !isYieldedToOtherTab,
    stream,
    trackSettings: reportedTrackSettings ?? stream?.getVideoTracks()[0]?.getSettings() ?? null,
    error,
    isYieldedToOtherTab,
    takeOverCamera,
    starting,
    restarting,
    measuredFps,
    previewTier: qualityTier,
    qualityTier,
    performanceMode,
    setPerformanceMode,
    aspect,
    cameraAspect,
    setCameraAspect,
    activeLook,
    setActiveLook,
    exposureCompSupported: true,
    exposureCompValue,
    exposureCompRange,
    setExposureCompensation,
    facing,
    flip: () => {
      if (starting || restarting) return;
      pendingPresetZoomRef.current = null;
      setLensChoice(undefined);
      setFacing((f) => (f === "environment" ? "user" : "environment"));
    },
    lenses,
    activeId,
    chooseLens: (id: string, targetPreset?: number) => {
      pendingPresetZoomRef.current = targetPreset ?? null;
      if (lensChoice === id) {
        void runRef.current();
      } else {
        setLensChoice(id);
      }
    },
    zoomRange,
    zoom,
    setZoom,
    digitalZoom,
    setDigitalZoom,
    torchAvailable: torchAvailable && facing === "environment",
    hasHardwareFlash: hasHardwareFlash && facing === "environment",
    torchOn,
    toggleTorch,
    setTorchSafe,
    pulseTorchSafe,
    flashMode,
    setFlashMode,
    flashIntensity,
    setFlashIntensity,
    capture,
    unfreezeViewfinder,
    retry: () => void runRef.current(),
    hasTrack: () => !!streamRef.current?.getVideoTracks()[0],
  };
}
