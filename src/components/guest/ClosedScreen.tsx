"use client";

import React from "react";
import { type Lang, t } from "@/lib/i18n";
import type { EventStatus } from "@/lib/event";

interface ClosedScreenProps {
  coupleNames: string;
  status: EventStatus;
  opensAt: string | null;
  lang: Lang;
}

export function ClosedScreen({ coupleNames, status, opensAt, lang }: ClosedScreenProps) {
  let bodyText = t(lang, "closedManualBody");
  if (status === "before") {
    const formatted = opensAt ? new Date(opensAt).toLocaleDateString() : "";
    bodyText = t(lang, "closedBeforeBody", { date: formatted });
  } else if (status === "after") {
    bodyText = t(lang, "closedAfterBody");
  }

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto px-6 py-12 justify-center items-center text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-8 h-8"
        >
          <path
            fillRule="evenodd"
            d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <h1 className="font-serif text-3xl text-zinc-300 font-normal mb-3">
        {t(lang, "closedTitle")}
      </h1>

      <p className="text-sm text-zinc-400 max-w-xs leading-relaxed mb-6">
        {bodyText}
      </p>

      <span className="font-serif text-accent text-lg">{coupleNames}</span>
    </div>
  );
}
