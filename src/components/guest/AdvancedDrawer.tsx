"use client";

import React, { useState } from "react";
import { type Lang, t } from "@/lib/i18n";

interface AdvancedDrawerProps {
  torchAvailable: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
  lang: Lang;
}

export function AdvancedDrawer({
  torchAvailable,
  torchOn,
  onToggleTorch,
  lang,
}: AdvancedDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Expand/Collapse Handle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-white transition-all mb-2"
      >
        <span>{isOpen ? "Hide Controls" : "Advanced Controls"}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Expanded Controls Tray */}
      {isOpen && (
        <div className="w-full max-w-xs bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3 animate-in slide-in-from-bottom-2 duration-200">
          {/* Torch toggle row */}
          {torchAvailable && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-300">Flash Torch</span>
              <button
                type="button"
                onClick={onToggleTorch}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  torchOn ? "bg-amber-400 text-black" : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {torchOn ? "ON" : "OFF"}
              </button>
            </div>
          )}

          {/* Low Light Venue Hint */}
          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300/90 leading-relaxed font-sans">
            💡 <b>Dark venue?</b> Tap &quot;Use my phone&apos;s camera app&quot; below for Night mode, optical lenses, and the best low-light results.
          </div>
        </div>
      )}
    </div>
  );
}
