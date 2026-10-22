"use client";

import React, { useState } from "react";
import Image from "next/image";
import { IconX } from "@/components/ui/Icons";
import { type Lang } from "@/lib/i18n";
import { clearLocalConsent } from "@/lib/guest/consent";
import { clearSessionTriple } from "@/lib/guest/session";

interface EventExpiredScreenProps {
  eventSlug: string;
  reason?: "invalid" | "expired";
}

export function EventExpiredScreen({ eventSlug, reason = "expired" }: EventExpiredScreenProps) {
  const [lang, setLang] = useState<Lang>("en");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isInvalid = reason === "invalid";

  const copy = {
    en: {
      tag: isInvalid ? "CAMERA LINK INVALID" : "ACCESS WINDOW CLOSED",
      title: isInvalid ? "Camera Link Invalid" : "Camera Link Expired",
      desc: isInvalid
        ? "This camera link is unrecognized or incomplete. Please scan the official QR code at the venue or request the active link from the hosts."
        : "This event camera link has expired or is no longer active. If you attended this event, please contact the couple for an updated link or QR code.",
      privacyAction: "Attended this event? Manage or delete your data",
      privacyModalTitle: "Guest Privacy & Data Management",
      privacyModalDesc: "Under Indonesia UU PDP, you have full control over your local device session and uploaded roll.",
      clearPhoneBtn: "Clear Data on This Phone",
      clearPhoneHelp: "Wipes all local cookies, cache, and session tokens from this device.",
      deleteCloudBtn: "Delete My Roll (Cloud & Phone)",
      deleteCloudHelp: "Permanently erases all your photos from Google Drive, server records, and this phone.",
      confirmClearPhone: "Clear all local session data and cookies from this phone?",
      confirmDeleteCloud: "WARNING: This will permanently delete your photos from the album and Google Drive. Proceed?",
      successCleared: "Local device session and cookies successfully wiped.",
      successDeleted: "Your roll and photos have been permanently erased.",
      close: "Close",
    },
    id: {
      tag: isInvalid ? "TAUTAN KAMERA TIDAK VALID" : "WAKTU AKSES DITUTUP",
      title: isInvalid ? "Tautan Kamera Tidak Valid" : "Tautan Kamera Kedaluwarsa",
      desc: isInvalid
        ? "Tautan kamera ini tidak valid atau tidak lengkap. Silakan scan kode QR resmi di venue acara atau hubungi kedua mempelai untuk tautan aktif."
        : "Tautan kamera untuk acara ini telah kedaluwarsa atau tidak aktif lagi. Jika kamu tamu acara ini, silakan hubungi kedua mempelai untuk mendapatkan tautan atau kode QR terbaru.",
      privacyAction: "Menghadiri acara ini? Kelola atau hapus data kamu",
      privacyModalTitle: "Kelola Data Pribadi Tamu (UU PDP)",
      privacyModalDesc: "Sesuai UU Pelindungan Data Pribadi (UU PDP), kamu memiliki kendali penuh atas data di HP ini dan roll foto kamu.",
      clearPhoneBtn: "Hapus Data di HP Ini",
      clearPhoneHelp: "Menghapus cookie, cache, dan sesi lokal dari perangkat ini.",
      deleteCloudBtn: "Hapus Roll Saya (Cloud & HP)",
      deleteCloudHelp: "Menghapus permanen seluruh foto kamu dari Google Drive, server, dan HP ini.",
      confirmClearPhone: "Hapus seluruh data sesi dan cookie dari HP ini?",
      confirmDeleteCloud: "PERINGATAN: Seluruh foto kamu akan dihapus permanen dari album dan Google Drive. Lanjutkan?",
      successCleared: "Data lokal dan cookie berhasil dibersihkan dari HP ini.",
      successDeleted: "Roll dan foto kamu telah dihapus permanen.",
      close: "Tutup",
    },
  }[lang];

  const handleClearPhone = async () => {
    if (!window.confirm(copy.confirmClearPhone)) return;
    setClearing(true);
    setStatusMsg(null);
    try {
      clearLocalConsent();
      await clearSessionTriple(eventSlug);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {}
        if (typeof window.indexedDB !== "undefined") {
          try {
            if (window.indexedDB.databases) {
              const dbs = await window.indexedDB.databases();
              for (const db of dbs) {
                if (db.name) window.indexedDB.deleteDatabase(db.name);
              }
            } else {
              window.indexedDB.deleteDatabase("disposable-cam");
            }
          } catch {}
        }
      }
      setStatusMsg(copy.successCleared);
    } catch {
      setStatusMsg("Failed to clear local data");
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteCloud = async () => {
    if (!window.confirm(copy.confirmDeleteCloud)) return;
    setClearing(true);
    setStatusMsg(null);
    try {
      // Find guestId from cookie or localStorage if available
      const res = await fetch("/api/guests/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          // Server will match by authenticated session cookie if guestId is omitted
        }),
      });

      clearLocalConsent();
      await clearSessionTriple(eventSlug);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {}
        if (typeof window.indexedDB !== "undefined") {
          try {
            window.indexedDB.deleteDatabase("disposable-cam");
          } catch {}
        }
      }

      if (res.ok) {
        setStatusMsg(copy.successDeleted);
      } else {
        setStatusMsg(copy.successCleared);
      }
    } catch {
      setStatusMsg(copy.successCleared);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto px-6 py-8 justify-between select-none">
      {/* Top Bar: Lang toggle */}
      <div className="flex justify-end items-center">
        <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 rounded-full transition-all ${
              lang === "en"
                ? "bg-amber-400 text-black font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("id")}
            className={`px-2.5 py-1 rounded-full transition-all ${
              lang === "id"
                ? "bg-amber-400 text-black font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ID
          </button>
        </div>
      </div>

      {/* Main Expired Content */}
      <div className="flex flex-col items-center text-center my-auto py-8">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 drop-shadow-md opacity-80">
          <Image
            src="/unveiled-transparent.png"
            alt="Unveiled"
            fill
            priority
            sizes="(max-width: 640px) 96px, 112px"
            className="object-contain grayscale"
          />
        </div>

        <span className="inline-block px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/80 text-[10px] font-mono tracking-widest text-amber-300 uppercase mb-3">
          {copy.tag}
        </span>

        <h1 className="font-serif text-3xl sm:text-4xl text-zinc-100 font-normal leading-tight mb-4">
          {copy.title}
        </h1>

        <div className="w-full bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 text-center backdrop-blur-sm shadow-xl">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {copy.desc}
          </p>
        </div>
      </div>

      {/* Footer: Discreet Privacy Action */}
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={() => {
            setStatusMsg(null);
            setShowPrivacyModal(true);
          }}
          className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-4 cursor-pointer"
        >
          {copy.privacyAction}
        </button>
      </div>

      {/* Privacy & Erasure Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                {copy.privacyModalTitle}
              </h2>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {copy.privacyModalDesc}
            </p>

            {statusMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs text-center font-mono animate-in fade-in">
                {statusMsg}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearPhone}
                className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-98 transition text-xs font-bold text-zinc-200 border border-zinc-700 text-left flex flex-col gap-0.5 cursor-pointer disabled:opacity-50"
              >
                <span>{copy.clearPhoneBtn}</span>
                <span className="text-[10px] text-zinc-400 font-normal">
                  {copy.clearPhoneHelp}
                </span>
              </button>

              <button
                type="button"
                disabled={clearing}
                onClick={handleDeleteCloud}
                className="w-full py-3 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/50 active:scale-98 transition text-xs font-bold text-red-300 border border-red-800/60 text-left flex flex-col gap-0.5 cursor-pointer disabled:opacity-50"
              >
                <span>{copy.deleteCloudBtn}</span>
                <span className="text-[10px] text-red-400/80 font-normal">
                  {copy.deleteCloudHelp}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition cursor-pointer"
            >
              {copy.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
