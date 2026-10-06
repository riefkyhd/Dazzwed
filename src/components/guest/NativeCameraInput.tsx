"use client";

import React, { useRef } from "react";
import { type Lang, t } from "@/lib/i18n";
import { markNativePending } from "@/lib/guest/session";

interface NativeCameraInputProps {
  eventSlug: string;
  onFileSelected: (file: File, quickThumb?: string) => void;
  disabled?: boolean;
  lang: Lang;
  variant?: "button" | "secondary";
}

export function NativeCameraInput({
  eventSlug,
  onFileSelected,
  disabled,
  lang,
  variant = "secondary",
}: NativeCameraInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (disabled) return;
    // Persist pending native shoot state before OS launches camera app
    markNativePending(eventSlug);
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create synchronous object URL immediately (<5ms) for instant visual feedback
      const quickThumb = URL.createObjectURL(file);
      onFileSelected(file, quickThumb);
    }
    // Reset input value so subsequent shots with the same filename trigger onChange
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      {variant === "button" ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="w-full py-3.5 px-4 rounded-xl bg-accent text-accent-fg font-semibold shadow-lg hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 touch-manipulation"
        >
          {t(lang, "useNativeCamera")}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-medium transition-all active:scale-95 disabled:opacity-40 touch-manipulation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-accent"
          >
            <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
            <path
              fillRule="evenodd"
              d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.112-.71l.82-1.315c.504-.805 1.367-1.338 2.333-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span>{t(lang, "useNativeCamera")}</span>
        </button>
      )}
    </>
  );
}
