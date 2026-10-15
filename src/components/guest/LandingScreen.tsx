"use client";

import React, { useState } from "react";
import Image from "next/image";
import { type Lang, t } from "@/lib/i18n";
import { CONSENT_COPY, CONSENT_VERSION } from "@/constants/consentCopy";
import { formatEditorialExpiry } from "@/lib/event-token";
import { NativeCameraInput } from "./NativeCameraInput";
import { RestoreRollModal } from "./RestoreRollModal";
import { clearLocalConsent } from "@/lib/guest/consent";
import { clearSessionTriple } from "@/lib/guest/session";

export interface ConsentSubmission {
  album: boolean;
  telemetry: boolean;
  version: string;
}

interface LandingScreenProps {
  coupleNames: string;
  eventSubtitle?: string;
  shotsPerGuest: number;
  eventSlug: string;
  tokenExpiresAt?: string | null;
  lang: Lang;
  onLanguageChange: (lang: Lang) => void;
  onStartCamera: (name: string, consent: ConsentSubmission) => void;
  onNativePhoto: (file: File, name: string | null, quickThumb?: string, consent?: ConsentSubmission) => void;
  onRestoreSuccess?: (data: { guestId: string; name: string | null; rollCode: string; shotsLeft: number }) => void;
}

export function LandingScreen({
  coupleNames,
  eventSubtitle,
  shotsPerGuest,
  eventSlug,
  tokenExpiresAt,
  lang,
  onLanguageChange,
  onStartCamera,
  onNativePhoto,
  onRestoreSuccess,
}: LandingScreenProps) {
  const [name, setName] = useState("");
  const [consentAlbum, setConsentAlbum] = useState(false);
  const [consentTelemetry, setConsentTelemetry] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isDeletingRoll, setIsDeletingRoll] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<string | null>(null);

  const copy = CONSENT_COPY[lang];
  const editorialExpiry = formatEditorialExpiry(tokenExpiresAt, lang);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentAlbum) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    onStartCamera(name.trim(), {
      album: consentAlbum,
      telemetry: consentTelemetry,
      version: CONSENT_VERSION,
    });
  };

  const handleWithdrawConsent = async () => {
    if (!window.confirm(copy.withdrawConfirm)) return;
    setIsDeletingRoll(true);
    setWithdrawStatus(null);
    try {
      // Find guestId from cookie or prompt roll code
      let rollCodeInput: string | undefined = undefined;
      const promptCode = window.prompt(
        lang === "id"
          ? "Masukkan kode roll 6-karakter kamu jika memilikinya (kosongkan jika menggunakan sesi HP ini):"
          : "Enter your 6-character roll code if you have it (leave blank if using active phone session):"
      );
      if (promptCode && promptCode.trim()) {
        rollCodeInput = promptCode.trim().toUpperCase();
      }

      const res = await fetch("/api/guests/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          rollCode: rollCodeInput,
        }),
      });

      clearLocalConsent();
      await clearSessionTriple(eventSlug);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {}
      }

      if (res.ok) {
        setWithdrawStatus(copy.withdrawSuccess);
      } else {
        setWithdrawStatus(
          lang === "id"
            ? "Data lokal telah dibersihkan."
            : "Local session cleared."
        );
      }
    } catch {
      setWithdrawStatus(
        lang === "id" ? "Gagal menghubungi server." : "Failed to contact server."
      );
    } finally {
      setIsDeletingRoll(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto px-6 py-8 justify-between">
      {/* Top Bar: Lang toggle */}
      <div className="flex justify-end items-center">
        <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => onLanguageChange("en")}
            className={`px-2.5 py-1 rounded-full transition-all ${
              lang === "en"
                ? "bg-accent text-accent-fg font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange("id")}
            className={`px-2.5 py-1 rounded-full transition-all ${
              lang === "id"
                ? "bg-accent text-accent-fg font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ID
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center text-center my-auto py-4">
        {/* Unveiled Brand Mark Emblem */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-3 drop-shadow-md">
          <Image
            src="/unveiled-transparent.png"
            alt="Unveiled"
            fill
            priority
            sizes="(max-width: 640px) 80px, 96px"
            className="object-contain"
          />
        </div>

        {/* Optional Tagline */}
        <p className="text-xs font-sans tracking-[0.2em] text-zinc-400 uppercase mb-1">
          {eventSubtitle || t(lang, "welcomeTo")}
        </p>

        {/* Couple Names (Luxury Serif Headline) */}
        <h1 className="font-serif text-3xl sm:text-4xl text-accent font-normal leading-tight mb-2">
          {coupleNames}
        </h1>

        {/* Editorial Subtitles (Clean, Minimal, No heavy borders) */}
        <p className="text-xs text-zinc-300 font-sans tracking-wide leading-relaxed max-w-xs mb-1">
          {copy.editorialSubtitle}
        </p>

        {editorialExpiry && (
          <p className="text-[11px] text-amber-300/80 font-sans tracking-wider uppercase mb-5">
            {editorialExpiry}
          </p>
        )}

        {!editorialExpiry && <div className="mb-4" />}

        {/* Form: Optional Name + Un-boxed Checkboxes */}
        <form onSubmit={handleStart} className="w-full space-y-3.5 text-left">
          {/* Optional Guest Name */}
          <div>
            <div className="flex items-center justify-between mb-1 ml-0.5">
              <label
                htmlFor="guest-name"
                className="block text-xs font-medium text-zinc-400"
              >
                {t(lang, "yourName")}{" "}
                <span className="text-zinc-500 font-normal">
                  ({lang === "id" ? "opsional" : "optional"})
                </span>
              </label>
            </div>
            <input
              id="guest-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "yourNamePlaceholder")}
              maxLength={60}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700/80 focus:border-accent text-white placeholder-zinc-500 focus:outline-none text-sm transition-colors"
            />
          </div>

          {/* Un-boxed Consent Checkboxes */}
          <div className="space-y-2.5 pt-1">
            {/* 1. Required Album Consent */}
            <label
              htmlFor="consent-album"
              className={`flex items-start gap-2.5 cursor-pointer select-none transition-opacity ${
                consentError ? "text-rose-300" : "text-zinc-200"
              }`}
            >
              <input
                id="consent-album"
                type="checkbox"
                required
                aria-required="true"
                checked={consentAlbum}
                onChange={(e) => {
                  setConsentAlbum(e.target.checked);
                  if (e.target.checked) setConsentError(false);
                }}
                className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 bg-zinc-800 cursor-pointer shrink-0"
              />
              <span className="text-xs leading-relaxed font-sans">
                <span className="text-amber-400 font-bold mr-1">*</span>
                {copy.checkboxAlbum}
              </span>
            </label>

            {/* 2. Optional Telemetry Consent */}
            <label
              htmlFor="consent-telemetry"
              className="flex items-start gap-2.5 cursor-pointer select-none text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              <input
                id="consent-telemetry"
                type="checkbox"
                checked={consentTelemetry}
                onChange={(e) => setConsentTelemetry(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 bg-zinc-800 cursor-pointer shrink-0"
              />
              <span className="text-[11px] leading-relaxed font-sans text-zinc-400">
                {copy.checkboxTelemetry}
              </span>
            </label>
          </div>

          {/* Expandable Indonesia UU PDP Notice (Clean Inline Accordion) */}
          <details className="w-full text-left text-xs pt-1 text-zinc-400 group">
            <summary className="font-medium text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer select-none flex items-center justify-between py-1">
              <span className="underline underline-offset-4 decoration-zinc-700">
                {copy.detailsTitle}
              </span>
              <span className="text-zinc-500 group-open:rotate-180 transition-transform text-[10px]">
                ▼
              </span>
            </summary>
            <div className="mt-2.5 space-y-2.5 pt-2 border-t border-zinc-800 leading-relaxed text-zinc-300 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/60">
              <p className="text-zinc-400 italic text-[11px]">{copy.detailsIntro}</p>
              <div>
                <h4 className="font-bold text-zinc-200 text-xs">{copy.controllerTitle}</h4>
                <p className="text-[11px]">{copy.controllerBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200 text-xs">{copy.purposeTitle}</h4>
                <p className="text-[11px]">{copy.purposeBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200 text-xs">{copy.typesTitle}</h4>
                <p className="whitespace-pre-line text-[11px]">{copy.typesBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200 text-xs">{copy.retentionTitle}</h4>
                <p className="text-[11px]">{copy.retentionBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200 text-xs">{copy.rightsTitle}</h4>
                <p className="text-[11px]">{copy.rightsBody}</p>
              </div>

              {/* UU PDP Right to Erasure Self-Service Action */}
              <div className="pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  disabled={isDeletingRoll}
                  onClick={handleWithdrawConsent}
                  className="text-[11px] text-rose-400/80 hover:text-rose-300 transition underline underline-offset-4 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingRoll ? "Processing..." : copy.withdrawAction}
                </button>
              </div>
            </div>
          </details>

          {withdrawStatus && (
            <p className="text-xs text-emerald-400 text-center font-mono py-1">
              {withdrawStatus}
            </p>
          )}

          {consentError && (
            <p className="text-xs text-rose-400 text-center font-medium">
              {lang === "id"
                ? "Harap setujui persetujuan album untuk melanjutkan."
                : "Please agree to the album consent to start."}
            </p>
          )}

          {/* Primary Gold CTA: Start camera */}
          <button
            type="submit"
            disabled={!consentAlbum}
            className="w-full py-3.5 px-6 rounded-xl bg-accent text-accent-fg font-bold text-base shadow-lg shadow-amber-950/40 hover:brightness-110 active:scale-[0.99] transition-all touch-manipulation cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t(lang, "startCamera")}
          </button>
        </form>

        {/* Secondary Action: Native phone camera app */}
        <div className="w-full mt-2.5">
          <NativeCameraInput
            eventSlug={eventSlug}
            beforeClick={() => {
              if (!consentAlbum) {
                setConsentError(true);
                return false;
              }
              return true;
            }}
            onFileSelected={(file, quickThumb) => {
              if (!consentAlbum) return;
              onNativePhoto(file, name.trim() || null, quickThumb, {
                album: consentAlbum,
                telemetry: consentTelemetry,
                version: CONSENT_VERSION,
              });
            }}
            lang={lang}
            variant="secondary"
          />
        </div>

        {/* Secondary Link: Continue my roll */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="text-xs text-zinc-400 hover:text-amber-300 underline underline-offset-4 transition font-medium cursor-pointer"
          >
            {t(lang, "continueRoll")}
          </button>
        </div>
      </div>

      {showRestoreModal && (
        <RestoreRollModal
          isOpen={showRestoreModal}
          eventSlug={eventSlug}
          lang={lang}
          initialConsentAlbum={consentAlbum}
          initialConsentTelemetry={consentTelemetry}
          onClose={() => setShowRestoreModal(false)}
          onSuccess={(data) => {
            setShowRestoreModal(false);
            if (onRestoreSuccess) onRestoreSuccess(data);
          }}
        />
      )}
    </div>
  );
}
