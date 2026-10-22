"use client";

import React, { useState } from "react";
import type { DriveHealthResult, StorageGuardResult } from "@/lib/drive/health";

export interface ProductAnalyticsStats {
  recipeLeaderboard: Array<{
    id: string;
    name: string;
    keptCount: number;
    retakeCount: number;
    sharePercent: number;
  }>;
  funnel: {
    totalGuestsConsented: number;
    guestsShotAtLeastOnce: number;
    guestsCompletedRoll: number;
    totalKept: number;
    totalRetakes: number;
    keepToRetakeRatio: string;
  };
  reliability: {
    takePhotoCount: number;
    videoFrameCount: number;
    takePhotoPercent: number;
    videoFramePercent: number;
  };
}

export interface HealthTelemetryProps {
  storageGuard: StorageGuardResult;
  queueMetrics: {
    pendingPhotos: number;
    failedPhotos: number;
    confirmedPhotos: number;
    totalPhotos: number;
    failureRatePercent: number;
  };
  productAnalytics?: ProductAnalyticsStats;
  clientEventStats: {
    totalEvents: number;
    errorsCount: number;
    unhandledRejectionsCount: number;
    cameraFailuresCount: number;
    uploadFailuresCount: number;
    topBrowsers: Array<{ browser: string; count: number }>;
    topDevices: Array<{ device: string; count: number }>;
    recentEvents: Array<{
      id: string;
      type: string;
      message: string;
      route: string;
      browser: string;
      os: string;
      created_at: string;
    }>;
  };
  eventSlug: string;
}

export function HealthView({
  storageGuard,
  queueMetrics,
  productAnalytics,
  clientEventStats,
}: HealthTelemetryProps) {
  const [driveHealth, setDriveHealth] = useState<DriveHealthResult | null>(null);
  const [checkingDrive, setCheckingDrive] = useState(false);

  const runDriveTest = async () => {
    setCheckingDrive(true);
    try {
      const res = await fetch("/api/admin/drive-health", { method: "POST" });
      const data = await res.json();
      setDriveHealth(data);
    } catch {
      setDriveHealth({ ok: false, testUploadOk: false, error: "Network check failed" });
    } finally {
      setCheckingDrive(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-tight">System Health & Telemetry</h1>
          <p className="text-xs sm:text-sm text-zinc-400">Upload queue status, error logs, and storage diagnostics.</p>
        </div>

        <button
          type="button"
          onClick={runDriveTest}
          disabled={checkingDrive}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs font-mono tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          {checkingDrive ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
              <span>Verifying Drive…</span>
            </>
          ) : (
            <span>Run Drive Health Probe</span>
          )}
        </button>
      </div>

      {/* Drive Probe Banner */}
      {driveHealth && (
        <div
          className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
            driveHealth.ok && driveHealth.testUploadOk
              ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
              : "bg-amber-400/[0.08] border-amber-400/30 text-amber-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center shrink-0">
              {driveHealth.ok ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
            <div>
              <div className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">
                {driveHealth.ok ? "Google Drive Operational" : "Drive Probe Failed — Action Required"}
              </div>
              <div className="text-zinc-300 mt-0.5 text-xs">
                {driveHealth.userEmail ? `Connected Account: ${driveHealth.userEmail}` : driveHealth.error || "Probe completed"}
              </div>
              {!driveHealth.ok && (
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Tip: In Google Cloud Console &rarr; OAuth consent screen, set Publishing status to &ldquo;In Production&rdquo; to prevent 7-day token revocations.
                </p>
              )}
            </div>
          </div>
          {!driveHealth.ok && (
            <a
              href="/admin/connect-drive"
              className="h-8 px-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer self-start sm:self-center shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              <span>Reconnect Google Drive</span>
            </a>
          )}
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Upload Success Rate */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Upload Success Rate</div>
          <div className="text-2xl font-bold font-mono text-white">
            {(100 - queueMetrics.failureRatePercent).toFixed(1)}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {queueMetrics.confirmedPhotos} confirmed &bull; {queueMetrics.failedPhotos} failed
          </div>
        </div>

        {/* Queue Backlog */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Queue Backlog</div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {queueMetrics.pendingPhotos}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Photos in upload pipeline</div>
        </div>

        {/* Client Errors */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Client Crashes</div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {clientEventStats.errorsCount + clientEventStats.unhandledRejectionsCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {clientEventStats.cameraFailuresCount} camera permission denies
          </div>
        </div>

        {/* Storage Guard */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Drive Quota Used</div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {storageGuard.percentUsed.toFixed(1)}%
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            ~{storageGuard.estimatedPhotosRemaining.toLocaleString()} shots remaining
          </div>
        </div>
      </div>

      {/* Product & Filter Usage Analytics (Zero-Overhead) */}
      {productAnalytics && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800/80 pb-2">
            <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
              <span>Film Recipes & Guest Engagement Insights</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                0-Overhead UU PDP Safe
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Anonymous aggregate metrics tracking filter preferences, retake ratios, and camera hardware execution.
            </p>
          </div>

          {/* Funnel Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Consented Guests</div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {productAnalytics.funnel.totalGuestsConsented}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Passed consent gate</div>
            </div>

            <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Active Shooters</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {productAnalytics.funnel.guestsShotAtLeastOnce}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                {productAnalytics.funnel.totalGuestsConsented > 0
                  ? `${((productAnalytics.funnel.guestsShotAtLeastOnce / productAnalytics.funnel.totalGuestsConsented) * 100).toFixed(0)}% conversion`
                  : "0% conversion"}
              </div>
            </div>

            <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Roll Finishers</div>
              <div className="text-xl font-bold font-mono text-purple-400">
                {productAnalytics.funnel.guestsCompletedRoll}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Finished all shots</div>
            </div>

            <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Keep-to-Retake</div>
              <div className="text-xl font-bold font-mono text-sky-400">
                {productAnalytics.funnel.keepToRetakeRatio}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                {productAnalytics.funnel.totalKept} kept &bull; {productAnalytics.funnel.totalRetakes} retakes
              </div>
            </div>
          </div>

          {/* Leaderboard & Hardware Reliability Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Film Recipe Leaderboard */}
            <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400">
                  Most Popular Film Recipes
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">Kept / Retakes (% Share)</span>
              </div>

              {productAnalytics.recipeLeaderboard.length === 0 ? (
                <p className="text-xs text-zinc-500 font-mono py-4">No shots captured yet.</p>
              ) : (
                <div className="space-y-3">
                  {productAnalytics.recipeLeaderboard.map((item, idx) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400/80 font-bold w-4 text-center">#{idx + 1}</span>
                          <span className="text-zinc-200 font-semibold">{item.name}</span>
                        </div>
                        <div className="text-zinc-400 text-[11px]">
                          <span className="text-emerald-400 font-bold">{item.keptCount} kept</span>
                          {item.retakeCount > 0 && (
                            <span className="text-zinc-500 ml-1.5">({item.retakeCount} retakes)</span>
                          )}
                          <span className="text-amber-300 font-semibold ml-2">
                            {item.sharePercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(4, item.sharePercent))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hardware Capture Engine Reliability */}
            <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-4">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400">
                Camera Capture Engine Reliability
              </h3>

              <div className="space-y-4">
                <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 font-medium">Native ImageCapture (Hardware Stills)</span>
                    <span className="text-zinc-400 font-bold">
                      {productAnalytics.reliability.takePhotoCount} ({productAnalytics.reliability.takePhotoPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, productAnalytics.reliability.takePhotoPercent)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Highest optical resolution directly from device sensor pipeline.
                  </p>
                </div>

                <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 font-medium">Direct Video Frame Capture (Fallback)</span>
                    <span className="text-zinc-400 font-bold">
                      {productAnalytics.reliability.videoFrameCount} ({productAnalytics.reliability.videoFramePercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, productAnalytics.reliability.videoFramePercent)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Zero-lag stream rasterization ensuring universal compatibility across iOS Safari & Android browsers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Browsers & Devices Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Browsers */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-amber-400">Guest Browsers</h2>
          {clientEventStats.topBrowsers.length === 0 ? (
            <p className="text-xs text-zinc-500 font-mono">No telemetry recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {clientEventStats.topBrowsers.map((b) => (
                <div key={b.browser} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-300">{b.browser}</span>
                  <span className="text-zinc-500 font-bold">{b.count} visits</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device Classes */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-amber-400">Device Types</h2>
          {clientEventStats.topDevices.length === 0 ? (
            <p className="text-xs text-zinc-500 font-mono">No telemetry recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {clientEventStats.topDevices.map((d) => (
                <div key={d.device} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-300 uppercase">{d.device}</span>
                  <span className="text-zinc-500 font-bold">{d.count} devices</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Client Events Ledger */}
      <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-4">
        <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Recent Client Event Ledger</h2>
        {clientEventStats.recentEvents.length === 0 ? (
          <p className="text-xs text-zinc-500 font-mono">Clean ledger: zero client errors reported.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Message</th>
                  <th className="py-2 px-3">Route</th>
                  <th className="py-2 px-3">Browser / OS</th>
                  <th className="py-2 px-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300">
                {clientEventStats.recentEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-zinc-900/40">
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          evt.type === "error" || evt.type === "unhandledrejection"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : evt.type === "camera_fail"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {evt.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 max-w-sm truncate text-zinc-200" title={evt.message}>
                      {evt.message}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{evt.route}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{evt.browser} / {evt.os}</td>
                    <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
