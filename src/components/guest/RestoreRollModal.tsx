"use client";

import React, { useState } from "react";
import { type Lang, t } from "@/lib/i18n";
import { normalizeRollCode } from "@/lib/guest/session";

interface RestoreRollModalProps {
  isOpen: boolean;
  eventSlug: string;
  lang: Lang;
  onClose: () => void;
  onSuccess: (data: { guestId: string; name: string | null; rollCode: string; shotsLeft: number }) => void;
}

export function RestoreRollModal({
  isOpen,
  eventSlug,
  lang,
  onClose,
  onSuccess,
}: RestoreRollModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizeRollCode(code);
    if (cleanCode.length < 6) {
      setError(t(lang, "restoreError"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/guests/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, rollCode: cleanCode }),
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

      const remaining = Math.max(0, data.shotsPerGuest - data.shotsUsed);
      onSuccess({
        guestId: data.guestId,
        name: data.name,
        rollCode: data.rollCode,
        shotsLeft: remaining,
      });
      onClose();
    } catch {
      setError(t(lang, "restoreError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 text-zinc-100 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
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

          {error && (
            <p className="text-xs text-rose-400 text-center font-medium">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium text-xs hover:bg-zinc-800 transition"
            >
              {t(lang, "close")}
            </button>
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-bold text-xs transition"
            >
              {loading ? "…" : t(lang, "restoreBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
