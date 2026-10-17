"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { PhotoItem } from "./PhotosManagementView";

export interface AdminPhotoLightboxProps {
  photos: PhotoItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  guestMetaMap: Map<string, { rollCode: string; name: string | null }>;
}

/**
 * Computes looping previous and next photo indices for circular navigation.
 */
export function computeNeighborIndices(currentIndex: number, total: number): { prevIndex: number; nextIndex: number } {
  if (total <= 1) return { prevIndex: 0, nextIndex: 0 };
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
  const nextIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
  return { prevIndex, nextIndex };
}

/**
 * Classifies touch movement into navigation or dismissal actions based on distance thresholds.
 */
export function classifySwipeGesture(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): "next" | "prev" | "dismiss" | "none" {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX > 45 && absX > absY) {
    return deltaX < -45 ? "next" : "prev";
  }

  if (deltaY > 90 && deltaY > absX) {
    return "dismiss";
  }

  return "none";
}

/**
 * Resolves the target Google Drive file ID based on active viewing mode.
 */
export function resolveActiveFileId(
  photo: { drive_file_id: string | null; original_drive_file_id?: string | null } | null | undefined,
  mode: "filtered" | "original"
): string | null {
  if (!photo) return null;
  if (mode === "original") {
    return photo.original_drive_file_id || photo.drive_file_id;
  }
  return photo.drive_file_id;
}

/**
 * Locks document background scroll and returns a cleanup function to restore.
 */
export function applyScrollLock(
  doc: { documentElement: { style: { overflow: string } }; body: { style: { overflow: string } } },
  win?: { scrollY: number; scrollTo: (x: number, y: number) => void }
): () => void {
  const scrollY = win?.scrollY ?? 0;
  const origHtml = doc.documentElement.style.overflow;
  const origBody = doc.body.style.overflow;
  doc.documentElement.style.overflow = "hidden";
  doc.body.style.overflow = "hidden";
  return () => {
    doc.documentElement.style.overflow = origHtml;
    doc.body.style.overflow = origBody;
    win?.scrollTo?.(0, scrollY);
  };
}

/**
 * Layout and aspect-ratio containment contracts for lightbox image stages.
 * Guarantees zero cropping / zero unwanted zooming across desktop, tablet, and mobile orientations.
 */
export const LIGHTBOX_STAGE_CONTAINMENT = {
  containerClass: "relative w-full h-full min-h-0 min-w-0 flex items-center justify-center",
  imageClass: "max-h-full max-w-full w-auto h-auto object-contain rounded-lg shadow-2xl select-none",
  imageStyle: { maxHeight: "100%", maxWidth: "100%", objectFit: "contain" } as const,
};

export function AdminPhotoLightbox({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  guestMetaMap,
}: AdminPhotoLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"filtered" | "original">("filtered");
  const [hdLoaded, setHdLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Touch tracking for mobile swipe gestures
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const activePhoto = photos[currentIndex] || null;
  const guestMeta = activePhoto ? guestMetaMap.get(activePhoto.guest_id) : null;
  const rollCode = guestMeta?.rollCode || "—";
  const guestName = guestMeta?.name || null;
  const recipeName = activePhoto ? (activePhoto.preset_id || activePhoto.look_id || "disposable-400") : "";

  // 1. SSR check for React Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Reset mode and image loading state when photo index changes
  useEffect(() => {
    setMode("filtered");
    setHdLoaded(false);
    setHasError(false);
  }, [currentIndex]);

  // 3. Preload neighbors (currentIndex - 1 and currentIndex + 1)
  useEffect(() => {
    if (!isOpen || !photos.length) return;

    const { prevIndex, nextIndex } = computeNeighborIndices(currentIndex, photos.length);
    const neighbors = [photos[prevIndex], photos[nextIndex]].filter(Boolean);
    neighbors.forEach((p) => {
      if (p.drive_file_id) {
        const img = new Image();
        img.src = `/api/admin/photos/${p.drive_file_id}?size=lightbox`;
      }
    });
  }, [isOpen, currentIndex, photos]);

  // 4. Rock-solid background scroll lock (prevents scroll bleed on mobile & desktop)
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    return applyScrollLock(document, typeof window !== "undefined" ? window : undefined);
  }, [isOpen]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    const { prevIndex } = computeNeighborIndices(currentIndex, photos.length);
    onNavigate(prevIndex);
  }, [currentIndex, photos.length, onNavigate]);

  const handleNext = useCallback(() => {
    const { nextIndex } = computeNeighborIndices(currentIndex, photos.length);
    onNavigate(nextIndex);
  }, [currentIndex, photos.length, onNavigate]);

  // 5. Desktop Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (activePhoto?.original_drive_file_id) {
          setHdLoaded(false);
          setMode((m) => (m === "filtered" ? "original" : "filtered"));
        }
      }

    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, activePhoto]);

  // 6. Mobile Touch Swipe Handlers on Center Stage
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const start = touchStartRef.current;
    const end = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
    touchStartRef.current = null;

    const gesture = classifySwipeGesture(start.x, start.y, end.x, end.y);
    if (gesture === "next") {
      handleNext();
    } else if (gesture === "prev") {
      handlePrev();
    } else if (gesture === "dismiss") {
      onClose();
    }
  };

  if (!mounted || !isOpen || !activePhoto) return null;

  const currentFileId = resolveActiveFileId(activePhoto, mode);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-black/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none overscroll-none touch-none"
    >
      {/* ZONE 1 — TOP HEADER BAR */}
      <header className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 border-b border-white/10 bg-black/60 z-10">
        {/* Left: Metadata */}
        <div className="min-w-0 pr-3 flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black font-mono font-bold text-xs shrink-0">
            {currentIndex + 1} / {photos.length}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-white font-medium truncate">
              <span className="text-amber-300 font-mono font-semibold shrink-0">Roll {rollCode}</span>
              {guestName && <span className="text-stone-300 truncate">• {guestName}</span>}
              <span className="text-stone-500">•</span>
              <span className="px-1.5 py-0.2 rounded bg-stone-800 text-stone-300 font-mono text-[11px] truncate">
                {recipeName}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Large 44x44px Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="shrink-0 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-stone-800 text-lg active:scale-95"
        >
          ✕
        </button>
      </header>

      {/* ZONE 2 — CENTER PHOTO STAGE */}
      <main
        className="flex-1 min-h-0 min-w-0 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden select-none cursor-default"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Desktop Side Chevron: Previous */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous photo"
          className="hidden md:flex absolute left-4 z-20 w-12 h-12 rounded-full bg-black/60 border border-stone-800 hover:border-amber-400 text-stone-300 hover:text-amber-300 items-center justify-center backdrop-blur-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
            <path
              fillRule="evenodd"
              d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Progressive Photo Stage (Thumb Base + HD Top) or Error State */}
        {hasError ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-stone-900/90 border border-stone-800 text-center max-w-sm pointer-events-auto shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-stone-800/80 flex items-center justify-center mb-3 text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-stone-200">File Removed from Google Drive</p>
            <p className="text-xs text-stone-400 mt-1">This photo was moved or deleted from the event Drive folder.</p>
          </div>
        ) : (
          <div
            className={LIGHTBOX_STAGE_CONTAINMENT.containerClass}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          >
            {/* Base Layer: Instant cached thumbnail (=s800) */}
            <img
              src={`/api/admin/photos/${currentFileId}?size=grid`}
              alt=""
              aria-hidden="true"
              onError={() => setHasError(true)}
              className={`${LIGHTBOX_STAGE_CONTAINMENT.imageClass} filter blur-[0.5px] transition-opacity duration-200 ${
                hdLoaded ? "opacity-0 absolute pointer-events-none" : "opacity-100 relative pointer-events-auto"
              }`}
              style={LIGHTBOX_STAGE_CONTAINMENT.imageStyle}
            />

            {/* Top Layer: HD Lightbox image (=s1600) */}
            <img
              key={`${currentFileId}-${mode}`}
              src={`/api/admin/photos/${currentFileId}?size=lightbox`}
              alt={guestName ? `Photo by ${guestName}` : "Wedding photo"}
              onLoad={() => setHdLoaded(true)}
              onError={() => setHasError(true)}
              className={`${LIGHTBOX_STAGE_CONTAINMENT.imageClass} transition-opacity duration-200 ${
                hdLoaded
                  ? "relative opacity-100 pointer-events-auto"
                  : "absolute inset-0 m-auto opacity-0 pointer-events-none"
              }`}
              style={LIGHTBOX_STAGE_CONTAINMENT.imageStyle}
            />
          </div>
        )}

        {/* Desktop Side Chevron: Next */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next photo"
          className="hidden md:flex absolute right-4 z-20 w-12 h-12 rounded-full bg-black/60 border border-stone-800 hover:border-amber-400 text-stone-300 hover:text-amber-300 items-center justify-center backdrop-blur-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
            <path
              fillRule="evenodd"
              d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </main>

      {/* ZONE 3 — BOTTOM ACTION DOCK */}
      <footer className="shrink-0 flex items-center justify-between gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-black/60 z-10">
        {/* Left: Mobile/Universal Prev & Next Pill Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous photo"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 flex items-center justify-center text-sm font-semibold transition-all active:scale-95 cursor-pointer"
          >
            ←
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next photo"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 flex items-center justify-center text-sm font-semibold transition-all active:scale-95 cursor-pointer"
          >
            →
          </button>
        </div>

        {/* Center: Film vs RAW Original Segmented Toggle */}
        <div className="flex items-center bg-stone-900 border border-stone-800 p-0.5 rounded-xl min-h-[44px] shrink-0">
          <button
            type="button"
            onClick={() => {
              if (mode !== "filtered") {
                setHdLoaded(false);
                setMode("filtered");
              }
            }}
            className={`min-h-[38px] px-3 sm:px-4 rounded-lg font-medium text-xs whitespace-nowrap transition-all cursor-pointer ${
              mode === "filtered"
                ? "bg-amber-400 text-black font-semibold shadow"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            ✦ Film
          </button>
          <button
            type="button"
            onClick={() => {
              if (activePhoto.original_drive_file_id && mode !== "original") {
                setHdLoaded(false);
                setMode("original");
              }
            }}
            disabled={!activePhoto.original_drive_file_id}
            title={activePhoto.original_drive_file_id ? "View clean RAW sensor capture" : "Clean original was not retained"}
            className={`min-h-[38px] px-3 sm:px-4 rounded-lg font-medium text-xs whitespace-nowrap transition-all ${
              !activePhoto.original_drive_file_id
                ? "text-stone-600 cursor-not-allowed"
                : mode === "original"
                  ? "bg-amber-400 text-black font-semibold shadow cursor-pointer"
                  : "text-stone-400 hover:text-stone-200 cursor-pointer"
            }`}
          >
            ◯ Original
          </button>
        </div>


        {/* Right: 1-Click HD Download */}
        <div className="shrink-0">
          <a
            href={`/api/admin/photos/${currentFileId}?size=original&download=1`}
            download
            className="min-h-[44px] px-3 sm:px-4 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 hover:text-amber-300 hover:border-amber-400/50 font-medium text-xs flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95 cursor-pointer"
            title="Download Full-Resolution Master"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span className="hidden sm:inline">Download HD</span>
            <span className="sm:hidden">HD</span>
          </a>
        </div>
      </footer>
    </div>
  );

  return createPortal(content, document.body);
}
