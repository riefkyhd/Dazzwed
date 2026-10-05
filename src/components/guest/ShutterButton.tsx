"use client";

import React from "react";

interface ShutterButtonProps {
  onShoot: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

export function ShutterButton({ onShoot, disabled, isProcessing }: ShutterButtonProps) {
  return (
    <button
      type="button"
      onClick={onShoot}
      disabled={disabled || isProcessing}
      aria-label="Take Photo"
      className="relative flex items-center justify-center w-20 h-20 rounded-full bg-zinc-800/80 border-4 border-accent p-1 transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation shadow-lg shadow-black/50"
    >
      <div
        className={`w-full h-full rounded-full transition-all duration-100 ${
          isProcessing
            ? "bg-amber-600 animate-pulse"
            : "bg-white active:bg-zinc-300"
        }`}
      />
    </button>
  );
}
