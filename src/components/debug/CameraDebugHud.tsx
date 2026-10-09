"use client";

import React, { useEffect, useState, useMemo } from "react";
import { diagnostics, type DiagnosticsState } from "@/lib/camera/diagnostics";
import type { ViewportLayout } from "@/lib/camera/useViewportLayout";

interface CameraDebugHudProps {
  layout: ViewportLayout;
  stream: MediaStream | null;
  trackSettings?: MediaTrackSettings | null;
  exposureCompensation?: number;
  zoom?: number;
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
  facing,
  measuredFps,
  onClose,
}: CameraDebugHudProps) {
  const [diagState, setDiagState] = useState<DiagnosticsState>(() => diagnostics.getState());
  const [permissionState, setPermissionState] = useState<string>("querying...");
  const [copied, setCopied] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    return diagnostics.subscribe(setDiagState);
  }, []);

  // Query Permissions API
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
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
    } else {
      setPermissionState("unsupported");
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const track = stream?.getVideoTracks()[0];
  const stats = useMemo(() => diagnostics.getShutterStats(), [diagState.shutterHistory]);

  const vfRatio = layout.viewfinderRect.height > 0
    ? layout.viewfinderRect.width / layout.viewfinderRect.height
    : 0;
  const ratioDelta = Math.abs(vfRatio - 0.75);
  const ratioPass = ratioDelta <= 0.005;

  const copyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      permission: permissionState,
      track: {
        readyState: track?.readyState ?? "no-track",
        muted: track?.muted ?? null,
        enabled: track?.enabled ?? null,
        settings: track?.getSettings() ?? trackSettings ?? null,
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
        HUD [FPS: {measuredFps ?? "--"}]
      </button>
    );
  }

  return (
    <aside
      aria-label="Camera Debug HUD"
      className="fixed inset-x-2 top-14 max-h-[82vh] z-50 bg-black/92 text-zinc-200 border border-zinc-700/80 rounded-xl p-3 font-mono text-[11px] overflow-y-auto backdrop-blur-md shadow-2xl flex flex-col gap-2.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-amber-400 uppercase tracking-wider">Debug HUD</span>
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

      {/* Grid Status */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        {/* Stream & Track */}
        <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
          <span className="text-zinc-400 font-semibold text-[10px]">STREAM & TRACK</span>
          <div>Perm: <span className="text-amber-300 font-bold">{permissionState}</span></div>
          <div>Track: <span className={track?.readyState === "live" ? "text-emerald-400 font-bold" : "text-red-400"}>{track?.readyState ?? "none"}</span> (muted: {String(track?.muted ?? false)})</div>
          <div>Facing: <span className="text-zinc-300">{facing ?? "--"}</span></div>
          <div>Res: <span className="text-zinc-300">{trackSettings?.width ?? "--"}x{trackSettings?.height ?? "--"}</span> @ {measuredFps ?? 0}fps</div>
          <div>EV: <span className="text-zinc-300">{exposureCompensation?.toFixed(1) ?? "--"}</span> | Zoom: <span className="text-zinc-300">{zoom?.toFixed(2) ?? "1.0"}x</span></div>
        </div>

        {/* Viewfinder Geometry */}
        <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
          <span className="text-zinc-400 font-semibold text-[10px]">VIEWFINDER GEOMETRY</span>
          <div>Rect: <span className="text-zinc-300">{layout.viewfinderRect.width.toFixed(1)} x {layout.viewfinderRect.height.toFixed(1)}</span></div>
          <div>
            Ratio: <span className={ratioPass ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{vfRatio.toFixed(4)}</span> (target: 0.750)
          </div>
          <div>Delta: <span className={ratioPass ? "text-emerald-300" : "text-red-300"}>{ratioDelta.toFixed(5)}</span> [{ratioPass ? "PASS" : "FAIL"}]</div>
          <div>Density: <span className="text-zinc-300">{layout.density}</span> | Mode: <span className="text-zinc-300">{layout.mode}</span></div>
          <div>Top: <span className="text-zinc-400">{layout.viewfinderRect.top}px</span> | Bottom: <span className="text-zinc-400">{layout.bottomBarHeight}px</span></div>
        </div>
      </div>

      {/* Shutter Latency Breakdown */}
      <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 font-semibold text-[10px]">SHUTTER TIMING (BUDGET: T1 &le; 50ms, T4 &le; 250ms)</span>
          <span className="text-zinc-500 text-[10px]">{stats.count} shots</span>
        </div>
        <div className="grid grid-cols-3 gap-1 text-[10px] pt-1">
          <div>T1 Feedback p50: <span className="text-emerald-300 font-bold">{stats.t1_p50.toFixed(1)} ms</span></div>
          <div>T4 Review p50:   <span className={stats.t4_p50 <= 250 ? "text-emerald-300 font-bold" : "text-amber-400 font-bold"}>{stats.t4_p50.toFixed(1)} ms</span></div>
          <div>T4 Review p95:   <span className={stats.t4_p95 <= 400 ? "text-emerald-300 font-bold" : "text-red-400 font-bold"}>{stats.t4_p95.toFixed(1)} ms</span></div>
        </div>
        {diagState.lastMeasurement && (
          <div className="text-[10px] text-zinc-400 border-t border-zinc-800/80 mt-1 pt-1 flex flex-wrap gap-2">
            <span>Last shot:</span>
            <span>T1: <b className="text-zinc-200">{diagState.lastMeasurement.latencyT1?.toFixed(1) ?? "--"}ms</b></span>
            <span>T4: <b className="text-zinc-200">{diagState.lastMeasurement.latencyT4?.toFixed(1) ?? "--"}ms</b></span>
            {diagState.lastMeasurement.latencyKeepToLive && (
              <span>Keep&rarr;Live: <b className="text-zinc-200">{diagState.lastMeasurement.latencyKeepToLive.toFixed(1)}ms</b></span>
            )}
          </div>
        )}
      </div>

      {/* Lifecycle Event Log (Last 20) */}
      <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1">
        <span className="text-zinc-400 font-semibold text-[10px]">LIFECYCLE EVENTS (LAST 20)</span>
        <div className="max-h-28 overflow-y-auto flex flex-col gap-0.5 text-[9.5px]">
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
