"use client";

import React, { useState, useEffect } from "react";
import { type Lang, t } from "@/lib/i18n";
import { getGuestGalleryPhotos, type GalleryPhoto } from "@/lib/queue/store";

interface GuestGalleryModalProps {
  isOpen: boolean;
  eventSlug: string;
  guestId: string;
  rollCode: string;
  shotsLeft: number;
  totalShots: number;
  lang: Lang;
  onClose: () => void;
}

export function GuestGalleryModal({
  isOpen,
  eventSlug,
  guestId,
  rollCode,
  shotsLeft,
  totalShots,
  lang,
  onClose,
}: GuestGalleryModalProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !guestId) return;
    let isMounted = true;
    let loadedPhotos: GalleryPhoto[] = [];
    setLoading(true);

    void getGuestGalleryPhotos(guestId).then((items) => {
      if (isMounted) {
        loadedPhotos = items;
        setPhotos(items);
        setLoading(false);
      } else {
        // If unmounted before fetch completed, revoke immediately
        items.forEach((p) => {
          if (p.thumbnailUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(p.thumbnailUrl);
          }
        });
      }
    });

    return () => {
      isMounted = false;
      loadedPhotos.forEach((p) => {
        if (p.thumbnailUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(p.thumbnailUrl);
        }
      });
    };
  }, [isOpen, guestId]);

  if (!isOpen) return null;

  const handleCopyRestoreLink = async () => {
    if (typeof window === "undefined") return;
    const restoreUrl = `${window.location.origin}/e/${eventSlug}?restore=${rollCode}`;
    try {
      await navigator.clipboard.writeText(restoreUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = (photo: GalleryPhoto) => {
    if (!photo.thumbnailUrl) return;
    const a = document.createElement("a");
    a.href = photo.thumbnailUrl;
    a.download = `DisposableCam_${rollCode}_${new Date(photo.createdAt).toISOString().slice(0, 10)}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full h-[85dvh] flex flex-col text-zinc-100 shadow-2xl overflow-hidden relative">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-amber-300 font-mono tracking-wide">
                {t(lang, "myPhotos")}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-300 border border-zinc-700">
                {photos.length} / {totalShots}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span className="font-mono text-amber-400 font-semibold">{rollCode}</span>
              <span>•</span>
              <span>{t(lang, "shotsLeft", { n: shotsLeft })}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Restore Link Strip */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/60 flex items-center justify-between text-xs">
          <div className="text-zinc-400 truncate pr-2">
            <span className="text-zinc-500">{t(lang, "yourRollCode")}: </span>
            <span className="font-mono font-bold text-zinc-200 tracking-wider">{rollCode}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyRestoreLink}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 text-[11px] font-medium border border-zinc-700 transition"
          >
            {copiedLink ? t(lang, "restoreLinkCopied") : t(lang, "copyRestoreLink")}
          </button>
        </div>

        {/* Contact Sheet / Photos Grid */}
        <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
          {loading ? (
            <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs">
              Loading roll…
            </div>
          ) : photos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <div className="w-12 h-12 rounded-full border border-dashed border-zinc-700 flex items-center justify-center mb-3 text-zinc-600">
                🎞️
              </div>
              <p className="text-sm font-medium text-zinc-400 mb-1">{t(lang, "galleryEmpty")}</p>
              <p className="text-xs text-zinc-500">{t(lang, "step1", { n: totalShots })}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {photos.map((photo, idx) => (
                <div
                  key={photo.shotId}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-amber-400/60 transition cursor-pointer"
                >
                  {photo.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.thumbnailUrl}
                      alt={`Shot ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 text-[10px] p-2 text-center font-mono">
                      <span>SAVED IN ALBUM</span>
                    </div>
                  )}

                  {/* Sync Status Overlay Pill */}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-center text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-zinc-300">
                    <span>#{photos.length - idx}</span>
                    <span className={photo.status === "synced" ? "text-emerald-400" : "text-amber-400"}>
                      {photo.status === "synced" ? "✓" : "…"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High-Res Photo Detail Modal */}
        {selectedPhoto && (
          <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-mono text-zinc-400">
                {new Date(selectedPhoto.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden my-auto rounded-2xl bg-zinc-950">
              {selectedPhoto.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPhoto.thumbnailUrl}
                  alt="Developed preview"
                  className="max-w-full max-h-[62dvh] object-contain rounded-xl shadow-2xl"
                />
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-900 transition"
              >
                {t(lang, "close")}
              </button>
              {selectedPhoto.thumbnailUrl && (
                <button
                  type="button"
                  onClick={() => handleDownload(selectedPhoto)}
                  className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition"
                >
                  {t(lang, "saveToDevice")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
