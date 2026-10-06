"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { triggerHaptic } from "@/lib/camera/haptics";
import {
  clampEV,
  calculateFocusAnchor,
  evToSunOffset,
  pointerDeltaToEV,
  FOCUS_BOX_SIZE,
  RING_TRACK_GAP,
  EV_DEFAULT,
} from "@/lib/camera/exposure-slider";

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
  exposureCompensation = 0,
  zoom,
  onResetZoom,
  aeAfLocked,
  onToggleAeAfLock,
}: ViewfinderGesturesProps) {
  // Focus ring state & track anchor
  const [focusState, setFocusState] = useState<{
    x: number;
    y: number;
    trackSide: "right" | "left";
    trackHeight: number;
  } | null>(null);

  // Current exposure EV [-2.0, +2.0]
  const [currentEV, setCurrentEV] = useState<number>(() => clampEV(exposureCompensation));
  // Dragging and UI visibility states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [tiltDegrees, setTiltDegrees] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef<number>(0);
  const dragStartEV = useRef<number>(0);
  const touchStartY = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const lastHapticZone = useRef<"negative" | "zero" | "positive">("zero");

  // Keep internal EV state in sync when external prop changes (e.g. preset reset)
  useEffect(() => {
    setCurrentEV(clampEV(exposureCompensation));
  }, [exposureCompensation]);

  // Restart 3-second auto-hide timer
  const restartHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setIsVisible(false);
      // Wait for fade out animation before resetting focus box
      setTimeout(() => {
        setFocusState(null);
      }, 300);
    }, 3000);
  }, []);

  // Device orientation listener for horizon level
  useEffect(() => {
    if (!showLevel) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        setTiltDegrees(Math.round(e.gamma));
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [showLevel]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to primary pointer; ignore secondary touches
    if (!e.isPrimary) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX;
    const clientY = e.clientY;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    // Check for double-tap reset (within 300ms)
    const now = performance.now();
    if (now - lastTapTime.current < 300 && focusState) {
      lastTapTime.current = 0;
      setCurrentEV(EV_DEFAULT);
      onExposureChange?.(EV_DEFAULT);
      triggerHaptic([25]);
      restartHideTimer();
      return;
    }
    lastTapTime.current = now;

    // Capture pointer so dragging outside container or screen keeps working
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if capture fails in unsupported test environments
    }

    // Determine safe anchor bounds inside viewfinder
    const anchor = calculateFocusAnchor(localX, localY, rect.width, rect.height);
    setFocusState({
      x: anchor.ringX,
      y: anchor.ringY,
      trackSide: anchor.trackSide,
      trackHeight: anchor.trackHeight,
    });
    setIsVisible(true);

    touchStartY.current = clientY;
    dragStartEV.current = currentEV;

    // Report focus tap coordinates normalized [0, 1]
    onFocusTap?.(localX / rect.width, localY / rect.height);

    // Start long-press timer for AE/AF lock (600ms)
    longPressTimer.current = setTimeout(() => {
      triggerHaptic([40, 40]);
      onToggleAeAfLock?.();
    }, 600);

    restartHideTimer();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId || touchStartY.current === null || !focusState) {
      return;
    }

    const deltaY = e.clientY - touchStartY.current;

    // Ignore tiny accidental jitters (< 6px)
    if (!isDragging && Math.abs(deltaY) < 6) {
      return;
    }

    // Entering active drag mode
    if (!isDragging) {
      setIsDragging(true);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    // Pure EV mapping from startEV and deltaY
    const newEV = pointerDeltaToEV(dragStartEV.current, deltaY, focusState.trackHeight);
    setCurrentEV(newEV);
    onExposureChange?.(newEV);

    // Haptic feedback when crossing 0 EV or hitting limits
    if (Math.abs(newEV) < 0.1 && lastHapticZone.current !== "zero") {
      triggerHaptic(15);
      lastHapticZone.current = "zero";
    } else if (newEV >= 1.95 && lastHapticZone.current !== "positive") {
      triggerHaptic([20, 20]);
      lastHapticZone.current = "positive";
    } else if (newEV <= -1.95 && lastHapticZone.current !== "negative") {
      triggerHaptic([20, 20]);
      lastHapticZone.current = "negative";
    } else if (newEV > 0.1 && newEV < 1.95) {
      lastHapticZone.current = "positive";
    } else if (newEV < -0.1 && newEV > -1.95) {
      lastHapticZone.current = "negative";
    }

    restartHideTimer();
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe catch
      }
      activePointerId.current = null;
    }

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    setIsDragging(false);
    touchStartY.current = null;
    restartHideTimer();
  };

  // Compute sun position strictly from clamped EV
  const sunYOffset = focusState ? evToSunOffset(currentEV, focusState.trackHeight) : 0;
  const trackXOffset = focusState
    ? focusState.trackSide === "right"
      ? FOCUS_BOX_SIZE / 2 + RING_TRACK_GAP
      : -(FOCUS_BOX_SIZE / 2 + RING_TRACK_GAP)
    : 0;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      className="absolute inset-0 z-10 touch-none pointer-events-auto select-none"
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
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
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

      {/* iPhone-style Focus Ring & Exposure Slider */}
      {focusState && (
        <div
          style={{
            transform: `translate3d(${focusState.x}px, ${focusState.y}px, 0)`,
            opacity: isVisible ? 1 : 0,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-200"
        >
          {/* Animated Focus Box */}
          <div className="w-16 h-16 border border-amber-400/90 rounded-xs flex items-center justify-center shadow-xs">
            <div className="w-1 h-1 bg-amber-400 rounded-full" />
          </div>

          {/* Fixed Short Vertical Exposure Track */}
          <div
            style={{
              transform: `translate3d(${trackXOffset}px, 0, 0)`,
              height: `${focusState.trackHeight}px`,
            }}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 flex flex-col items-center justify-center transition-opacity duration-150 ${
              isDragging ? "opacity-90" : "opacity-45"
            }`}
          >
            {/* Track Line */}
            <div className="w-[1.5px] h-full bg-amber-400/70 rounded-full relative">
              {/* 0 EV Notch at vertical center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-[1.5px] bg-amber-400" />
            </div>

            {/* Sun Icon strictly bound to vertical track offset */}
            <div
              style={{
                transform: `translate3d(0, ${sunYOffset}px, 0)`,
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] pointer-events-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Floating Zoom Snap Pill (Shows when zoom != 1x; tap resets) */}
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
