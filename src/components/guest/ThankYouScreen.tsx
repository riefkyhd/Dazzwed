"use client";

import React from "react";
import { type Lang, t } from "@/lib/i18n";
import { SyncBadge } from "./SyncBadge";

interface ThankYouScreenProps {
  coupleNames: string;
  lang: Lang;
  pendingCount: number;
}

export function ThankYouScreen({ coupleNames, lang, pendingCount }: ThankYouScreenProps) {
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
      </div>

      <footer className="text-xs text-zinc-600 font-mono tracking-wider uppercase">
        {coupleNames}
      </footer>
    </div>
  );
}
