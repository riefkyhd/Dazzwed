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
import {
  createInitialGestureState,
  processGestureEvent,
  type GestureState,
} from "@/lib/camera/gesture-machine";

interface ViewfinderGesturesProps {
  showGrid: boolean;
  showLevel: boolean;
  onFocusTap?: (x: number, y: number) => void;
  onExposureChange?: (deltaEV: number) => void;
  exposureCompensation?: number;
  zoom: number;
  onZoomChange?: (newZoom: number) => void;
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
  onZoomChange,
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
  const gestureStateRef = useRef<GestureState>(createInitialGestureState());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const easeTimer = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastTapTime = useRef<number>(0);
  const dragStartEV = useRef<number>(0);
  const lastHapticZone = useRef<"negative" | "zero" | "positive">("zero");
  const rafZoomRef = useRef<number | null>(null);

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

  // Smoothly ease EV bias back to 0.0 over 300ms ease-out
  const easeEVToZero = useCallback(() => {
    if (easeTimer.current) cancelAnimationFrame(easeTimer.current);

    const startEV = currentEV;
    if (Math.abs(startEV) < 0.01) {
      setCurrentEV(0);
      onExposureChange?.(0);
      return;
    }

    const duration = 300; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Quad ease-out: 1 - (1 - t)^2
      const ease = 1 - Math.pow(1 - progress, 2);
      const val = startEV * (1 - ease);

      setCurrentEV(val);
      onExposureChange?.(val);

      if (progress < 1) {
        easeTimer.current = requestAnimationFrame(step);
      } else {
        setCurrentEV(0);
        onExposureChange?.(0);
      }
    };

    easeTimer.current = requestAnimationFrame(step);
  }, [currentEV, onExposureChange]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (easeTimer.current) cancelAnimationFrame(easeTimer.current);
      if (rafZoomRef.current) cancelAnimationFrame(rafZoomRef.current);
    };
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

  // Hit-test if coordinates fall inside the focus ring / exposure slider
  const isRingHit = useCallback(
    (x: number, y: number) => {
      if (!focusState || !isVisible) return false;
      const ringDist = Math.hypot(x - focusState.x, y - focusState.y);
      return ringDist <= FOCUS_BOX_SIZE;
    },
    [focusState, isVisible]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const time = performance.now();

    // Check for double-tap reset (within 300ms)
    if (e.isPrimary && time - lastTapTime.current < 300 && focusState) {
      lastTapTime.current = 0;
      easeEVToZero();
      triggerHaptic([25]);
      restartHideTimer();
      return;
    }
    if (e.isPrimary) lastTapTime.current = time;

    // Process event through gesture state machine
    const { nextState, action } = processGestureEvent(
      gestureStateRef.current,
      {
        type: "POINTER_DOWN",
        id: e.pointerId,
        x: localX,
        y: localY,
        time,
        currentZoom: zoom,
      },
      isRingHit
    );
    gestureStateRef.current = nextState;

    if (action.type === "PINCH_START") {
      // Cancel focus ring and slider when pinching
      setIsVisible(false);
      setIsDragging(false);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    } else if (action.type === "SLIDER_DRAG_START") {
      setIsDragging(true);
      dragStartEV.current = currentEV;
    } else {
      // Tap candidate: start long press timer for AE/AF lock (600ms)
      longPressTimer.current = setTimeout(() => {
        triggerHaptic([40, 40]);
        onToggleAeAfLock?.();
      }, 600);
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const time = performance.now();

    const { nextState, action } = processGestureEvent(gestureStateRef.current, {
      type: "POINTER_MOVE",
      id: e.pointerId,
      x: localX,
      y: localY,
      time,
    });
    gestureStateRef.current = nextState;

    if (action.type === "PINCH_UPDATE" && action.zoom !== undefined) {
      // Throttle zoom callback per animation frame
      const targetZoom = action.zoom;
      if (rafZoomRef.current) cancelAnimationFrame(rafZoomRef.current);
      rafZoomRef.current = requestAnimationFrame(() => {
        onZoomChange?.(targetZoom);
      });
    } else if (action.type === "SLIDER_DRAG_START") {
      setIsDragging(true);
      dragStartEV.current = currentEV;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    } else if (action.type === "SLIDER_DRAG_UPDATE" && action.deltaY !== undefined && focusState) {
      const newEV = pointerDeltaToEV(dragStartEV.current, action.deltaY, focusState.trackHeight);
      setCurrentEV(newEV);
      onExposureChange?.(newEV);

      // Haptic feedback
      if (Math.abs(newEV) < 0.1 && lastHapticZone.current !== "zero") {
        triggerHaptic(15);
        lastHapticZone.current = "zero";
      } else if (newEV >= 1.95 && lastHapticZone.current !== "positive") {
        triggerHaptic([20, 20]);
        lastHapticZone.current = "positive";
      } else if (newEV <= -1.95 && lastHapticZone.current !== "negative") {
        triggerHaptic([20, 20]);
        lastHapticZone.current = "negative";
      }
      restartHideTimer();
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const time = performance.now();

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const { nextState, action } = processGestureEvent(gestureStateRef.current, {
      type: e.type === "pointercancel" ? "POINTER_CANCEL" : "POINTER_UP",
      id: e.pointerId,
      x: localX,
      y: localY,
      time,
    });
    gestureStateRef.current = nextState;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (action.type === "TAP" && action.x !== undefined && action.y !== undefined) {
      // Tap recognized! If AE/AF was locked, tapping elsewhere unlocks it
      if (aeAfLocked) {
        onToggleAeAfLock?.();
      }

      // If prior bias existed, ease smoothly back to 0.0 before metering new point
      if (Math.abs(currentEV) > 0.05) {
        easeEVToZero();
      }

      // Anchor focus ring cleanly inside viewfinder
      const anchor = calculateFocusAnchor(action.x, action.y, rect.width, rect.height);
      setFocusState({
        x: anchor.ringX,
        y: anchor.ringY,
        trackSide: anchor.trackSide,
        trackHeight: anchor.trackHeight,
      });
      setIsVisible(true);
      onFocusTap?.(action.x / rect.width, action.y / rect.height);
      restartHideTimer();
    } else if (action.type === "SLIDER_DRAG_END") {
      setIsDragging(false);
      restartHideTimer();
    }
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
