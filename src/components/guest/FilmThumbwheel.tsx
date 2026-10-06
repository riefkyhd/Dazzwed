"use client";

import React, { useState, useEffect } from "react";
import { triggerHaptic } from "@/lib/camera/haptics";

interface FilmThumbwheelProps {
  advancing: boolean;
  onAdvanceComplete?: () => void;
}

export function FilmThumbwheel({ advancing, onAdvanceComplete }: FilmThumbwheelProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (advancing) {
      // Simulate mechanical gear turning through successive clicks
      triggerHaptic([30, 40, 50]);
      setRotation((r) => r + 72); // turn one notch
      const timer = setTimeout(() => {
        onAdvanceComplete?.();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [advancing, onAdvanceComplete]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Ribbed thumbwheel gear visible from camera top-right */}
      <div
        className="w-12 h-6 rounded-t-lg bg-zinc-800 border border-zinc-600/70 overflow-hidden shadow-inner transition-transform duration-500 ease-out flex items-center justify-around px-1"
        style={{
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <span className="w-0.5 h-full bg-zinc-950" />
        <span className="w-0.5 h-full bg-zinc-950" />
        <span className="w-0.5 h-full bg-zinc-950" />
        <span className="w-0.5 h-full bg-zinc-950" />
        <span className="w-0.5 h-full bg-zinc-950" />
      </div>
      <span className="text-[9px] font-mono uppercase tracking-tighter text-zinc-500 mt-0.5">
        WIND
      </span>
    </div>
  );
}
