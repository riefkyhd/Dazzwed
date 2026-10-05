"use client";

import React, { useState } from "react";
import { type Lang, t } from "@/lib/i18n";
import { NativeCameraInput } from "./NativeCameraInput";

interface LandingScreenProps {
  coupleNames: string;
  shotsPerGuest: number;
  eventSlug: string;
  lang: Lang;
  onLanguageChange: (lang: Lang) => void;
  onStartCamera: (name: string | null) => void;
  onNativePhoto: (file: File, name: string | null) => void;
}

export function LandingScreen({
  coupleNames,
  shotsPerGuest,
  eventSlug,
  lang,
  onLanguageChange,
  onStartCamera,
  onNativePhoto,
}: LandingScreenProps) {
  const [name, setName] = useState("");

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    onStartCamera(name.trim() || null);
  };

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto px-6 py-8 justify-between">
      {/* Top Bar: Lang toggle */}
      <div className="flex justify-end items-center">
        <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => onLanguageChange("en")}
            className={`px-2.5 py-1 rounded-full transition-all ${
              lang === "en"
                ? "bg-accent text-accent-fg font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange("id")}
            className={`px-2.5 py-1 rounded-full transition-all ${
              lang === "id"
                ? "bg-accent text-accent-fg font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ID
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center text-center my-auto py-6">
        <div className="inline-block px-3 py-1 mb-4 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-mono tracking-widest uppercase">
          {t(lang, "appName")}
        </div>

        <p className="text-sm font-sans tracking-wide text-zinc-400 uppercase mb-2">
          {t(lang, "welcomeTo")}
        </p>

        <h1 className="font-serif text-4xl sm:text-5xl text-accent font-normal leading-tight mb-8">
          {coupleNames}
        </h1>

        {/* Disposable Cam Instructions */}
        <div className="w-full bg-surface/70 border border-zinc-800/80 rounded-2xl p-5 mb-8 text-left space-y-3.5 backdrop-blur-sm shadow-xl">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-1">
            {t(lang, "howItWorks")}
          </h2>

          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-accent font-mono text-xs flex items-center justify-center font-bold">
              1
            </span>
            <p className="text-sm text-zinc-200 pt-0.5">
              {t(lang, "step1", { n: shotsPerGuest })}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-accent font-mono text-xs flex items-center justify-center font-bold">
              2
            </span>
            <p className="text-sm text-zinc-200 pt-0.5">{t(lang, "step2")}</p>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-accent font-mono text-xs flex items-center justify-center font-bold">
              3
            </span>
            <p className="text-sm text-zinc-200 pt-0.5">{t(lang, "step3")}</p>
          </div>
        </div>

        {/* Form: Optional Name */}
        <form onSubmit={handleStart} className="w-full space-y-4">
          <div className="text-left">
            <label
              htmlFor="guest-name"
              className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1"
            >
              {t(lang, "yourName")}
            </label>
            <input
              id="guest-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "yourNamePlaceholder")}
              maxLength={60}
              className="w-full px-4 py-3.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white placeholder-zinc-500 focus:outline-none focus:border-accent text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-xl bg-accent text-accent-fg font-bold text-base shadow-lg shadow-amber-950/40 hover:brightness-110 active:scale-[0.99] transition-all touch-manipulation cursor-pointer"
          >
            {t(lang, "startCamera")}
          </button>
        </form>

        <div className="w-full mt-3">
          <NativeCameraInput
            eventSlug={eventSlug}
            onFileSelected={(file) => onNativePhoto(file, name.trim() || null)}
            lang={lang}
            variant="secondary"
          />
        </div>
      </div>

      {/* Footer: Privacy Note */}
      <footer className="text-center pt-4">
        <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5 text-zinc-400"
          >
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
              clipRule="evenodd"
            />
          </svg>
          {t(lang, "privacy")}
        </p>
      </footer>
    </div>
  );
}
