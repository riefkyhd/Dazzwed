"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { DriveHealthResult } from "@/lib/drive/health";

function ConnectDriveContent() {
  const searchParams = useSearchParams();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [health, setHealth] = useState<DriveHealthResult | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const connected = searchParams.get("connected") === "1";
  const refreshToken = searchParams.get("refreshToken");
  const folderId = searchParams.get("folderId");
  const coupleNames = searchParams.get("coupleNames");
  const error = searchParams.get("error");

  const copy = (key: string, val: string) => {
    void navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const runHealthCheck = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!connected) return;
    let ignore = false;
    async function check() {
      try {
        const res = await fetch("/api/admin/drive-health");
        const data = (await res.json()) as DriveHealthResult;
        if (!ignore) setHealth(data);
      } catch (e) {
        if (!ignore) setHealth({ ok: false, testUploadOk: false, error: String(e) });
      }
    }
    void check();
    return () => {
      ignore = true;
    };
  }, [connected]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6 max-w-3xl mx-auto font-sans">
      <div className="border-b border-zinc-800 pb-5 mb-8 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-accent">Admin Portal</span>
          <h1 className="text-2xl font-serif font-bold text-white mt-1">Google Drive Connection</h1>
        </div>
        <button
          onClick={() => void runHealthCheck()}
          disabled={checkingHealth}
          className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-medium transition-all"
        >
          {checkingHealth ? "Checking Health…" : "Check Drive Health"}
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-sm">
          <p className="font-bold mb-1">Connection Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Prominent Warning Banner */}
      <div className="p-4 mb-8 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs leading-relaxed space-y-2">
        <p className="font-bold flex items-center gap-1.5 text-amber-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          CRITICAL: Google Cloud OAuth Publishing Status
        </p>
        <p>
          In Google Cloud Console, ensure your OAuth Consent Screen Publishing Status is set to <b>&quot;In production&quot;</b>.
          If left in &quot;Testing&quot; mode, Google automatically revokes the refresh token after <b>7 days</b>, causing all uploads to fail on the wedding day.
        </p>
        <p>
          Also ensure you authorize using the couple&apos;s <b>DEDICATED</b> Google account so the full 15 GB free storage quota is available.
        </p>
      </div>

      {/* Newly connected or already connected info */}
      {connected && refreshToken && folderId && (
        <div className="p-6 mb-8 rounded-2xl bg-zinc-900/90 border border-accent/40 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
            </svg>
            <h2 className="text-base font-bold text-white">Google Drive Successfully Connected!</h2>
          </div>

          <p className="text-xs text-zinc-300">
            Root folder created: <b className="text-accent">Disposable Cam - {coupleNames || "Wedding"}</b>.
            Copy these values into your Vercel Project Environment Variables and local <code className="text-accent">.env.local</code>:
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono text-zinc-400">GOOGLE_REFRESH_TOKEN</span>
                <button
                  onClick={() => copy("token", refreshToken)}
                  className="text-xs font-mono text-accent hover:underline"
                >
                  {copiedKey === "token" ? "Copied!" : "Copy"}
                </button>
              </div>
              <input
                readOnly
                value={refreshToken}
                className="w-full p-2.5 rounded-lg bg-black border border-zinc-800 text-xs font-mono text-zinc-200"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono text-zinc-400">DRIVE_ROOT_FOLDER_ID</span>
                <button
                  onClick={() => copy("folder", folderId)}
                  className="text-xs font-mono text-accent hover:underline"
                >
                  {copiedKey === "folder" ? "Copied!" : "Copy"}
                </button>
              </div>
              <input
                readOnly
                value={folderId}
                className="w-full p-2.5 rounded-lg bg-black border border-zinc-800 text-xs font-mono text-zinc-200"
              />
            </div>

            <div className="pt-2">
              <a
                href={`https://drive.google.com/drive/folders/${folderId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
              >
                Open Root Folder in Google Drive &rarr;
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Drive Health Card */}
      {health && (
        <div className={`p-5 mb-8 rounded-xl border ${health.ok ? "bg-zinc-950 border-zinc-800" : "bg-red-950/30 border-red-800/60"}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${health.ok ? "bg-emerald-400" : "bg-red-500"}`} />
              Drive Health Status: {health.ok ? "HEALTHY" : "ERROR"}
            </h3>
            {health.userEmail && <span className="text-xs text-zinc-400 font-mono">{health.userEmail}</span>}
          </div>

          {health.storageQuota && (
            <div className="text-xs text-zinc-300 space-y-1 font-mono">
              <p>Used: {(health.storageQuota.usageBytes / (1024 * 1024)).toFixed(1)} MB / {(health.storageQuota.limitBytes / (1024 * 1024 * 1024)).toFixed(1)} GB</p>
              <p>Remaining: {(health.storageQuota.remainingBytes / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
              <p className="text-emerald-400">Test Upload/Delete: PASS</p>
            </div>
          )}

          {health.error && <p className="text-xs text-red-300 mt-2 font-mono">{health.error}</p>}
        </div>
      )}

      {/* Connect / Reconnect Button */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4">
        <h2 className="text-base font-bold text-white">One-Time Account Authorization</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
          Click below to log in with the dedicated wedding Google account. This grants the app <code className="text-zinc-300">drive.file</code> scope and generates your refresh token.
        </p>

        <a
          href="/api/auth/google/start?slug=our-wedding"
          className="inline-block py-3 px-6 rounded-xl bg-accent text-accent-fg font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all"
        >
          {connected ? "Re-authorize Google Account" : "Authorize Google Account"}
        </a>
      </div>
    </div>
  );
}

export default function ConnectDrivePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-400">Loading…</div>}>
      <ConnectDriveContent />
    </Suspense>
  );
}
