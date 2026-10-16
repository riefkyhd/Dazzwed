"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { computeRollCodeFromGuestId } from "@/lib/guest/session";

export interface GuestItem {
  id: string;
  display_name: string | null;
  drive_folder_id: string | null;
  roll_code?: string | null;
  created_at: string;
  last_seen_at: string;
  totalShots?: number;
  confirmedShots?: number;
}

export interface PhotoItem {
  id: string;
  guest_id: string;
  shot_id: string;
  drive_file_id: string | null;
  original_drive_file_id?: string | null;
  size_bytes: number | null;
  status: "pending" | "confirmed" | "failed" | "hidden";
  created_at: string;
  guestName?: string;
  look_id?: string;
  preset_id?: string | null;
}

interface PhotosManagementViewProps {
  initialGuests: GuestItem[];
  initialPhotos: PhotoItem[];
  rootFolderId: string | null;
  shotsPerGuest: number;
}

export function PhotosManagementView({
  initialGuests,
  initialPhotos,
  rootFolderId,
  shotsPerGuest,
}: PhotosManagementViewProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [viewMode, setViewMode] = useState<"editorial" | "table">("editorial");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "hidden" | "failed">("all");
  const [guestFilter, setGuestFilter] = useState<string>("all");
  const [presetFilter, setPresetFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [visibleLimit, setVisibleLimit] = useState<number>(24);

  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [lightboxMode, setLightboxMode] = useState<"filtered" | "original">("filtered");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  // Map of guestId -> roll code and name
  const guestMetaMap = useMemo(() => {
    const map = new Map<string, { rollCode: string; name: string | null }>();
    for (const g of initialGuests) {
      const rollCode = g.roll_code || computeRollCodeFromGuestId(g.id);
      map.set(g.id, { rollCode, name: g.display_name });
    }
    return map;
  }, [initialGuests]);

  // Unique film recipes detected across photos
  const availablePresets = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) {
      const preset = p.preset_id || p.look_id;
      if (preset) set.add(preset);
    }
    return Array.from(set).sort();
  }, [photos]);

  // Group photos by guest to calculate guest counts
  const guestsWithStats = useMemo(() => {
    return initialGuests.map((g) => {
      const guestPhotos = photos.filter((p) => p.guest_id === g.id);
      const confirmed = guestPhotos.filter((p) => p.status === "confirmed").length;
      const nonFailed = guestPhotos.filter((p) => p.status !== "failed").length;
      const rollCode = g.roll_code || computeRollCodeFromGuestId(g.id);
      return {
        ...g,
        roll_code: rollCode,
        totalShots: nonFailed,
        confirmedShots: confirmed,
      };
    });
  }, [initialGuests, photos]);

  // Filtered & sorted photo list
  const filteredPhotos = useMemo(() => {
    return photos
      .filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (guestFilter !== "all" && p.guest_id !== guestFilter) return false;
        if (presetFilter !== "all") {
          const effectivePreset = p.preset_id || p.look_id || "disposable-400";
          if (effectivePreset !== presetFilter) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [photos, statusFilter, guestFilter, presetFilter, sortOrder]);

  const visiblePhotos = useMemo(() => {
    return filteredPhotos.slice(0, visibleLimit);
  }, [filteredPhotos, visibleLimit]);

  // Active lightbox photo object
  const activePhoto: PhotoItem | null =
    activeLightboxIndex !== null && filteredPhotos[activeLightboxIndex]
      ? filteredPhotos[activeLightboxIndex]
      : null;

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (activeLightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setActiveLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredPhotos.length - 1));
        setLightboxMode("filtered");
      } else if (e.key === "ArrowRight") {
        setActiveLightboxIndex((prev) => (prev !== null && prev < filteredPhotos.length - 1 ? prev + 1 : 0));
        setLightboxMode("filtered");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeLightboxIndex, filteredPhotos.length]);

  const handleHide = useCallback(async (photoId: string) => {
    setActionLoading(photoId);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}/hide`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to hide photo");

      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status: "hidden" } : p))
      );
      setNotification("Photo moved to Hidden folder and marked hidden.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleUnhide = useCallback(async (photoId: string) => {
    setActionLoading(photoId);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}/unhide`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to unhide photo");

      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status: "confirmed" } : p))
      );
      setNotification("Photo restored to confirmed.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleDelete = useCallback(async (photoId: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this photo? This will delete the file from Google Drive and remove the database record."
      )
    ) {
      return;
    }

    setActionLoading(photoId);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}/delete`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to delete photo");

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (activeLightboxIndex !== null) {
        setActiveLightboxIndex(null);
      }
      setNotification("Photo deleted permanently from Google Drive and database.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeLightboxIndex]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-stone-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Wedding Archive</span>
          <h1 className="text-2xl font-serif font-bold text-white mt-1">Photo Gallery & Rolls</h1>
          <p className="text-xs text-stone-400 mt-1">
            Browse guest shots in Retina clarity, compare film graded looks vs RAW sensor originals, and manage rolls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-stone-900 border border-stone-800 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setViewMode("editorial")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "editorial"
                  ? "bg-amber-400 text-black font-semibold shadow"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <span>⊞</span>
              <span>Editorial Gallery</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-amber-400 text-black font-semibold shadow"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <span>☰</span>
              <span>Guest Rolls Table</span>
            </button>
          </div>

          {rootFolderId && (
            <a
              href={`https://drive.google.com/drive/folders/${rootFolderId}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 font-medium text-xs hover:border-amber-400/50 hover:text-amber-300 transition-all flex items-center gap-1.5 shrink-0"
              title="Open Google Drive Archive"
            >
              <span>Google Drive</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h4a.75.75 0 0 1 0 1.5h-4Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {notification && (
        <div className="p-3 mb-6 rounded-xl bg-stone-900 border border-amber-400/40 text-amber-300 text-xs flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-white cursor-pointer">&times;</button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-stone-900/60 border border-stone-800/80 p-3.5 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Guest Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-mono">Roll:</span>
            <select
              value={guestFilter}
              onChange={(e) => {
                setGuestFilter(e.target.value);
                setVisibleLimit(24);
              }}
              className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All Rolls ({guestsWithStats.length})</option>
              {guestsWithStats.map((g) => (
                <option key={g.id} value={g.id}>
                  Roll {g.roll_code} {g.display_name ? `(${g.display_name})` : ""} — {g.totalShots} shots
                </option>
              ))}
            </select>
          </div>

          {/* Film Recipe Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-mono">Recipe:</span>
            <select
              value={presetFilter}
              onChange={(e) => {
                setPresetFilter(e.target.value);
                setVisibleLimit(24);
              }}
              className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All Recipes</option>
              {availablePresets.map((recipe) => (
                <option key={recipe} value={recipe}>
                  {recipe}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-mono">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setVisibleLimit(24);
              }}
              className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All ({photos.length})</option>
              <option value="confirmed">Confirmed</option>
              <option value="hidden">Hidden</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-mono">Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="text-stone-400 font-mono text-xs">
          Showing <span className="text-amber-300 font-semibold">{visiblePhotos.length}</span> of {filteredPhotos.length} photos
        </div>
      </div>

      {/* VIEW MODE 1: EDITORIAL GALLERY */}
      {viewMode === "editorial" && (
        <div>
          {filteredPhotos.length === 0 ? (
            <div className="p-16 text-center rounded-2xl bg-stone-950 border border-stone-800 text-stone-400">
              <p className="text-sm font-serif">No photos match the selected filters.</p>
              <p className="text-xs text-stone-500 font-mono mt-1">Try clearing or switching your filters above.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {visiblePhotos.map((photo, index) => {
                  const meta = guestMetaMap.get(photo.guest_id);
                  const rollCode = meta?.rollCode || "ROLL";
                  const recipe = photo.preset_id || photo.look_id || "disposable-400";
                  const isLoaded = loadedImages[photo.id];
                  const hasDriveId = !!photo.drive_file_id;

                  return (
                    <div
                      key={photo.id}
                      onClick={() => {
                        if (hasDriveId) {
                          setActiveLightboxIndex(index);
                          setLightboxMode("filtered");
                        }
                      }}
                      className="group relative aspect-[4/5] rounded-xl overflow-hidden bg-stone-900 border border-stone-800/80 hover:border-amber-400/60 transition-all cursor-pointer shadow-md hover:shadow-xl hover:shadow-black/50"
                    >
                      {/* Image Preview with Retina streaming */}
                      {hasDriveId ? (
                        <>
                          {!isLoaded && (
                            <div className="absolute inset-0 bg-stone-900 animate-pulse flex items-center justify-center">
                              <span className="text-[10px] font-mono text-stone-600">Loading…</span>
                            </div>
                          )}
                          <img
                            src={`/api/admin/photos/${photo.drive_file_id}?size=grid`}
                            alt={`Shot by Roll ${rollCode}`}
                            loading="lazy"
                            onLoad={() => setLoadedImages((prev) => ({ ...prev, [photo.id]: true }))}
                            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                              isLoaded ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-stone-500 text-xs">
                          <span className="text-base mb-1">⏳</span>
                          <span className="font-mono text-[11px] uppercase tracking-wider">{photo.status}</span>
                        </div>
                      )}

                      {/* Status badge if not confirmed */}
                      {photo.status !== "confirmed" && (
                        <div className="absolute top-2 left-2 z-10">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-mono font-semibold ${
                              photo.status === "hidden"
                                ? "bg-purple-900/80 text-purple-200 border border-purple-700/60"
                                : "bg-red-900/80 text-red-200 border border-red-700/60"
                            }`}
                          >
                            {photo.status}
                          </span>
                        </div>
                      )}

                      {/* Film graded overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-black/60 text-amber-300 font-mono text-[10px] backdrop-blur-sm">
                            Roll {rollCode}
                          </span>
                          {photo.original_drive_file_id && (
                            <span className="px-1 py-0.5 rounded bg-black/60 text-stone-300 font-mono text-[9px] backdrop-blur-sm" title="RAW Original Available">
                              RAW
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="text-[10px] text-amber-200 font-medium truncate">
                            {recipe}
                          </div>
                          <div className="text-[9px] text-stone-400 font-mono mt-0.5">
                            {new Date(photo.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {visibleLimit < filteredPhotos.length && (
                <div className="text-center mt-10">
                  <button
                    onClick={() => setVisibleLimit((prev) => prev + 24)}
                    className="px-6 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs font-semibold hover:border-amber-400/50 hover:text-amber-300 transition-all cursor-pointer shadow"
                  >
                    Load More Photos ({filteredPhotos.length - visibleLimit} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* VIEW MODE 2: GUEST ROLLS & DETAILED TABLE */}
      {viewMode === "table" && (
        <div className="space-y-8">
          {/* Guests Summary Table */}
          <div className="p-6 rounded-2xl bg-stone-950 border border-stone-800">
            <h2 className="text-base font-bold text-white mb-4">
              Registered Guest Rolls ({guestsWithStats.length})
            </h2>

            {guestsWithStats.length === 0 ? (
              <p className="text-xs text-stone-500 font-mono py-4">No guests registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-800 text-stone-400 font-mono uppercase tracking-wider">
                      <th className="py-2.5 px-3">Roll Code</th>
                      <th className="py-2.5 px-3">Guest Name</th>
                      <th className="py-2.5 px-3">Shots Taken</th>
                      <th className="py-2.5 px-3">Confirmed in Drive</th>
                      <th className="py-2.5 px-3">Last Active</th>
                      <th className="py-2.5 px-3 text-right">Drive Subfolder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-900 font-mono">
                    {guestsWithStats.map((guest) => (
                      <tr key={guest.id} className="hover:bg-stone-900/50 transition-colors">
                        <td className="py-3 px-3 text-amber-300 font-semibold">
                          Roll {guest.roll_code}
                        </td>
                        <td className="py-3 px-3 font-sans font-medium text-stone-200">
                          {guest.display_name || <span className="text-stone-500 italic">Anonymous</span>}
                        </td>
                        <td className="py-3 px-3 text-stone-300">
                          {guest.totalShots} / {shotsPerGuest}
                        </td>
                        <td className="py-3 px-3 text-emerald-400">
                          {guest.confirmedShots}
                        </td>
                        <td className="py-3 px-3 text-stone-500">
                          {new Date(guest.last_seen_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {guest.drive_folder_id ? (
                            <a
                              href={`https://drive.google.com/drive/folders/${guest.drive_folder_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-400 hover:underline font-medium"
                            >
                              Open Folder &rarr;
                            </a>
                          ) : (
                            <span className="text-stone-600">Pending upload</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Photos Table */}
          <div className="p-6 rounded-2xl bg-stone-950 border border-stone-800">
            <h2 className="text-base font-bold text-white mb-4">
              All Photo Records ({photos.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 font-mono uppercase tracking-wider">
                    <th className="py-2.5 px-3">Shot ID</th>
                    <th className="py-2.5 px-3">Roll</th>
                    <th className="py-2.5 px-3">Recipe / Look</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Drive File</th>
                    <th className="py-2.5 px-3">Captured</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-900 font-mono">
                  {filteredPhotos.map((photo) => {
                    const meta = guestMetaMap.get(photo.guest_id);
                    const rollCode = meta?.rollCode || "—";
                    const isLoading = actionLoading === photo.id;
                    return (
                      <tr key={photo.id} className="hover:bg-stone-900/50 transition-colors">
                        <td className="py-3 px-3 text-stone-300">
                          {photo.shot_id.slice(0, 8)}…
                        </td>
                        <td className="py-3 px-3 text-amber-300 font-semibold">
                          Roll {rollCode}
                        </td>
                        <td className="py-3 px-3 text-amber-400">
                          {photo.preset_id || photo.look_id || "disposable-400"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                              photo.status === "confirmed"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : photo.status === "failed"
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : photo.status === "hidden"
                                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {photo.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-stone-400">
                          {photo.size_bytes ? `${(photo.size_bytes / 1024).toFixed(0)} KB` : "—"}
                        </td>
                        <td className="py-3 px-3 text-stone-400">
                          {photo.drive_file_id ? (
                            <a
                              href={`https://drive.google.com/file/d/${photo.drive_file_id}/view`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-400 hover:underline"
                            >
                              {photo.drive_file_id.slice(0, 10)}…
                            </a>
                          ) : (
                            <span className="text-stone-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-stone-500">
                          {new Date(photo.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {photo.status === "hidden" ? (
                              <button
                                onClick={() => void handleUnhide(photo.id)}
                                disabled={isLoading}
                                className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                              >
                                Unhide
                              </button>
                            ) : photo.status === "confirmed" ? (
                              <button
                                onClick={() => void handleHide(photo.id)}
                                disabled={isLoading}
                                className="px-2.5 py-1 rounded-md bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                              >
                                Hide
                              </button>
                            ) : null}

                            <button
                              onClick={() => void handleDelete(photo.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded-md bg-red-950/40 border border-red-900/60 hover:bg-red-900/60 text-red-300 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDITORIAL FULL-SCREEN LIGHTBOX MODAL */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col select-none">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-stone-800/80 bg-stone-950/80">
            {/* Left metadata */}
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-black font-mono font-bold text-xs">
                Roll {guestMetaMap.get(activePhoto.guest_id)?.rollCode || "ROLL"}
              </span>
              <div>
                <div className="text-white font-medium text-xs flex items-center gap-2">
                  <span>{activePhoto.preset_id || activePhoto.look_id || "disposable-400"}</span>
                  <span className="text-stone-500">•</span>
                  <span className="text-stone-400 font-mono">
                    Photo {activeLightboxIndex! + 1} of {filteredPhotos.length}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 font-mono">
                  {new Date(activePhoto.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {guestMetaMap.get(activePhoto.guest_id)?.name && ` • ${guestMetaMap.get(activePhoto.guest_id)?.name}`}
                </div>
              </div>
            </div>

            {/* Center: Graded vs Original Comparison Toggle */}
            <div className="flex items-center bg-stone-900 border border-stone-800 p-0.5 rounded-xl text-xs">
              <button
                onClick={() => setLightboxMode("filtered")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  lightboxMode === "filtered"
                    ? "bg-amber-400 text-black font-semibold shadow"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                Film Graded
              </button>
              <button
                onClick={() => {
                  if (activePhoto.original_drive_file_id) {
                    setLightboxMode("original");
                  }
                }}
                disabled={!activePhoto.original_drive_file_id}
                title={activePhoto.original_drive_file_id ? "View clean RAW sensor capture" : "Clean original was not retained for this shot"}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  !activePhoto.original_drive_file_id
                    ? "text-stone-600 cursor-not-allowed"
                    : lightboxMode === "original"
                      ? "bg-amber-400 text-black font-semibold shadow cursor-pointer"
                      : "text-stone-400 hover:text-stone-200 cursor-pointer"
                }`}
              >
                RAW Original {activePhoto.original_drive_file_id ? "" : "(N/A)"}
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* 1-Click HD Download */}
              <a
                href={`/api/admin/photos/${
                  lightboxMode === "original"
                    ? activePhoto.original_drive_file_id || activePhoto.drive_file_id
                    : activePhoto.drive_file_id
                }?download=1`}
                download
                className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 hover:text-amber-300 hover:border-amber-400/50 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Download High-Resolution Master"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                <span>Download HD</span>
              </a>

              {/* Hide / Unhide */}
              {activePhoto.status === "hidden" ? (
                <button
                  onClick={() => void handleUnhide(activePhoto.id)}
                  disabled={actionLoading === activePhoto.id}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs hover:bg-stone-800 cursor-pointer"
                >
                  Unhide
                </button>
              ) : (
                <button
                  onClick={() => void handleHide(activePhoto.id)}
                  disabled={actionLoading === activePhoto.id}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 text-xs hover:bg-stone-800 cursor-pointer"
                >
                  Hide
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={() => setActiveLightboxIndex(null)}
                className="w-8 h-8 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center transition-all cursor-pointer text-base ml-1"
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Central Image Viewer */}
          <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden">
            {/* Previous Photo Arrow */}
            <button
              onClick={() => {
                setActiveLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredPhotos.length - 1));
                setLightboxMode("filtered");
              }}
              className="absolute left-4 z-20 w-11 h-11 rounded-full bg-black/60 border border-stone-800 hover:border-amber-400 text-stone-300 hover:text-amber-300 flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer"
              title="Previous Photo (←)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Image Preview Container */}
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              <img
                key={`${activePhoto.id}-${lightboxMode}`}
                src={`/api/admin/photos/${
                  lightboxMode === "original"
                    ? activePhoto.original_drive_file_id || activePhoto.drive_file_id
                    : activePhoto.drive_file_id
                }?size=lightbox`}
                alt="Editorial Preview"
                className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-all duration-300"
              />
            </div>

            {/* Next Photo Arrow */}
            <button
              onClick={() => {
                setActiveLightboxIndex((prev) => (prev !== null && prev < filteredPhotos.length - 1 ? prev + 1 : 0));
                setLightboxMode("filtered");
              }}
              className="absolute right-4 z-20 w-11 h-11 rounded-full bg-black/60 border border-stone-800 hover:border-amber-400 text-stone-300 hover:text-amber-300 flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer"
              title="Next Photo (→)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
