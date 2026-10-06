"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { DriveHealthResult } from "@/lib/drive/health";

interface DashboardViewProps {
  event: {
    id: string;
    slug: string;
    couple_names: string;
    shots_per_guest: number;
    opens_at: string | null;
    closes_at: string | null;
    manually_closed: boolean;
    drive_root_folder_id: string | null;
  };
  metrics: {
    totalGuests: number;
    confirmedCount: number;
    failedCount: number;
    pendingCount: number;
    totalSizeBytes: number;
    avgSizeBytes?: number;
    tierMix?: {
      original: number;
      high: number;
      standard: number;
      lite: number;
    };
    estimatedPhotosRemaining?: number;
    currentTier?: string;
    percentUsed?: number;
    remainingBytes?: number;
    storageWarning?: boolean;
    storageMessage?: string;
  };
  recentPhotos: Array<{
    id: string;
    guestName: string;
    shot_id: string;
    status: string;
    size_bytes: number | null;
    created_at: string;
    tier?: string;
    source?: string;
  }>;
}

export function DashboardView({
  event,
  metrics,
  recentPhotos,
}: DashboardViewProps) {
  const [health, setHealth] = useState<DriveHealthResult | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  async function runHealthCheck() {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/admin/drive-health");
      const data = (await res.json()) as DriveHealthResult;
      setHealth(data);
    } catch (e) {
      setHealth({ ok: false, testUploadOk: false, error: String(e) });
    } finally {
      setCheckingHealth(false);
    }
  }

  // Drive quota estimation (400 GB plan)
  const quotaLimitBytes = 400 * 1024 * 1024 * 1024; // 400 GB
  const totalGB = (metrics.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
  const totalMB = (metrics.totalSizeBytes / (1024 * 1024)).toFixed(1);
  const actualPercentUsed = typeof metrics.percentUsed === "number"
    ? metrics.percentUsed.toFixed(1)
    : Math.min(100, (metrics.totalSizeBytes / quotaLimitBytes) * 100).toFixed(2);

  const isEventOpen =
    !event.manually_closed &&
    (!event.opens_at || new Date() >= new Date(event.opens_at)) &&
    (!event.closes_at || new Date() <= new Date(event.closes_at));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* 85% Storage Alert Banner */}
      {metrics.storageWarning && (
        <div className="mb-6 p-4 rounded-xl bg-amber-950/80 border border-amber-600 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-bold text-amber-300">Google Drive Storage Alert (85%+ Full)</p>
              <p>{metrics.storageMessage || "Drive storage is over 85% full. Uploads will automatically pause at 98%."}</p>
            </div>
          </div>
          <Link href="/admin/connect-drive" className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-amber-300">
            Check Quota
          </Link>
        </div>
      )}

      {/* Event Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              {event.couple_names}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                isEventOpen
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              }`}
            >
              {isEventOpen ? "Camera Open" : "Camera Closed"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Event Slug: <span className="text-amber-400 font-semibold">{event.slug}</span> &bull; {event.shots_per_guest} shots per guest
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/e/${event.slug}`}
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 transition-all flex items-center gap-1.5"
          >
            <span>Guest Camera</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-zinc-400">
              <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h4a.75.75 0 0 1 0 1.5h-4Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
            </svg>
          </Link>
          <Link
            href="/admin/qr"
            className="px-3.5 py-2 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h2.5A2.25 2.25 0 0 1 10 4.25v2.5A2.25 2.25 0 0 1 7.75 9h-2.5A2.25 2.25 0 0 1 3 6.75v-2.5Zm2.25-.75a.75.75 0 0 0-.75.75v2.5c0 .414.336.75.75.75h2.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5ZM3 13.25A2.25 2.25 0 0 1 5.25 11h2.5A2.25 2.25 0 0 1 10 13.25v2.5A2.25 2.25 0 0 1 7.75 18h-2.5A2.25 2.25 0 0 1 3 15.75v-2.5Zm2.25-.75a.75.75 0 0 0-.75.75v2.5c0 .414.336.75.75.75h2.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5ZM12.25 2A2.25 2.25 0 0 0 10 4.25v2.5A2.25 2.25 0 0 0 12.25 9h2.5A2.25 2.25 0 0 0 17 6.75v-2.5A2.25 2.25 0 0 0 14.75 2h-2.5Zm-.75 2.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.75-.75v-2.5ZM10.75 11a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm3 0a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Zm-3 4.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm6-4.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm0 3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            <span>Print QR Card</span>
          </Link>
        </div>
      </div>

      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Confirmed Photos */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Confirmed Photos
          </span>
          <p className="text-3xl font-serif font-bold text-white mt-1">
            {metrics.confirmedCount}
          </p>
          <div className="mt-3 flex items-center text-xs text-zinc-400">
            <span className="text-amber-400 font-medium">In Google Drive</span>
          </div>
        </div>

        {/* Total Guests */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Guests Registered
          </span>
          <p className="text-3xl font-serif font-bold text-white mt-1">
            {metrics.totalGuests}
          </p>
          <div className="mt-3 flex items-center text-xs text-zinc-400">
            <span>Avg {metrics.totalGuests > 0 ? (metrics.confirmedCount / metrics.totalGuests).toFixed(1) : 0} shots / guest</span>
          </div>
        </div>

        {/* Estimated Storage */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Drive Usage (400 GB)
            </span>
            <span className={`text-[11px] font-mono ${Number(actualPercentUsed) >= 85 ? "text-red-400" : "text-emerald-400"}`}>
              {actualPercentUsed}% used
            </span>
          </div>
          <p className="text-3xl font-serif font-bold text-white mt-1">
            {Number(totalGB) >= 1 ? `${totalGB} GB` : `${totalMB} MB`}
          </p>
          <div className="mt-3">
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  Number(actualPercentUsed) >= 85 ? "bg-red-400" : "bg-amber-400"
                }`}
                style={{ width: `${Math.max(1, Number(actualPercentUsed))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1 font-mono">
              <span>Avg: {metrics.avgSizeBytes ? `${(metrics.avgSizeBytes / (1024 * 1024)).toFixed(1)} MB` : "—"}</span>
              <span>~{metrics.estimatedPhotosRemaining ?? 0} photos left</span>
            </div>
          </div>
        </div>

        {/* Failed Uploads */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Failed Uploads
          </span>
          <p className={`text-3xl font-serif font-bold mt-1 ${metrics.failedCount > 0 ? "text-red-400" : "text-white"}`}>
            {metrics.failedCount}
          </p>
          <div className="mt-3 flex items-center text-xs text-zinc-400">
            {metrics.failedCount > 0 ? (
              <span className="text-red-400">Requires attention</span>
            ) : (
              <span className="text-emerald-400">0 errors logged</span>
            )}
          </div>
        </div>
      </div>

      {/* Drive Status & Health Card */}
      <div className="p-6 mb-8 rounded-2xl bg-zinc-950 border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              Google Drive Health & Storage
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live OAuth status and root wedding folder verification
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void runHealthCheck()}
              disabled={checkingHealth}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all cursor-pointer"
            >
              {checkingHealth ? "Testing Connection…" : "Run Live Health Check"}
            </button>
            {event.drive_root_folder_id && (
              <a
                href={`https://drive.google.com/drive/folders/${event.drive_root_folder_id}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 transition-all flex items-center gap-1"
              >
                <span>Open in Drive</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h4a.75.75 0 0 1 0 1.5h-4Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {health ? (
          <div className={`p-4 rounded-xl border ${health.ok ? "bg-zinc-900/60 border-zinc-800" : "bg-red-950/30 border-red-800"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold ${health.ok ? "text-emerald-400" : "text-red-400"}`}>
                {health.ok ? "✓ DRIVE CONNECTION FULLY OPERATIONAL" : "✕ DRIVE CONNECTION ISSUE"}
              </span>
              {health.userEmail && (
                <span className="text-xs font-mono text-zinc-400">{health.userEmail}</span>
              )}
            </div>

            {health.storageQuota && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono text-zinc-300 pt-1">
                <div>
                  <span className="text-zinc-500 block text-[10px]">TOTAL USED</span>
                  {(health.storageQuota.usageBytes / (1024 * 1024)).toFixed(1)} MB
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">TOTAL AVAILABLE</span>
                  {(health.storageQuota.limitBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">TEST UPLOAD/DELETE</span>
                  <span className="text-emerald-400">PASSED</span>
                </div>
              </div>
            )}

            {health.error && <p className="text-xs text-red-300 mt-2 font-mono">{health.error}</p>}
          </div>
        ) : (
          <div className="text-xs text-zinc-400 font-mono bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900 flex items-center justify-between">
            <span>Root Folder: {event.drive_root_folder_id || "Not connected"}</span>
            <Link href="/admin/connect-drive" className="text-amber-400 hover:underline">
              {event.drive_root_folder_id ? "Manage Connection →" : "Connect Google Drive →"}
            </Link>
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/admin/photos"
          className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all group"
        >
          <div className="text-amber-400 mb-3 group-hover:scale-110 transition-transform w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
            Photo Management &rarr;
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            View guests, per-guest photo counts, hide or delete shots, and open guest subfolders.
          </p>
        </Link>

        <Link
          href="/admin/qr"
          className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all group"
        >
          <div className="text-amber-400 mb-3 group-hover:scale-110 transition-transform w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h4.5A1.5 1.5 0 0 1 10.5 4.5v4.5A1.5 1.5 0 0 1 9 10.5H4.5A1.5 1.5 0 0 1 3 9V4.5Zm1.5 0v4.5h4.5V4.5H4.5ZM3 15a1.5 1.5 0 0 1 1.5-1.5h4.5A1.5 1.5 0 0 1 10.5 15v4.5A1.5 1.5 0 0 1 9 21H4.5A1.5 1.5 0 0 1 3 19.5V15Zm1.5 0v4.5h4.5V15H4.5ZM13.5 4.5A1.5 1.5 0 0 1 15 3h4.5A1.5 1.5 0 0 1 21 4.5v4.5A1.5 1.5 0 0 1 19.5 10.5H15A1.5 1.5 0 0 1 13.5 9V4.5Zm1.5 0v4.5H19.5V4.5H15Zm-.75 9.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75v-1.5Zm3.75-.75a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 .75.75H19.5a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75H18Zm-3.75 4.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75v-2.25Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
            QR Generator & A6 Card &rarr;
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Download crisp PNG/SVG QR codes and print elegant A6 wedding table cards.
          </p>
        </Link>

        <Link
          href="/admin/settings"
          className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all group"
        >
          <div className="text-amber-400 mb-3 group-hover:scale-110 transition-transform w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.05 5.378a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l1.072.822c.1.076.155.228.138.411a7.618 7.618 0 0 0 0 1.176c.017.183-.038.335-.138.411l-1.072.822a1.875 1.875 0 0 0-.432 2.385l.922 1.597c.547.947 1.696 1.34 2.282.818l1.267-.512c.116-.043.284-.032.45.083.313.218.643.41.986.57.182.088.277.228.297.348l.178 1.072c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.348.343-.16.673-.352.986-.57.166-.115.334-.126.45-.083l1.267.512c.586.522 1.735.129 2.282-.818l.922-1.597a1.875 1.875 0 0 0-.432-2.385l-1.072-.822c-.1-.076-.155-.228-.138-.411.006-.39.006-.786 0-1.176-.017-.183.038-.335.138-.411l1.072-.822a1.875 1.875 0 0 0 .432-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.819l-1.267.512c-.116.043-.284.032-.45-.083a7.49 7.49 0 0 0-.986-.57c-.183-.088-.277-.228-.297-.348l-.178-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.844ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
            Event Settings &rarr;
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Configure shot limits, event window, manual open/close switch, and theme colors.
          </p>
        </Link>
      </div>

      {/* Recent Activity Table */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Recent Photo Uploads</h2>
          <Link href="/admin/photos" className="text-xs text-amber-400 hover:underline">
            View All Photos &rarr;
          </Link>
        </div>

        {recentPhotos.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 font-mono">
            No photos uploaded yet. When guests shoot photos, they will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3">Guest</th>
                  <th className="py-2.5 px-3">Shot ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-mono">
                {recentPhotos.map((photo) => (
                  <tr key={photo.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-3 px-3 font-sans font-medium text-zinc-200">
                      {photo.guestName}
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      {photo.shot_id.slice(0, 8)}…
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                          photo.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : photo.status === "failed"
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : photo.status === "hidden"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {photo.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      {photo.size_bytes ? `${(photo.size_bytes / 1024).toFixed(0)} KB` : "—"}
                    </td>
                    <td className="py-3 px-3 text-zinc-500">
                      {new Date(photo.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
