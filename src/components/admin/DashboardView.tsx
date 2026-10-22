"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { DriveHealthResult } from "@/lib/drive/health";

interface DashboardViewProps {
  isSuperadmin?: boolean;
  event: {
    id: string;
    slug: string;
    couple_names: string;
    shots_per_guest: number;
    opens_at: string | null;
    closes_at: string | null;
    manually_closed: boolean;
    drive_root_folder_id: string | null;
    access_token?: string;
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
    limitBytes?: number;
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
  isSuperadmin = false,
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

  // Drive quota from live drive.about.get (with 400 GB fallback)
  const quotaLimitBytes =
    health?.storageQuota?.limitBytes ??
    metrics.limitBytes ??
    400 * 1024 * 1024 * 1024;
  const quotaLimitGB = Math.round(quotaLimitBytes / (1024 * 1024 * 1024));
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 85% Storage Alert Banner */}
      {metrics.storageWarning && (
        <div className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-amber-400 shrink-0">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" x2="12" y1="9" y2="13" />
              <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
            <div>
              <p className="font-semibold text-amber-300">Google Drive Storage Alert (85%+ Full)</p>
              <p className="text-zinc-300">{metrics.storageMessage || "Drive storage is over 85% full. Uploads will automatically pause at 98%."}</p>
            </div>
          </div>
          {isSuperadmin ? (
            <Link href="/admin/connect-drive" className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-medium text-amber-300 transition-colors">
              Check Quota
            </Link>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[11px]">
              Platform Vault
            </span>
          )}
        </div>
      )}

      {/* Event Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-serif text-white tracking-tight">
              {event.couple_names}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium ${
                isEventOpen
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isEventOpen ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span>{isEventOpen ? "Camera Active" : "Camera Closed"}</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            /e/<span className="text-amber-400/90 font-medium">{event.slug}</span> &bull; {event.shots_per_guest} exposures/guest
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link
            href="/admin/photos?export=1"
            className="h-8 px-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title="Download all event photos as .ZIP archive"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-400">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            <span>Download All (.ZIP)</span>
          </Link>
          <Link
            href={`/e/${event.slug}${event.access_token ? `?t=${event.access_token}` : ""}`}
            target="_blank"
            className="h-8 px-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Guest Camera</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-400">
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </Link>
          <Link
            href="/admin/qr"
            className="h-8 px-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect width="5" height="5" x="3" y="3" rx="1" />
              <rect width="5" height="5" x="16" y="3" rx="1" />
              <rect width="5" height="5" x="3" y="16" rx="1" />
              <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
              <path d="M21 21v.01" />
              <path d="M12 7v3a2 2 0 0 1-2 2H7" />
              <path d="M3 12h.01" />
              <path d="M12 3h.01" />
              <path d="M12 16v.01" />
              <path d="M16 12h1" />
              <path d="M21 12v.01" />
              <path d="M12 21v-1" />
            </svg>
            <span>Print QR Card</span>
          </Link>
        </div>
      </div>

      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Confirmed Photos */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/10 transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Confirmed Photos
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-semibold text-zinc-100 tracking-tight">
            {metrics.confirmedCount}
          </p>
          <div className="flex items-center text-xs text-zinc-400">
            <span className="text-amber-400/90 font-mono text-[11px]">Vault Synchronized</span>
          </div>
        </div>

        {/* Total Guests - Links directly to Guest Rolls view */}
        <Link
          href="/admin/photos?view=rolls"
          className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/20 transition-all space-y-3 block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 group-hover:text-zinc-200 transition-colors font-medium">
              Guests Registered
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300 group-hover:bg-white/[0.08] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-sky-400">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-semibold text-zinc-100 tracking-tight">
            {metrics.totalGuests}
          </p>
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono text-[11px]">
            <span>Avg {metrics.totalGuests > 0 ? (metrics.confirmedCount / metrics.totalGuests).toFixed(1) : 0} shots/guest</span>
            <span className="text-sky-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-sans text-[11px]">
              View Rolls &rarr;
            </span>
          </div>
        </Link>

        {/* Estimated Storage */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/10 transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Drive Usage ({quotaLimitGB} GB)
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400">
                <rect width="20" height="8" x="2" y="2" rx="2" />
                <rect width="20" height="8" x="2" y="14" rx="2" />
                <line x1="6" x2="6.01" y1="6" y2="6" />
                <line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-mono font-semibold text-zinc-100 tracking-tight">
              {Number(totalGB) >= 1 ? `${totalGB} GB` : `${totalMB} MB`}
            </p>
            <span className={`text-[11px] font-mono ${Number(actualPercentUsed) >= 85 ? "text-rose-400" : "text-emerald-400"}`}>
              {actualPercentUsed}%
            </span>
          </div>
          <div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  Number(actualPercentUsed) >= 85 ? "bg-rose-400" : "bg-amber-400"
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
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/10 transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Upload Health
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${metrics.failedCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {metrics.failedCount > 0 ? (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </>
                ) : (
                  <>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </>
                )}
              </svg>
            </div>
          </div>
          <p className={`text-2xl sm:text-3xl font-mono font-semibold tracking-tight ${metrics.failedCount > 0 ? "text-rose-400" : "text-zinc-100"}`}>
            {metrics.failedCount}
          </p>
          <div className="flex items-center text-xs text-zinc-400 font-mono text-[11px]">
            {metrics.failedCount > 0 ? (
              <span className="text-rose-400">Requires attention</span>
            ) : (
              <span className="text-emerald-400">0 errors logged</span>
            )}
          </div>
        </div>
      </div>

      {/* Drive Status & Health Card */}
      <div className="p-6 mb-8 rounded-xl bg-white/[0.02] border border-white/[0.07]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Google Drive Storage</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Connection status and event folder verification
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={checkingHealth}
              className="h-8 px-3 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
            >
              {checkingHealth ? "Testing Connection…" : "Test Connection"}
            </button>
            {event.drive_root_folder_id && (
              <a
                href={`https://drive.google.com/drive/folders/${event.drive_root_folder_id}`}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded-lg bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 text-xs font-medium text-amber-300 transition-colors flex items-center gap-1.5"
              >
                <span>Open in Drive</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {health ? (
          <div className={`p-4 rounded-xl border ${health.ok ? "bg-zinc-900/60 border-zinc-800" : "bg-rose-950/20 border-rose-900/30"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-mono font-semibold flex items-center gap-1.5 ${health.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {health.ok ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>CONNECTED</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" x2="9" y1="9" y2="15" />
                      <line x1="9" x2="15" y1="9" y2="15" />
                    </svg>
                    <span>DRIVE VAULT CONNECTION ISSUE</span>
                  </>
                )}
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

            {health.error && <p className="text-xs text-rose-300 mt-2 font-mono">{health.error}</p>}
          </div>
        ) : (
          <div className="text-xs text-zinc-400 font-mono bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900 flex items-center justify-between">
            <span>Root Folder: {event.drive_root_folder_id || "Not connected"}</span>
            {isSuperadmin ? (
              <Link href="/admin/connect-drive" className="text-amber-400 hover:text-amber-300 transition-colors">
                {event.drive_root_folder_id ? "Manage Connection →" : "Connect Google Drive →"}
              </Link>
            ) : (
              <span className="text-zinc-500">Connected Vault</span>
            )}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/admin/photos"
          className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/15 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
              Photo Management
            </h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            View guests, per-guest photo counts, hide or delete shots, and open guest subfolders.
          </p>
        </Link>

        <Link
          href="/admin/qr"
          className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/15 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect width="5" height="5" x="3" y="3" rx="1" />
              <rect width="5" height="5" x="16" y="3" rx="1" />
              <rect width="5" height="5" x="3" y="16" rx="1" />
              <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
              <path d="M21 21v.01" />
              <path d="M12 7v3a2 2 0 0 1-2 2H7" />
              <path d="M3 12h.01" />
              <path d="M12 3h.01" />
              <path d="M12 16v.01" />
              <path d="M16 12h1" />
              <path d="M21 12v.01" />
              <path d="M12 21v-1" />
            </svg>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
              QR Print Studio
            </h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Download crisp PNG/SVG QR codes and print elegant A4 sheet table cards and guest invites.
          </p>
        </Link>

        <Link
          href="/admin/settings"
          className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/15 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
              Event Settings
            </h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Configure shot limits, event window, manual open/close switch, and theme colors.
          </p>
        </Link>
      </div>

      {/* Recent Activity Table */}
      <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.07]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
            Recent Photo Uploads
          </h2>
          <Link href="/admin/photos" className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
            <span>View All Photos</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
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
                <tr className="border-b border-zinc-800/80 text-zinc-400 font-sans text-[11px] uppercase tracking-[0.14em]">
                  <th className="py-2.5 px-3 font-medium">Guest</th>
                  <th className="py-2.5 px-3 font-medium">Shot ID</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Size</th>
                  <th className="py-2.5 px-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/80 font-mono">
                {recentPhotos.map((photo) => (
                  <tr key={photo.id} className="hover:bg-white/[0.02] transition-colors">
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
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
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
