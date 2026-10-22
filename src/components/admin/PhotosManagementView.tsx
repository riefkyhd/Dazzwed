"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { computeRollCodeFromGuestId } from "@/lib/guest/session";
import { AdminPhotoLightbox } from "./AdminPhotoLightbox";
import { createStoredZipBlob, downloadBlobInBrowser, ZipEntry } from "@/lib/export/zip";

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
  eventSlug?: string;
  initialView?: "editorial" | "table";
  initialGuestFilter?: string;
}

export function PhotosManagementView({
  initialGuests,
  initialPhotos,
  rootFolderId,
  shotsPerGuest,
  eventSlug = "wedding",
  initialView = "editorial",
  initialGuestFilter = "all",
}: PhotosManagementViewProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [viewMode, setViewMode] = useState<"editorial" | "table">(initialView);
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "hidden" | "failed">("all");
  const [guestFilter, setGuestFilter] = useState<string>(initialGuestFilter);
  const [presetFilter, setPresetFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [visibleLimit, setVisibleLimit] = useState<number>(24);
  const [isReconciling, setIsReconciling] = useState(false);

  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [imageRetries, setImageRetries] = useState<Record<string, number>>({});

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

  // Safe Google Drive Storage Reconciliation
  const handleReconcile = async () => {
    if (
      !confirm(
        "Run Google Drive Storage Reconciliation?\n\nThis will safely check active photo records against Google Drive. Any orphaned database records whose files were deleted or belong to an old Drive account will be marked as failed so gallery counts and .ZIP exports match Drive 1:1."
      )
    ) {
      return;
    }
    setIsReconciling(true);
    try {
      const res = await fetch("/api/admin/photos/reconcile", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reconciliation failed");
      setNotification(data.message || `Reconciliation complete: ${data.verified} verified, ${data.orphaned} cleaned up.`);
      if (data.orphaned > 0) {
        // Refresh photos list
        const refRes = await fetch("/api/admin/photos");
        const refData = await refRes.json();
        if (refData.photos) {
          setPhotos(refData.photos);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsReconciling(false);
    }
  };

  // Bulk ZIP Export State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportVariant, setExportVariant] = useState<"both" | "film" | "original">("both");
  const [exportScope, setExportScope] = useState<"all" | "filtered">("all");
  const [exportOrganization, setExportOrganization] = useState<"guest" | "flat">("guest");
  const [exportProgress, setExportProgress] = useState<{
    active: boolean;
    current: number;
    total: number;
    currentName: string;
    failedCount: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("export") === "1" || params.get("export") === "true") {
        setIsExportModalOpen(true);
      }
    }
  }, []);

  const cancelBulkExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setExportProgress(null);
  }, []);

  const startBulkExport = useCallback(
    async (
      variant: "both" | "film" | "original",
      scope: "all" | "filtered",
      organization: "guest" | "flat" = "guest"
    ) => {
      const sourcePhotos = scope === "filtered" ? filteredPhotos : photos;
      const targetPhotos = sourcePhotos.filter((p) => !!p.drive_file_id);

      if (targetPhotos.length === 0) {
        setNotification("No uploaded photos available to download in this selection.");
        return;
      }

      // Pre-compute chronological shot numbers per guest (01, 02, 03...)
      const guestShotNumberMap = new Map<string, number>();
      const guestCounters = new Map<string, number>();
      const chronological = [...targetPhotos].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      for (const p of chronological) {
        const nextCount = (guestCounters.get(p.guest_id) || 0) + 1;
        guestCounters.set(p.guest_id, nextCount);
        guestShotNumberMap.set(p.id, nextCount);
      }

      interface ExportTask {
        photo: PhotoItem;
        index: number;
        type: "filtered" | "original";
        targetSubfolder: "Film" | "Original" | null;
      }

      const tasks: ExportTask[] = [];
      targetPhotos.forEach((photo, idx) => {
        if (variant === "film") {
          tasks.push({ photo, index: idx, type: "filtered", targetSubfolder: null });
        } else if (variant === "original") {
          tasks.push({ photo, index: idx, type: "original", targetSubfolder: null });
        } else {
          tasks.push({ photo, index: idx, type: "filtered", targetSubfolder: "Film" });
          tasks.push({ photo, index: idx, type: "original", targetSubfolder: "Original" });
        }
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setExportProgress({
        active: true,
        current: 0,
        total: tasks.length,
        currentName: "Starting download pool...",
        failedCount: 0,
      });

      const CONCURRENCY = 4;
      const zipEntries: ZipEntry[] = [];
      let taskIndex = 0;
      let completedCount = 0;
      let failedCount = 0;

      async function worker() {
        while (taskIndex < tasks.length) {
          if (abortController.signal.aborted) break;
          const currentTask = tasks[taskIndex++];
          if (!currentTask) break;

          const { photo, index, type, targetSubfolder } = currentTask;
          const meta = guestMetaMap.get(photo.guest_id);
          const rollCode = meta?.rollCode || computeRollCodeFromGuestId(photo.guest_id);
          const rawGuestName = meta?.name?.trim();
          const cleanGuestName = rawGuestName ? rawGuestName.replace(/[/\\?%*:|"<>]/g, "").trim() : null;
          const shortId = (photo.shot_id || photo.id).slice(0, 6);
          const filenameSuffix = type === "filtered" ? "film" : "raw";

          let relativePath = "";

          if (organization === "guest") {
            // Google Drive matching hierarchy:
            // "Dhifa (7K9X2B)/" or "Roll 7K9X2B/"
            const guestFolderName = cleanGuestName ? `${cleanGuestName} (${rollCode})` : `Roll ${rollCode}`;
            const guestShotNum = guestShotNumberMap.get(photo.id) || 1;
            const shotPadded = String(guestShotNum).padStart(2, "0");
            const filename = `${shotPadded}_${rollCode}_${shortId}_${filenameSuffix}.jpg`;

            if (type === "original") {
              // Stored in originals/ subfolder inside guest folder just like on Google Drive!
              relativePath = `${guestFolderName}/originals/${filename}`;
            } else {
              relativePath = `${guestFolderName}/${filename}`;
            }
          } else {
            // Flat by variant
            const safeGuest = (cleanGuestName || `Roll_${rollCode}`).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
            const paddedIndex = String(index + 1).padStart(3, "0");
            const filename = `${paddedIndex}_${safeGuest}_${shortId}_${filenameSuffix}.jpg`;
            if (targetSubfolder) {
              relativePath = `${targetSubfolder}/${filename}`;
            } else {
              relativePath = filename;
            }
          }

          setExportProgress((prev) =>
            prev
              ? {
                  ...prev,
                  currentName: relativePath,
                }
              : null
          );

          try {
            const url = `/api/admin/photos/${photo.id}?size=original&type=${type}`;
            const res = await fetch(url, { signal: abortController.signal });
            if (!res.ok) {
              console.warn(`[BulkExport] Skipping photo ${photo.id} (${res.status})`);
              failedCount++;
            } else {
              const blob = await res.blob();
              const arrayBuf = await blob.arrayBuffer();
              zipEntries.push({
                filename: relativePath,
                data: new Uint8Array(arrayBuf),
                lastModified: new Date(photo.created_at || Date.now()),
              });
            }
          } catch (err: any) {
            if (err?.name === "AbortError" || abortController.signal.aborted) {
              return;
            }
            console.warn(`[BulkExport] Error downloading photo ${photo.id}:`, err);
            failedCount++;
          } finally {
            completedCount++;
            setExportProgress((prev) =>
              prev
                ? {
                    ...prev,
                    current: completedCount,
                    failedCount,
                  }
                : null
            );
          }
        }
      }

      const workers = Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker());
      await Promise.all(workers);

      if (abortController.signal.aborted) {
        setExportProgress(null);
        setNotification("Export cancelled by host.");
        return;
      }

      if (zipEntries.length === 0) {
        setExportProgress(null);
        setNotification("No photos could be retrieved from Google Drive.");
        return;
      }

      setExportProgress((prev) =>
        prev ? { ...prev, currentName: "Assembling .ZIP archive in memory..." } : null
      );

      await new Promise((r) => setTimeout(r, 60));

      const zipBlob = createStoredZipBlob(zipEntries);
      const todayStr = new Date().toISOString().split("T")[0];
      const orgTag = organization === "guest" ? "by-guest" : "by-variant";
      const zipFilename = `${eventSlug || "dazzwed"}-photos-${orgTag}-${variant}-${todayStr}.zip`;

      downloadBlobInBrowser(zipBlob, zipFilename);

      setExportProgress(null);
      setIsExportModalOpen(false);
      const sizeMb = (zipBlob.size / (1024 * 1024)).toFixed(1);
      setNotification(
        `Downloaded ${zipEntries.length} photos (${sizeMb} MB) in ${zipFilename}` +
          (failedCount > 0 ? ` (${failedCount} files skipped)` : "")
      );
    },
    [filteredPhotos, photos, guestMetaMap, eventSlug]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-zinc-800/80">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-400 font-medium">Wedding Archive</span>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-zinc-100 tracking-tight mt-1">Photo Gallery & Rolls</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Browse and download guest photos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Mode Switcher */}
          <div className="inline-flex items-center bg-zinc-900/90 border border-zinc-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("editorial")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                viewMode === "editorial"
                  ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm border border-white/10"
                  : "text-zinc-400 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <span>Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm border border-white/10"
                  : "text-zinc-400 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="8" x2="21" y1="6" y2="6" />
                <line x1="8" x2="21" y1="12" y2="12" />
                <line x1="8" x2="21" y1="18" y2="18" />
                <line x1="3" x2="3.01" y1="6" y2="6" />
                <line x1="3" x2="3.01" y1="12" y2="12" />
                <line x1="3" x2="3.01" y1="18" y2="18" />
              </svg>
              <span>Guest Rolls</span>
            </button>
          </div>

          {/* Download All (.ZIP) Button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            disabled={exportProgress?.active}
            className="h-8 px-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
            title="Download All Photos as .ZIP archive"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            <span>Download All (.ZIP)</span>
            <span className="px-1.5 py-0.5 bg-black/15 text-zinc-950 rounded text-[10px] font-mono font-bold leading-none">
              {photos.filter((p) => !!p.drive_file_id).length}
            </span>
          </button>

          {rootFolderId && (
            <a
              href={`https://drive.google.com/drive/folders/${rootFolderId}`}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-3 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              title="Open Google Drive Archive"
            >
              <span>Google Drive</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-400">
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
            </a>
          )}

          {/* Sync & Reconcile Missing Drive Records */}
          <button
            type="button"
            onClick={handleReconcile}
            disabled={isReconciling}
            className="h-8 px-3 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer disabled:opacity-50"
            title="Scan and reconcile database records with actual Google Drive storage"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 text-amber-400 ${isReconciling ? "animate-spin" : ""}`}>
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{isReconciling ? "Reconciling…" : "Sync Drive"}</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 mb-6 rounded-xl bg-zinc-900/90 border border-amber-400/30 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-white cursor-pointer p-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* COMPACT, NON-WRAPPING CONTROL BAR */}
      <div className="bg-white/[0.02] border border-white/[0.07] p-3 rounded-2xl mb-6 space-y-3">
        {/* Top Row: Guest Dropdown, Sort, Status, and Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Guest / Roll Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-mono text-xs">Roll:</span>
              <select
                value={guestFilter}
                onChange={(e) => {
                  setGuestFilter(e.target.value);
                  setVisibleLimit(24);
                }}
                className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-400/60 cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">All Rolls ({guestsWithStats.length})</option>
                {guestsWithStats.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.display_name ? `${g.display_name} (${g.roll_code})` : `Roll ${g.roll_code}`} — {g.totalShots} shots
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-mono text-xs">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
                className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-400/60 cursor-pointer"
              >
                <option value="desc">Newest</option>
                <option value="asc">Oldest</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-mono text-xs">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setVisibleLimit(24);
                }}
                className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-400/60 cursor-pointer"
              >
                <option value="all">All ({photos.length})</option>
                <option value="confirmed">Confirmed</option>
                <option value="hidden">Hidden</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="text-zinc-400 font-mono text-xs">
            Showing <span className="text-amber-400 font-semibold">{visiblePhotos.length}</span> of {filteredPhotos.length}
          </div>
        </div>

        {/* Bottom Row: Film Recipe Pills (Single-line horizontal scroll row, never wraps) */}
        <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-400 uppercase shrink-0">Recipe:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => {
                setPresetFilter("all");
                setVisibleLimit(24);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                presetFilter === "all"
                  ? "bg-white/[0.08] text-white border border-white/20 font-semibold shadow-sm"
                  : "bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              All Looks
            </button>
            {availablePresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setPresetFilter(preset);
                  setVisibleLimit(24);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  presetFilter === preset
                    ? "bg-white/[0.08] text-white border border-white/20 font-semibold shadow-sm"
                    : "bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: RETINA EDITORIAL GALLERY */}
      {viewMode === "editorial" && (
        <div>
          {filteredPhotos.length === 0 ? (
            <div className="p-16 text-center rounded-2xl bg-white/[0.02] border border-white/[0.07] text-zinc-400">
              <p className="text-sm font-serif text-zinc-200">No photos match the selected filters.</p>
              <p className="text-xs text-zinc-400 font-mono mt-1">Try switching your roll or recipe filters above.</p>
            </div>
          ) : (
            <>
              {/* Responsive Contact-Sheet Grid: 2 cols on mobile, 3 on sm, 4 on lg */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {visiblePhotos.map((photo, index) => {
                  const meta = guestMetaMap.get(photo.guest_id);
                  const rollCode = meta?.rollCode || "ROLL";
                  const guestName = meta?.name || null;
                  const recipe = photo.preset_id || photo.look_id || "disposable-400";
                  const isLoaded = loadedImages[photo.id];
                  const isFailed = failedImages[photo.id];
                  const hasDriveId = !!photo.drive_file_id;

                  return (
                    <div
                      key={photo.id}
                      onClick={() => {
                        if (hasDriveId) {
                          setActiveLightboxIndex(index);
                        }
                      }}
                      className="aspect-[3/4] relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.07] group cursor-pointer shadow-md hover:border-amber-400/50 transition-all"
                    >
                      {/* Image Preview with Retina streaming */}
                      {hasDriveId ? (
                        <>
                          {isFailed ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-950 text-zinc-400 text-xs">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 mb-1 text-amber-400/60">
                                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                <circle cx="9" cy="9" r="2" />
                                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                              </svg>
                              <span className="font-mono text-[10px] text-zinc-400">Drive file removed</span>
                            </div>
                          ) : (
                            <>
                              {!isLoaded && (
                                <div className="absolute inset-0 bg-zinc-900/80 animate-pulse flex items-center justify-center">
                                  <span className="text-[10px] font-mono text-zinc-400">Loading…</span>
                                </div>
                              )}
                              <img
                                src={`/api/admin/photos/${photo.drive_file_id}?size=grid${
                                  imageRetries[photo.id] ? `&r=${imageRetries[photo.id]}` : ""
                                }`}
                                alt={guestName ? `Shot by ${guestName}` : `Shot by Roll ${rollCode}`}
                                loading="lazy"
                                decoding="async"
                                onLoad={() => setLoadedImages((prev) => ({ ...prev, [photo.id]: true }))}
                                onError={() => {
                                  const count = imageRetries[photo.id] || 0;
                                  if (count < 2) {
                                    setTimeout(() => {
                                      setImageRetries((prev) => ({ ...prev, [photo.id]: count + 1 }));
                                    }, 800 + Math.random() * 500);
                                  } else {
                                    setFailedImages((prev) => ({ ...prev, [photo.id]: true }));
                                  }
                                }}
                                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                                  isLoaded ? "opacity-100" : "opacity-0"
                                }`}
                              />
                            </>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-zinc-400 text-xs">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 mb-1 text-zinc-400">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
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

                      {/* Compact Bottom Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between pointer-events-none">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-black/70 text-amber-300 font-mono text-[10px] backdrop-blur-sm max-w-[140px] truncate" title={guestName ? `${guestName} (${rollCode})` : `Roll ${rollCode}`}>
                            {guestName ? `${guestName} (${rollCode})` : `Roll ${rollCode}`}
                          </span>
                          {photo.original_drive_file_id && (
                            <span className="px-1 py-0.5 rounded bg-black/70 text-zinc-300 font-mono text-[9px] backdrop-blur-sm" title="RAW Original Available">
                              RAW
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-[11px] text-white font-medium truncate">
                            {guestName || `Shot #${photo.shot_id.slice(0, 6)}`}
                          </div>
                          <div className="text-[10px] text-amber-300/80 font-mono truncate">
                            {recipe}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button (Batches of 24) */}
              {visibleLimit < filteredPhotos.length && (
                <div className="text-center mt-10">
                  <button
                    onClick={() => setVisibleLimit((prev) => prev + 24)}
                    className="h-9 px-6 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium hover:border-amber-400/50 hover:text-white transition-all cursor-pointer shadow-sm"
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
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
            <h2 className="text-base font-serif font-normal text-zinc-100 mb-4">
              Registered Guest Rolls ({guestsWithStats.length})
            </h2>

            {guestsWithStats.length === 0 ? (
              <p className="text-xs text-zinc-400 font-mono py-4">No guests registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-zinc-400 font-mono uppercase tracking-[0.14em] text-[11px]">
                      <th className="py-2.5 px-3">Roll Code</th>
                      <th className="py-2.5 px-3">Guest Name</th>
                      <th className="py-2.5 px-3">Shots Taken</th>
                      <th className="py-2.5 px-3">Quota</th>
                      <th className="py-2.5 px-3">Last Seen</th>
                      <th className="py-2.5 px-3">Drive Folder</th>
                      <th className="py-2.5 px-3 text-right">Gallery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 font-mono">
                    {guestsWithStats.map((guest) => {
                      const completed = (guest.totalShots || 0) >= shotsPerGuest;
                      return (
                        <tr key={guest.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 text-amber-400 font-bold">
                            Roll {guest.roll_code}
                          </td>
                          <td className="py-3 px-3 text-zinc-200 font-sans">
                            {guest.display_name || <span className="text-zinc-400 italic">Guest</span>}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                completed
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {guest.totalShots || 0} / {shotsPerGuest} shots
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-400">
                            {completed ? "Completed Roll" : `${shotsPerGuest - (guest.totalShots || 0)} left`}
                          </td>
                          <td className="py-3 px-3 text-zinc-400">
                            {new Date(guest.last_seen_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-3">
                            {guest.drive_folder_id ? (
                              <a
                                href={`https://drive.google.com/drive/folders/${guest.drive_folder_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <span>Folder</span>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                  <path d="M15 3h6v6" />
                                  <path d="M10 14 21 3" />
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setGuestFilter(guest.id);
                                setViewMode("editorial");
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-amber-400 hover:text-amber-300 text-[11px] font-sans font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>View Photos</span>
                              <span>&rarr;</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed Photos Table */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
            <h2 className="text-base font-serif font-normal text-zinc-100 mb-4">
              All Photos ({filteredPhotos.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 font-mono uppercase tracking-wider">
                    <th className="py-2.5 px-3">Shot ID</th>
                    <th className="py-2.5 px-3">Guest Roll</th>
                    <th className="py-2.5 px-3">Recipe</th>
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
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-zinc-400">
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

      {/* BULK EXPORT MODAL & LIVE PROGRESS DIALOG */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-zinc-200 space-y-6">
            {!exportProgress ? (
              <>
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Bulk Photo Export</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 text-[10px] font-mono border border-amber-400/20">
                        PKZIP STORE
                      </span>
                    </div>
                    <h2 className="text-xl font-serif font-normal text-zinc-100 tracking-tight mt-1">Download All Photos (.ZIP)</h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Download all event photos as a ZIP file.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Scope Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
                    1. Select Photo Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportScope("all")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        exportScope === "all"
                          ? "bg-amber-400/10 border-amber-400/50 text-amber-200"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">All Event Photos</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300">
                          {photos.filter((p) => !!p.drive_file_id).length} shots
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">Every uploaded photo across all guest rolls.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportScope("filtered")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        exportScope === "filtered"
                          ? "bg-amber-400/10 border-amber-400/50 text-amber-200"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">Current Filter</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300">
                          {filteredPhotos.filter((p) => !!p.drive_file_id).length} shots
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {statusFilter !== "all" || guestFilter !== "all" || presetFilter !== "all"
                          ? "Filtered by active view selection."
                          : "Matches current view (same as all)."}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Folder Organization Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
                    2. Folder Categorization
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportOrganization("guest")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        exportOrganization === "guest"
                          ? "bg-amber-400/10 border-amber-400/50 text-amber-200"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-400">
                            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                          </svg>
                          <span>Per Guest Folders</span>
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                          Drive Style
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-tight">
                        When unzipped, stored in folders per guest: <code className="text-zinc-300">Name (RollCode)/</code> with <code className="text-zinc-300">originals/</code>.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportOrganization("flat")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        exportOrganization === "flat"
                          ? "bg-amber-400/10 border-amber-400/50 text-amber-200"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-400">
                            <polygon points="12 2 2 7 12 12 22 7 12 2" />
                            <polyline points="2 17 12 22 22 17" />
                            <polyline points="2 12 12 17 22 12" />
                          </svg>
                          <span>By Variant</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-tight">
                        All guest photos grouped into top-level <code className="text-zinc-300">Film/</code> and <code className="text-zinc-300">Original/</code> folders.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Variant Selection Cards */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
                    3. Select Photo Variant
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setExportVariant("both")}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        exportVariant === "both"
                          ? "bg-amber-400/10 border-amber-400/60 text-amber-200"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400">
                          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
                          <path d="m17 4 3 3" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-white">Both Film & Clean Originals</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                            Recommended
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Includes both filtered photos and original camera captures.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportVariant("film")}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        exportVariant === "film"
                          ? "bg-amber-400/10 border-amber-400/60 text-amber-200"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400">
                          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-xs text-white">Film Developed Photos Only</span>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Photos with the selected film look applied.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportVariant("original")}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        exportVariant === "original"
                          ? "bg-amber-400/10 border-amber-400/60 text-amber-200"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-zinc-400">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-xs text-white">Original Photos Only</span>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Original photos directly from the camera without filters.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="h-8 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void startBulkExport(exportVariant, exportScope, exportOrganization)}
                    className="h-8 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Start Bulk Export (.ZIP)</span>
                  </button>
                </div>
              </>
            ) : (
              /* Live Progress View */
              <div className="space-y-6 py-2">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 animate-pulse">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-serif font-normal text-zinc-100 tracking-tight">Packaging Event Photos</h3>
                  <p className="text-xs text-zinc-400 font-mono truncate max-w-sm mx-auto">
                    {exportProgress.currentName}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">
                      Photo {exportProgress.current} of {exportProgress.total}
                    </span>
                    <span className="text-amber-400 font-semibold">
                      {Math.round((exportProgress.current / Math.max(1, exportProgress.total)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                    <div
                      className="h-full bg-amber-400 transition-all duration-200"
                      style={{
                        width: `${Math.min(100, Math.round((exportProgress.current / Math.max(1, exportProgress.total)) * 100))}%`,
                      }}
                    />
                  </div>
                  {exportProgress.failedCount > 0 && (
                    <p className="text-[11px] font-mono text-amber-400 text-center flex items-center justify-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>{exportProgress.failedCount} missing files skipped safely</span>
                    </p>
                  )}
                </div>

                {/* Cancel Button */}
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={cancelBulkExport}
                    className="h-8 px-4 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-red-500/50 hover:text-red-400 text-zinc-400 text-xs font-medium transition-all cursor-pointer"
                  >
                    Cancel Export
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BULLETPROOF STANDALONE LIGHTBOX MODAL */}
      <AdminPhotoLightbox
        photos={filteredPhotos}
        currentIndex={activeLightboxIndex ?? 0}
        isOpen={activeLightboxIndex !== null}
        onClose={() => setActiveLightboxIndex(null)}
        onNavigate={(index) => setActiveLightboxIndex(index)}
        guestMetaMap={guestMetaMap}
      />
    </div>
  );
}
