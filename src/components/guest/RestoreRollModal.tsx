"use client";

import React, { useState } from "react";
import { type Lang, t } from "@/lib/i18n";
import { normalizeRollCode } from "@/lib/guest/session";
import { saveLocalConsent } from "@/lib/guest/consent";
import { CONSENT_COPY, CONSENT_VERSION } from "@/constants/consentCopy";

interface RestoreRollModalProps {
  isOpen: boolean;
  eventSlug: string;
  lang: Lang;
  initialConsentAlbum?: boolean;
  initialConsentTelemetry?: boolean;
  onClose: () => void;
  onSuccess: (data: { guestId: string; name: string | null; rollCode: string; shotsLeft: number }) => void;
}

export function RestoreRollModal({
  isOpen,
  eventSlug,
  lang,
  initialConsentAlbum = false,
  initialConsentTelemetry = false,
  onClose,
  onSuccess,
}: RestoreRollModalProps) {
  const [code, setCode] = useState("");
  const [consentAlbum, setConsentAlbum] = useState(initialConsentAlbum);
  const [consentTelemetry, setConsentTelemetry] = useState(initialConsentTelemetry);
  const [consentError, setConsentError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rendered, setRendered] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  const copy = CONSENT_COPY[lang];

  React.useEffect(() => {
    if (isOpen) {
      setRendered(true);
      const timer = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => {
        setRendered(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!rendered) return null;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizeRollCode(code);
    if (cleanCode.length < 6) {
      setError(t(lang, "restoreError"));
      return;
    }

    if (!consentAlbum) {
      setConsentError(true);
      return;
    }

    setLoading(true);
    setError(null);
    setConsentError(false);

    try {
      const res = await fetch("/api/guests/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          rollCode: cleanCode,
          consentVersion: CONSENT_VERSION,
          consentAlbum: true,
          consentTelemetry,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || t(lang, "restoreError"));
        setLoading(false);
        return;
      }

      const data = (await res.json()) as {
        guestId: string;
        name: string | null;
        rollCode: string;
        shotsPerGuest: number;
        shotsUsed: number;
      };

      // Record explicit consent locally on this device
      saveLocalConsent({ album: true, telemetry: consentTelemetry });

      const remaining = Math.max(0, data.shotsPerGuest - data.shotsUsed);
      onSuccess({
        guestId: data.guestId,
        name: data.name,
        rollCode: data.rollCode,
        shotsLeft: remaining,
      });
      handleDismiss();
    } catch {
      setError(t(lang, "restoreError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none transition-opacity duration-200 ease-out ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 text-zinc-100 shadow-2xl relative transition-all duration-200 ease-out ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 cursor-pointer"
        >
          ✕
        </button>

        <h3 className="text-lg font-bold mb-1 text-amber-300 font-mono">
          {t(lang, "restoreTitle")}
        </h3>
        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
          {t(lang, "restorePrompt")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const norm = normalizeRollCode(e.target.value);
                setCode(norm);
                setError(null);
              }}
              placeholder={t(lang, "restoreCodePlaceholder")}
              maxLength={6}
              autoFocus
              className="w-full text-center text-2xl font-mono uppercase tracking-widest px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl focus:outline-none focus:border-amber-400 text-white placeholder-zinc-600"
            />
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-2.5 pt-1 text-left">
            <label
              htmlFor="restore-consent-album"
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer select-none ${
                consentError
                  ? "border-rose-500/80 bg-rose-950/20"
                  : consentAlbum
                  ? "border-accent/40 bg-accent/5"
                  : "border-zinc-800 bg-zinc-950/40"
              }`}
            >
              <input
                id="restore-consent-album"
                type="checkbox"
                required
                aria-required="true"
                checked={consentAlbum}
                onChange={(e) => {
                  setConsentAlbum(e.target.checked);
                  if (e.target.checked) setConsentError(false);
                }}
                className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 bg-zinc-800 cursor-pointer"
              />
              <span className="text-[11px] text-zinc-200 leading-tight">
                <span className="text-amber-400 font-bold mr-1">*</span>
                {copy.checkboxAlbum}
              </span>
            </label>

            <label
              htmlFor="restore-consent-telemetry"
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer select-none ${
                consentTelemetry
                  ? "border-accent/40 bg-accent/5"
                  : "border-zinc-800 bg-zinc-950/40"
              }`}
            >
              <input
                id="restore-consent-telemetry"
                type="checkbox"
                checked={consentTelemetry}
                onChange={(e) => setConsentTelemetry(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 bg-zinc-800 cursor-pointer"
              />
              <span className="text-[11px] text-zinc-400 leading-tight">
                {copy.checkboxTelemetry}
              </span>
            </label>
          </div>

          {error && (
            <p className="text-xs text-rose-400 text-center font-medium">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium text-xs hover:bg-zinc-800 transition"
            >
              {t(lang, "close")}
            </button>
            <button
              type="submit"
              disabled={loading || code.length < 6 || !consentAlbum}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-bold text-xs transition cursor-pointer"
            >
              {loading ? "…" : t(lang, "restoreBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
