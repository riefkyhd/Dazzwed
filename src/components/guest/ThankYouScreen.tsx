"use client";

import React from "react";
import { type Lang, t } from "@/lib/i18n";
import { SyncBadge } from "./SyncBadge";

interface ThankYouScreenProps {
  coupleNames: string;
  lang: Lang;
  pendingCount: number;
  onCheckRoll?: () => Promise<void> | void;
  isCheckingRoll?: boolean;
}

export function ThankYouScreen({ coupleNames, lang, pendingCount, onCheckRoll, isCheckingRoll }: ThankYouScreenProps) {
  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto px-6 py-10 justify-between items-center text-center">
      <div className="w-full flex justify-end">
        <SyncBadge pendingCount={pendingCount} lang={lang} />
      </div>

      <div className="my-auto py-8 space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 border border-accent/30 text-accent flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8"
          >
            <path
              fillRule="evenodd"
              d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="font-serif text-4xl text-accent font-normal">
          {t(lang, "thanksTitle")}
        </h1>

        <p className="text-zinc-300 text-sm leading-relaxed max-w-xs mx-auto">
          {t(lang, "thanksBody")}
        </p>

        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-400 space-y-2">
          <p>{t(lang, "thanksNote")}</p>
          {pendingCount > 0 && (
            <p className="text-amber-400/90 font-medium">
              {t(lang, "thanksSaving")}
            </p>
          )}
        </div>

        {onCheckRoll && (
          <div className="pt-2">
            <button
              type="button"
              disabled={isCheckingRoll}
              onClick={() => void onCheckRoll()}
              className="px-4 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-mono text-zinc-300 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2 mx-auto shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 text-accent ${isCheckingRoll ? "animate-spin" : ""}`}>
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.75A.75.75 0 0 0 3 12.83v4.482a.75.75 0 0 0 1.5 0v-2.185l.407.407a7 7 0 0 0 11.93-3.414.75.75 0 0 0-1.525-.301Zm-10.624-2.848a5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h4.482A.75.75 0 0 0 17 7.17V2.688a.75.75 0 0 0-1.5 0v2.185l-.407-.407A7 7 0 0 0 3.163 7.88a.75.75 0 0 0 1.525.301Z" clipRule="evenodd" />
              </svg>
              <span>{isCheckingRoll ? (lang === "id" ? "Memeriksa…" : "Checking…") : t(lang, "checkNewRoll")}</span>
            </button>
          </div>
        )}
      </div>

      <footer className="text-xs text-zinc-600 font-mono tracking-wider uppercase">
        {coupleNames}
      </footer>
    </div>
  );
}
