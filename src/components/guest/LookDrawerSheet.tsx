"use client";

import React, { useState, useEffect } from "react";
import type { LookRecipe } from "@/lib/imaging/looks/types";
import { LookDial } from "./LookDial";
import type { Lang } from "@/lib/i18n";

interface LookDrawerSheetProps {
  open: boolean;
  onClose: () => void;
  activeLook: LookRecipe;
  onSelectLook: (look: LookRecipe) => void;
  allowedLookIds?: string[];
  lang: Lang;
}

export function LookDrawerSheet({
  open,
  onClose,
  activeLook,
  onSelectLook,
  allowedLookIds,
  lang,
}: LookDrawerSheetProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const timer = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => {
        setRendered(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!rendered) return null;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === "id" ? "Pilih Filter Film" : "Select Film Look"}
      className={`fixed inset-0 z-50 flex flex-col justify-end bg-black/60 select-none transition-opacity duration-250 ease-out ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop tap to dismiss */}
      <div className="flex-1 cursor-pointer" onClick={handleDismiss} />

      {/* Sheet Content with slide-up / slide-down physics */}
      <div
        style={{ paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))" }}
        className={`w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-700/80 rounded-t-3xl p-6 space-y-4 shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Grab Handle Pill */}
        <div className="w-10 h-1 rounded-full bg-zinc-600/70 mx-auto -mt-2 mb-2" />

        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            {lang === "id" ? "Pilih Filter Film" : "Select Film Look"}
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="py-2">
          <div className="w-full">
            <LookDial
              activeLook={activeLook}
              onSelectLook={(l) => {
                onSelectLook(l);
                handleDismiss();
              }}
              allowedLookIds={allowedLookIds}
              isCollapsed={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
