"use client";

import React, { useState, useEffect } from "react";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface SyncStatusSheetProps {
  open: boolean;
  onClose: () => void;
  syncError?: boolean;
  pendingCount: number;
  lang: Lang;
}

export function SyncStatusSheet({
  open,
  onClose,
  syncError = false,
  pendingCount,
  lang,
}: SyncStatusSheetProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const timer = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => {
        setRendered(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!rendered) return null;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === "id" ? "Status Sinkronisasi" : "Upload & Sync Status"}
      className={`fixed inset-0 z-50 flex flex-col justify-end bg-black/60 select-none transition-opacity duration-250 ease-out ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop tap to dismiss */}
      <div className="flex-1 cursor-pointer" onClick={handleDismiss} />

      {/* Sheet Content with slide-up / slide-down physics */}
      <div
        className={`w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-700/80 rounded-t-3xl p-6 space-y-4 shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Grab Handle Pill */}
        <div className="w-10 h-1 rounded-full bg-zinc-600/70 mx-auto -mt-2 mb-2" />

        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            {lang === "id" ? "Status Sinkronisasi" : "Upload & Sync Status"}
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="py-2 text-center space-y-3">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-zinc-800">
            <span
              className={`w-4 h-4 rounded-full ${
                syncError
                  ? "bg-rose-500 animate-pulse"
                  : pendingCount > 0
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400"
              }`}
            />
          </div>
          <p className="text-sm text-zinc-200 font-medium">
            {syncError
              ? lang === "id"
                ? "Menunggu Sinkronisasi Drive"
                : "Drive Sync Paused"
              : pendingCount > 0
                ? t(lang, "pending", { n: pendingCount })
                : t(lang, "synced")}
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {syncError
              ? lang === "id"
                ? "Foto Anda tersimpan 100% aman di perangkat ini. Pengunggahan ke Google Drive akan dilanjutkan otomatis saat Drive terhubung kembali di Pengaturan Admin."
                : "Your photos are safely stored on this device! Cloud upload will automatically resume once the event Google Drive connection is re-authorized in Admin Settings."
              : pendingCount > 0
                ? lang === "id"
                  ? "Foto sedang diunggah secara aman di latar belakang. Jangan tutup tab."
                  : "Photos are being safely uploaded in the background. Keep this tab open."
                : lang === "id"
                  ? "Semua foto telah tersimpan dengan aman."
                  : "All captured photos are safely synced."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="w-full py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-xs hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer"
        >
          {t(lang, "close")}
        </button>
      </div>
    </div>
  );
}
