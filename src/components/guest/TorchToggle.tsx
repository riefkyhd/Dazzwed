"use client";

import React from "react";
import { type Lang, t } from "@/lib/i18n";

interface TorchToggleProps {
  available: boolean;
  on: boolean;
  onToggle: () => void;
  lang: Lang;
}

export function TorchToggle({ available, on, onToggle, lang }: TorchToggleProps) {
  if (!available) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t(lang, "torch")}
      className={`p-2.5 rounded-full backdrop-blur-md border transition-all ${
        on
          ? "bg-accent text-accent-fg border-accent shadow-md shadow-amber-500/20"
          : "bg-zinc-950/70 text-zinc-300 border-zinc-700/60 hover:text-white"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5"
      >
        <path d="M12 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 2Zm0 16a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 18ZM4.22 4.22a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L4.22 5.28a.75.75 0 0 1 0-1.06Zm13.44 13.44a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm-13.44 0a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm13.44-13.44a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
      </svg>
    </button>
  );
}
