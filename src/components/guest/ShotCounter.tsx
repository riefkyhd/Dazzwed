"use client";

import React from "react";
import { type Lang, t } from "@/lib/i18n";

interface ShotCounterProps {
  shotsLeft: number;
  lang: Lang;
}

export function ShotCounter({ shotsLeft, lang }: ShotCounterProps) {
  const label = shotsLeft === 1 ? t(lang, "shotsLeftOne") : t(lang, "shotsLeft", { n: shotsLeft });

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 shadow-lg">
      {/* Retro LCD display window */}
      <div className="flex items-center justify-center min-w-8 h-6 px-1.5 rounded bg-[#1c1b18] border border-zinc-700/80 font-mono font-bold text-[#ffb000] text-sm tracking-widest shadow-inner">
        {String(Math.max(0, shotsLeft)).padStart(2, "0")}
      </div>
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-semibold">
        {label}
      </span>
    </div>
  );
}
