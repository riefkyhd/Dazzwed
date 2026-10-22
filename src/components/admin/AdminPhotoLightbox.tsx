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
          <span className="px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/10 text-zinc-200 font-mono font-medium text-xs shrink-0">
            {currentIndex + 1} / {photos.length}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-zinc-200 font-medium truncate">
              <span className="text-amber-400 font-mono font-semibold shrink-0">Roll {rollCode}</span>
              {guestName && <span className="text-zinc-300 truncate">• {guestName}</span>}
              <span className="text-zinc-600">•</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[11px] truncate">
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
          className="shrink-0 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
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
          className="hidden md:flex absolute left-4 z-20 w-11 h-11 rounded-full bg-black/60 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-white items-center justify-center backdrop-blur-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Progressive Photo Stage (Thumb Base + HD Top) or Error State */}
        {hasError ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-zinc-950/90 border border-zinc-800 text-center max-w-sm pointer-events-auto shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-3 text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-zinc-200">File Removed from Google Drive</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">This photo was moved or deleted from the event Google Drive folder.</p>
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
          className="hidden md:flex absolute right-4 z-20 w-11 h-11 rounded-full bg-black/60 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-white items-center justify-center backdrop-blur-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="9 18 15 12 9 6" />
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
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next photo"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Center: Film vs RAW Original Segmented Toggle */}
        <div className="flex items-center bg-zinc-900/90 border border-white/10 p-0.5 rounded-xl min-h-[44px] shrink-0">
          <button
            type="button"
            onClick={() => {
              if (mode !== "filtered") {
                setHdLoaded(false);
                setMode("filtered");
              }
            }}
            className={`min-h-[38px] px-3 sm:px-4 rounded-lg font-medium text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              mode === "filtered"
                ? "bg-white/[0.12] text-white font-semibold shadow-sm border border-white/15"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-400">
              <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
              <path d="m17 4 3 3" />
              <path d="m14 7 3 3" />
            </svg>
            <span>Film</span>
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
            className={`min-h-[38px] px-3 sm:px-4 rounded-lg font-medium text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
              !activePhoto.original_drive_file_id
                ? "text-zinc-600 cursor-not-allowed"
                : mode === "original"
                  ? "bg-white/[0.12] text-white font-semibold shadow-sm border border-white/15 cursor-pointer"
                  : "text-zinc-400 hover:text-zinc-200 cursor-pointer"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-400">
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span>Original</span>
          </button>
        </div>

        {/* Right: 1-Click HD Download */}
        <div className="shrink-0">
          <a
            href={`/api/admin/photos/${currentFileId}?size=original&download=1`}
            download
            className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-200 hover:text-white hover:border-amber-400/50 font-medium text-xs flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95 cursor-pointer"
            title="Download Full-Resolution Master"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
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
