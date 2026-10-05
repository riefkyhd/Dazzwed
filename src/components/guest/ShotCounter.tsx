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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-accent/40 shadow-md">
      <div className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-zinc-950 border border-zinc-700/60 font-mono font-bold text-accent text-sm tracking-wider">
        {Math.max(0, shotsLeft)}
      </div>
      <span className="text-xs uppercase tracking-widest text-zinc-300 font-medium">
        {label}
      </span>
    </div>
  );
}
