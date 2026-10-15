"use client";

import React, { useState } from "react";
import Image from "next/image";
import { type Lang, t } from "@/lib/i18n";
import { CONSENT_COPY, CONSENT_VERSION } from "@/constants/consentCopy";
import { formatExpirationNotice } from "@/lib/event-token";
import { NativeCameraInput } from "./NativeCameraInput";
import { RestoreRollModal } from "./RestoreRollModal";

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

  const copy = CONSENT_COPY[lang];

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
      <div className="flex flex-col items-center text-center my-auto py-6">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3 drop-shadow-md">
          <Image
            src="/unveiled-transparent.png"
            alt="Unveiled"
            fill
            priority
            sizes="(max-width: 640px) 96px, 112px"
            className="object-contain"
          />
        </div>

        <p className="text-sm font-sans tracking-wide text-zinc-400 uppercase mb-2">
          {eventSubtitle || t(lang, "welcomeTo")}
        </p>

        <h1 className="font-serif text-4xl sm:text-5xl text-accent font-normal leading-tight mb-6">
          {coupleNames}
        </h1>

        {/* Privacy Notice Summary Card */}
        <div className="w-full bg-surface/70 border border-zinc-800/80 rounded-2xl p-4 mb-4 text-left backdrop-blur-sm shadow-xl">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {copy.summary}
          </p>
        </div>

        {/* Event Access Expiration Notice Badge */}
        {tokenExpiresAt && (() => {
          const notice = formatExpirationNotice(tokenExpiresAt, lang);
          if (notice.isExpired) return null;
          return (
            <div className="w-full mb-5 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span>
                  {lang === "id"
                    ? `📷 Tautan aktif • Ditutup dalam ${notice.relativeRemaining} (${notice.formattedDate})`
                    : `📷 Camera active • Closes in ${notice.relativeRemaining} (${notice.formattedDate})`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Form: Optional Name + Explicit Consent */}
        <form onSubmit={handleStart} className="w-full space-y-4 text-left">
          {/* Optional Guest Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label
                htmlFor="guest-name"
                className="block text-xs font-medium text-zinc-400"
              >
                {t(lang, "yourName")} <span className="text-zinc-500 font-normal">({lang === "id" ? "opsional" : "optional"})</span>
              </label>
            </div>
            <input
              id="guest-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "yourNamePlaceholder")}
              maxLength={60}
              className="w-full px-4 py-3.5 rounded-xl bg-zinc-900 border border-zinc-700/80 focus:border-accent text-white placeholder-zinc-500 focus:outline-none text-base transition-colors"
            />
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            {/* 1. Required Album Consent */}
            <label
              htmlFor="consent-album"
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none ${
                consentError
                  ? "border-rose-500/80 bg-rose-950/20"
                  : consentAlbum
                  ? "border-accent/40 bg-accent/5"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
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
                className="mt-1 w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 focus:ring-offset-zinc-900 bg-zinc-800 cursor-pointer"
              />
              <span className="text-xs text-zinc-200 leading-relaxed font-sans">
                <span className="text-amber-400 font-bold mr-1">*</span>
                {copy.checkboxAlbum}
              </span>
            </label>

            {/* 2. Optional Telemetry Consent */}
            <label
              htmlFor="consent-telemetry"
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none ${
                consentTelemetry
                  ? "border-accent/40 bg-accent/5"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <input
                id="consent-telemetry"
                type="checkbox"
                checked={consentTelemetry}
                onChange={(e) => setConsentTelemetry(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 focus:ring-offset-zinc-900 bg-zinc-800 cursor-pointer"
              />
              <span className="text-xs text-zinc-400 leading-relaxed font-sans">
                {copy.checkboxTelemetry}
              </span>
            </label>
          </div>

          {/* Expandable Indonesia UU PDP Full Notice */}
          <details className="w-full text-left text-xs bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-zinc-400 group">
            <summary className="font-semibold text-zinc-300 cursor-pointer select-none flex items-center justify-between">
              <span>{copy.detailsTitle}</span>
              <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 space-y-2.5 pt-2 border-t border-zinc-800/80 leading-relaxed text-zinc-300">
              <p className="text-zinc-400 italic">{copy.detailsIntro}</p>
              <div>
                <h4 className="font-bold text-zinc-200">{copy.controllerTitle}</h4>
                <p>{copy.controllerBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200">{copy.purposeTitle}</h4>
                <p>{copy.purposeBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200">{copy.typesTitle}</h4>
                <p className="whitespace-pre-line">{copy.typesBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200">{copy.retentionTitle}</h4>
                <p>{copy.retentionBody}</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-200">{copy.rightsTitle}</h4>
                <p>{copy.rightsBody}</p>
              </div>
            </div>
          </details>

          {consentError && (
            <p className="text-xs text-rose-400 text-center font-medium">
              {lang === "id"
                ? "Harap setujui persetujuan album untuk melanjutkan."
                : "Please agree to the album consent to start."}
            </p>
          )}

          <button
            type="submit"
            disabled={!consentAlbum}
            className="w-full py-4 px-6 rounded-xl bg-accent text-accent-fg font-bold text-base shadow-lg shadow-amber-950/40 hover:brightness-110 active:scale-[0.99] transition-all touch-manipulation cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t(lang, "startCamera")}
          </button>
        </form>

        <div className="w-full mt-3">
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

        {/* Continue Roll / Restore Link */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="text-xs text-zinc-400 hover:text-amber-300 underline underline-offset-4 transition font-medium cursor-pointer"
          >
            {t(lang, "continueRoll")}
          </button>
        </div>
      </div>

      {/* Footer: Privacy Note */}
      <footer className="text-center pt-4">
        <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5 text-zinc-400"
          >
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
              clipRule="evenodd"
            />
          </svg>
          {t(lang, "privacy")}
        </p>
      </footer>

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
