"use client";

import React, { useEffect, useState, useRef } from "react";
import { triggerHaptic } from "@/lib/camera/haptics";

interface ViewfinderGesturesProps {
  showGrid: boolean;
  showLevel: boolean;
  onFocusTap?: (x: number, y: number) => void;
  onExposureChange?: (deltaEV: number) => void;
  exposureCompensation?: number;
  zoom: number;
  onResetZoom?: () => void;
  aeAfLocked?: boolean;
  onToggleAeAfLock?: () => void;
}

export function ViewfinderGestures({
  showGrid,
  showLevel,
  onFocusTap,
  onExposureChange,
  zoom,
  onResetZoom,
  aeAfLocked,
  onToggleAeAfLock,
}: ViewfinderGesturesProps) {
  // Focus ring state: position (x, y) & active timer
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);
  const [sunOffset, setSunOffset] = useState<number>(0);
  const [tiltDegrees, setTiltDegrees] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Device orientation listener for horizon level
  useEffect(() => {
    if (!showLevel) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        // gamma is left-to-right tilt in degrees [-90, 90]
        setTiltDegrees(Math.round(e.gamma));
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [showLevel]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    touchStartY.current = e.clientY;

    // Start long-press timer for AE/AF lock (600ms)
    longPressTimer.current = setTimeout(() => {
      triggerHaptic([40, 40]);
      onToggleAeAfLock?.();
    }, 600);

    setFocusRing({ x, y });
    setSunOffset(0);
    onFocusTap?.(x / rect.width, y / rect.height);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (touchStartY.current !== null && focusRing) {
      const deltaY = touchStartY.current - e.clientY;
      if (Math.abs(deltaY) > 8) {
        // Clear long press if user is dragging exposure
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        setSunOffset(deltaY);
        // Map delta to [-2.0, +2.0] EV
        const evDelta = Math.max(-2, Math.min(2, deltaY / 40));
        onExposureChange?.(evDelta);
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartY.current = null;
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="absolute inset-0 z-10 touch-none pointer-events-auto"
    >
      {/* Rule of Thirds Grid Overlay */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-25">
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-white" />
          <div className="border-r border-white" />
          <div />
        </div>
      )}

      {/* Horizon Level Indicator */}
      {showLevel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            style={{ transform: `rotate(${-tiltDegrees}deg)` }}
            className="flex items-center gap-4 transition-transform duration-100 ease-out"
          >
            <div className={`w-8 h-0.5 rounded-full ${Math.abs(tiltDegrees) <= 1 ? "bg-amber-400" : "bg-white/40"}`} />
            <div className={`w-2 h-2 rounded-full border border-white/60 ${Math.abs(tiltDegrees) <= 1 ? "bg-amber-400" : "bg-transparent"}`} />
            <div className={`w-8 h-0.5 rounded-full ${Math.abs(tiltDegrees) <= 1 ? "bg-amber-400" : "bg-white/40"}`} />
          </div>
        </div>
      )}

      {/* AE/AF LOCK Pill */}
      {aeAfLocked && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-amber-400 text-black font-mono font-bold text-[11px] shadow-lg animate-pulse pointer-events-none">
          AE/AF LOCK
        </div>
      )}

      {/* Interactive Focus Ring & Exposure Slider */}
      {focusRing && (
        <div
          style={{ left: focusRing.x, top: focusRing.y }}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          {/* Animated Focus Box */}
          <div className="w-16 h-16 border-2 border-amber-400 rounded-sm animate-in zoom-in-75 duration-150 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
          </div>

          {/* Exposure Sun icon */}
          <div
            style={{ transform: `translate(42px, ${-sunOffset}px)` }}
            className="absolute top-1/2 -translate-y-1/2 text-amber-400 transition-transform duration-75"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 drop-shadow">
              <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
            </svg>
          </div>
        </div>
      )}

      {/* Floating Zoom Snap Pill (Shows when zoom != 1x; double-tap resets) */}
      {zoom > 1.05 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={onResetZoom}
            aria-label="Snap zoom back to 1x"
            className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white font-mono text-xs font-bold active:scale-90 transition-all shadow-lg pointer-events-auto cursor-pointer"
          >
            {zoom.toFixed(1)}x &bull; Tap 1x
          </button>
        </div>
      )}
    </div>
  );
}
