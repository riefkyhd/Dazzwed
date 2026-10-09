"use client";

import React from "react";

interface ShutterButtonProps {
  onShoot: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  timerCountdown?: number;
  timerTotal?: number;
}

export function ShutterButton({
  onShoot,
  disabled,
  isProcessing,
  timerCountdown = 0,
  timerTotal = 0,
}: ShutterButtonProps) {
  const isTimerActive = timerCountdown > 0;
  const progressPercent = isTimerActive && timerTotal > 0
    ? ((timerTotal - timerCountdown) / timerTotal) * 100
    : 0;

  return (
    <button
      type="button"
      data-testid="shutter-button"
      onClick={onShoot}
      disabled={disabled || isProcessing}
      aria-label="Take Photo"
      className="relative flex items-center justify-center w-20 h-20 rounded-full bg-zinc-950/80 border-4 border-amber-400 p-1.5 transition-transform active:scale-92 disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation shadow-xl shadow-black/80 cursor-pointer"
    >
      {/* Timer circular progress ring */}
      {isTimerActive && (
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-amber-400/30"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={226}
            strokeDashoffset={226 - (226 * progressPercent) / 100}
            className="text-amber-400 transition-all duration-300 ease-linear"
          />
        </svg>
      )}

      {/* Center tactile button disc */}
      <div
        className={`w-full h-full rounded-full transition-all duration-100 flex items-center justify-center font-mono font-bold text-lg text-black ${
          isProcessing
            ? "bg-amber-600 animate-pulse"
            : isTimerActive
              ? "bg-amber-400"
              : "bg-white active:bg-zinc-200"
        }`}
      >
        {isTimerActive ? timerCountdown : null}
      </div>
    </button>
  );
}
