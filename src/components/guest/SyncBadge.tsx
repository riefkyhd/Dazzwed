"use client";

import React from "react";
import { type Lang, t } from "@/lib/i18n";

interface SyncBadgeProps {
  pendingCount: number;
  lang: Lang;
}

export function SyncBadge({ pendingCount, lang }: SyncBadgeProps) {
  if (pendingCount <= 0) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/60 backdrop-blur-md border border-zinc-800 text-[11px] text-zinc-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>{t(lang, "synced")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/70 backdrop-blur-md border border-amber-800/80 text-[11px] text-amber-300 shadow-sm animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      <span>{t(lang, "pending", { n: pendingCount })}</span>
    </div>
  );
}
