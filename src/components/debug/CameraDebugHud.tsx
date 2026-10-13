"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  diagnostics,
  getOpticalStatusNotice,
  redactDeviceId,
  redactTrackSettings,
  type DiagnosticsState,
  type OpticalVerificationStatus,
} from "@/lib/camera/diagnostics";
import type { ZoomRange } from "@/lib/camera/caps";
import type { ViewportLayout } from "@/lib/camera/useViewportLayout";

interface CameraDebugHudProps {
  layout: ViewportLayout;
  stream: MediaStream | null;
  trackSettings?: MediaTrackSettings | null;
  exposureCompensation?: number;
  zoom?: number;
  nativeZoom?: number;
  digitalZoom?: number;
  zoomRange?: ZoomRange | null;
  facing?: "user" | "environment";
  measuredFps?: number;
  onClose?: () => void;
}

export function CameraDebugHud({
  layout,
  stream,
  trackSettings,
  exposureCompensation,
  zoom,
  nativeZoom,
  digitalZoom,
  zoomRange,
  measuredFps,
  onClose,
}: CameraDebugHudProps) {
  const [diagState, setDiagState] = useState<DiagnosticsState>(() => diagnostics.getState());
  const [permissionState, setPermissionState] = useState<string>(() =>
    typeof navigator !== "undefined" && typeof navigator.permissions?.query === "function"
      ? "querying..."
      : "unsupported"
  );
  const [copied, setCopied] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    return diagnostics.subscribe(setDiagState);
  }, []);

  // Query Permissions API
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && typeof navigator.permissions?.query === "function") {
      navigator.permissions.query({ name: "camera" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          setPermissionState(status.state);
          status.onchange = () => {
            if (!cancelled) setPermissionState(status.state);
          };
        })
        .catch(() => {
          if (!cancelled) setPermissionState("unsupported");
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const track = stream?.getVideoTracks()[0];
  const liveSettings = track?.getSettings() ?? trackSettings ?? null;
  const reportedZoom =
    liveSettings && typeof (liveSettings as MediaTrackSettings & { zoom?: number }).zoom === "number"
      ? (liveSettings as MediaTrackSettings & { zoom?: number }).zoom!
      : null;
  const effectiveDigitalCrop = zoomRange ? 1 : (digitalZoom ?? 1);

  const currentOpticalStatus: OpticalVerificationStatus = useMemo(() => {
    if (diagState.lastZoomAction) {
      return diagState.lastZoomAction.opticalVerification;
    }
    if (!zoomRange && (digitalZoom ?? 1) > 1) {
      return "DIGITAL_CROP_ONLY";
    }
    return "CANNOT_VERIFY_FROM_BROWSER_API";
  }, [diagState.lastZoomAction, zoomRange, digitalZoom]);

  const opticalNotice = getOpticalStatusNotice(currentOpticalStatus);
  const stats = diagnostics.getShutterStats();

  const vfRatio = layout.viewfinderRect.height > 0
    ? layout.viewfinderRect.width / layout.viewfinderRect.height
    : 0;
  const ratioDelta = Math.abs(vfRatio - 0.75);
  const ratioPass = ratioDelta <= 0.005;

  const copyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      permission: permissionState,
      opticalVerificationNotice: {
        status: currentOpticalStatus,
        explanation: opticalNotice,
        disclaimer:
          "Browser APIs (getUserMedia, getCapabilities, getSettings, applyConstraints) do not expose physical lens switching inside a logical multi-camera stream. Do not treat a successful zoom constraint as proof of optical telephoto usage.",
      },
      zoomComparison: {
        actualTrackReported: {
          redactedDeviceId: redactDeviceId(liveSettings?.deviceId),
          trackLabel: track?.label || "(unlabeled track)",
          facingMode: liveSettings?.facingMode ?? null,
          width: liveSettings?.width ?? null,
          height: liveSettings?.height ?? null,
          frameRate: liveSettings?.frameRate ?? null,
          reportedZoom,
          supportedZoomRange: zoomRange ?? null,
        },
        appRequestedState: {
          uiDisplayZoom: zoom ?? 1,
          requestedNativeZoom: nativeZoom ?? 1,
          requestedDigitalZoom: digitalZoom ?? 1,
          effectiveCanvasDigitalCrop: effectiveDigitalCrop,
          lastMechanism: diagState.lastZoomAction?.mechanism ?? "base-1x",
        },
      },
      enumeratedVideoInputs: diagState.videoInputs,
      zoomActionHistory: diagState.zoomHistory,
      track: {
        readyState: track?.readyState ?? "no-track",
        muted: track?.muted ?? null,
        enabled: track?.enabled ?? null,
        settings: redactTrackSettings(liveSettings, track?.label),
        measuredFps,
      },
      viewfinder: {
        width: layout.viewfinderRect.width,
        height: layout.viewfinderRect.height,
        measuredRatio: vfRatio,
        targetRatio: 0.75,
        ratioDelta,
        ratioPass,
        top: layout.viewfinderRect.top,
        left: layout.viewfinderRect.left,
      },
      shutterStats: stats,
      recentShots: diagState.shutterHistory.slice(-5),
      recentEvents: diagState.lifecycleEvents.slice(-20),
      invariantViolations: diagState.invariantViolations,
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed top-14 right-3 z-50 px-2.5 py-1 bg-black/85 text-amber-400 border border-amber-500/50 rounded-md text-xs font-mono backdrop-blur-md shadow-lg"
      >
        HUD [{zoom?.toFixed(1) ?? "1.0"}x | {measuredFps ?? "--"}fps]
      </button>
    );
  }

  return (
    <aside
      aria-label="Camera Debug HUD"
      className="fixed inset-x-2 top-14 max-h-[56vh] z-50 bg-black/92 text-zinc-200 border border-zinc-700/80 rounded-xl p-3 font-mono text-[11px] overflow-y-auto backdrop-blur-md shadow-2xl flex flex-col gap-2.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 sticky top-0 bg-black/95 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-amber-400 uppercase tracking-wider">Zoom &amp; Lens Debug HUD</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyReport}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 active:scale-95 transition-transform"
          >
            {copied ? "Copied!" : "Copy Report"}
          </button>
          <button
            onClick={() => setMinimized(true)}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
          >
            _
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-0.5 rounded bg-red-950 text-red-300 hover:bg-red-900"
            >
              X
            </button>
          )}
        </div>
      </div>

      {/* Explicit Optical vs. Digital Verification Banner */}
      <div className="p-2 rounded bg-amber-950/50 border border-amber-600/50 text-[10px] leading-snug">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-bold text-amber-300 uppercase">Optical Lens Verification</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-900/70 text-amber-200 font-semibold text-[9.5px]">
            {currentOpticalStatus}
          </span>
        </div>
        <p className="text-amber-100/90">{opticalNotice}</p>
      </div>

      {/* Actual Track Settings vs. App Requested Zoom State */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        {/* Actual Browser Track Settings & Capabilities */}
        <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
          <span className="text-zinc-400 font-semibold text-[10px]">ACTUAL TRACK (REPORTED)</span>
          <div className="truncate" title={track?.label || "(unlabeled)"}>
            Label: <span className="text-zinc-200">{track?.label || "(unlabeled)"}</span>
          </div>
          <div>
            Device ID: <span className="text-amber-300">{redactDeviceId(liveSettings?.deviceId)}</span>
          </div>
          <div>
            Facing: <span className="text-zinc-300">{liveSettings?.facingMode ?? "--"}</span> | State:{" "}
            <span className={track?.readyState === "live" ? "text-emerald-400 font-bold" : "text-red-400"}>
              {track?.readyState ?? "none"}
            </span>
          </div>
          <div>
            Res: <span className="text-zinc-200">{liveSettings?.width ?? "--"}x{liveSettings?.height ?? "--"}</span> @{" "}
            {measuredFps ?? 0}fps
          </div>
          <div>
            Cap Zoom Range:{" "}
            {zoomRange ? (
              <span className="text-emerald-300 font-semibold">
                {zoomRange.min}..{zoomRange.max}x (step {zoomRange.step})
              </span>
            ) : (
              <span className="text-amber-400">unsupported</span>
            )}
          </div>
          <div>
            Reported <code className="text-zinc-400">getSettings().zoom</code>:{" "}
            <span className="text-cyan-300 font-bold">
              {reportedZoom !== null ? `${reportedZoom.toFixed(2)}x` : "unreported"}
            </span>
          </div>
        </div>

        {/* App Requested Zoom & Crop State */}
        <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
          <span className="text-zinc-400 font-semibold text-[10px]">APP ZOOM STATE (REQUESTED)</span>
          <div>
            UI Display Zoom: <span className="text-amber-300 font-bold">{zoom?.toFixed(2) ?? "1.00"}x</span>
          </div>
          <div>
            Req Native <code className="text-zinc-400">zoom</code>:{" "}
            <span className="text-zinc-200">{nativeZoom?.toFixed(2) ?? "1.00"}x</span>{" "}
            <span className="text-zinc-500">({zoomRange ? "active" : "inactive"})</span>
          </div>
          <div>
            Req <code className="text-zinc-400">digitalZoom</code>:{" "}
            <span className="text-zinc-200">{digitalZoom?.toFixed(2) ?? "1.00"}x</span>
          </div>
          <div>
            Effective Canvas Crop:{" "}
            <span className={effectiveDigitalCrop > 1 ? "text-purple-300 font-bold" : "text-zinc-300"}>
              {effectiveDigitalCrop.toFixed(2)}x
            </span>
          </div>
          <div>
            Mechanism:{" "}
            <span className="text-cyan-300 font-semibold">
              {diagState.lastZoomAction?.mechanism ?? (zoomRange ? "browser-zoom-constraint" : "base-1x")}
            </span>
          </div>
          <div>
            Perm: <span className="text-zinc-300">{permissionState}</span> | EV:{" "}
            <span className="text-zinc-300">{exposureCompensation?.toFixed(1) ?? "--"}</span>
          </div>
        </div>
      </div>

      {/* Enumerated Video Inputs (After Permission) */}
      <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 font-semibold text-[10px]">
            ENUMERATED VIDEO INPUTS ({diagState.videoInputs.length})
          </span>
          <span className="text-zinc-500 text-[9.5px]">IDs redacted</span>
        </div>
        <div className="max-h-28 overflow-y-auto flex flex-col gap-1 text-[9.5px]">
          {diagState.videoInputs.map((input) => (
            <div
              key={`${input.index}-${input.redactedId}`}
              className={`flex flex-wrap items-center justify-between gap-1 px-1.5 py-1 rounded border ${
                input.isActive
                  ? "bg-emerald-950/60 border-emerald-600/60 text-emerald-200"
                  : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-zinc-300">#{input.index}</span>
                {input.isActive && (
                  <span className="px-1 py-0.2 rounded bg-emerald-600 text-black font-bold text-[8.5px]">
                    ACTIVE
                  </span>
                )}
                <span className="truncate font-medium" title={input.label}>
                  {input.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[9px] shrink-0">
                <span className="text-amber-300/90">id:{input.redactedId}</span>
                <span className="text-zinc-400">
                  {input.classifiedFacing}/{input.classifiedKind}
                </span>
                <span className={input.inPicker ? "text-cyan-300" : "text-zinc-600"}>
                  {input.inPicker ? "picker:yes" : "picker:no"}
                </span>
              </div>
            </div>
          ))}
          {diagState.videoInputs.length === 0 && (
            <span className="text-zinc-600 italic">No videoinput devices enumerated yet</span>
          )}
        </div>
      </div>

      {/* Zoom & Lens Action Log */}
      <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 font-semibold text-[10px]">
            ZOOM &amp; LENS ACTION LOG ({diagState.zoomHistory.length})
          </span>
          <span className="text-zinc-500 text-[9.5px]">0.5x / 1x / 2x / 3x / pinch</span>
        </div>
        <div className="max-h-36 overflow-y-auto flex flex-col gap-1 text-[9.5px]">
          {diagState.zoomHistory
            .slice()
            .reverse()
            .map((entry, idx) => (
              <div
                key={`${entry.timestamp}-${idx}`}
                className="p-1.5 rounded bg-zinc-950/70 border border-zinc-800/80 flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">{entry.timeStr}</span>
                    <span className="px-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                      {entry.action}
                    </span>
                    <span className="text-zinc-300">req:{entry.requestedValue}x</span>
                    <span
                      className={`px-1 rounded font-semibold ${
                        entry.mechanism === "camera-switch"
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-700/50"
                          : entry.mechanism === "browser-zoom-constraint"
                          ? "bg-amber-950 text-amber-300 border border-amber-700/50"
                          : entry.mechanism === "app-digital-crop"
                          ? "bg-purple-950 text-purple-300 border border-purple-700/50"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {entry.mechanism}
                    </span>
                  </div>
                  <span
                    className={`font-bold ${
                      entry.constraintStatus === "success"
                        ? "text-emerald-400"
                        : entry.constraintStatus === "error"
                        ? "text-red-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {entry.constraintStatus === "not-applicable" ? "no-constraint" : entry.constraintStatus}
                  </span>
                </div>
                <div className="text-zinc-400 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px]">
                  <span>{entry.streamRetained ? "stream:retained" : "stream:switched"}</span>
                  <span>dev:{entry.activeDeviceIdRedacted}</span>
                  <span>
                    repZoom:{entry.reportedZoomAfter !== null ? `${entry.reportedZoomAfter}x` : "null"}
                  </span>
                  <span>crop:{entry.effectiveAppDigitalCrop}x</span>
                  <span>res:{entry.resolutionAfter}</span>
                </div>
                {entry.constraintError && (
                  <div className="text-red-400 font-semibold text-[9px]">
                    Error: {entry.constraintError}
                  </div>
                )}
              </div>
            ))}
          {diagState.zoomHistory.length === 0 && (
            <span className="text-zinc-600 italic">No zoom actions recorded yet</span>
          )}
        </div>
      </div>

      {/* Viewfinder Geometry & Shutter Timing */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
          <span className="text-zinc-400 font-semibold text-[10px]">VIEWFINDER GEOMETRY</span>
          <div>
            Rect: <span className="text-zinc-300">{layout.viewfinderRect.width.toFixed(1)} x {layout.viewfinderRect.height.toFixed(1)}</span>
          </div>
          <div>
            Ratio:{" "}
            <span className={ratioPass ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
              {vfRatio.toFixed(4)}
            </span>{" "}
            [{ratioPass ? "PASS" : "FAIL"}]
          </div>
        </div>

        <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 font-semibold text-[10px]">SHUTTER TIMING</span>
            <span className="text-zinc-500 text-[9.5px]">{stats.count} shots</span>
          </div>
          <div>
            T1 p50: <span className="text-emerald-300 font-bold">{stats.t1_p50.toFixed(1)}ms</span> | T4 p50:{" "}
            <span className={stats.t4_p50 <= 250 ? "text-emerald-300 font-bold" : "text-amber-400 font-bold"}>
              {stats.t4_p50.toFixed(1)}ms
            </span>
          </div>
        </div>
      </div>

      {/* Lifecycle Event Log (Last 20) */}
      <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
        <span className="text-zinc-400 font-semibold text-[10px]">LIFECYCLE EVENTS (LAST 20)</span>
        <div className="max-h-24 overflow-y-auto flex flex-col gap-0.5 text-[9.5px]">
          {diagState.lifecycleEvents.slice(-20).map((evt, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-zinc-400 font-mono">
              <span className="text-zinc-600">{evt.timeStr}</span>
              <span className="text-amber-400/90 font-medium">{evt.type}</span>
              {evt.detail && <span className="text-zinc-400 truncate">: {evt.detail}</span>}
            </div>
          ))}
          {diagState.lifecycleEvents.length === 0 && (
            <span className="text-zinc-600 italic">No lifecycle events recorded yet</span>
          )}
        </div>
      </div>
    </aside>
  );
}
