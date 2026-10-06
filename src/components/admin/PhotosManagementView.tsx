"use client";

import React, { useState } from "react";

interface GuestItem {
  id: string;
  display_name: string | null;
  drive_folder_id: string | null;
  created_at: string;
  last_seen_at: string;
  totalShots?: number;
  confirmedShots?: number;
}

interface PhotoItem {
  id: string;
  guest_id: string;
  shot_id: string;
  drive_file_id: string | null;
  size_bytes: number | null;
  status: "pending" | "confirmed" | "failed" | "hidden";
  created_at: string;
  guestName?: string;
  look_id?: string;
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
  const [filter, setFilter] = useState<"all" | "confirmed" | "hidden" | "failed">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Group photos by guest to calculate guest counts
  const guestsWithStats = initialGuests.map((g) => {
    const guestPhotos = photos.filter((p) => p.guest_id === g.id);
    const confirmed = guestPhotos.filter((p) => p.status === "confirmed").length;
    const nonFailed = guestPhotos.filter((p) => p.status !== "failed").length;
    return {
      ...g,
      totalShots: nonFailed,
      confirmedShots: confirmed,
    };
  });

  const filteredPhotos = photos.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  async function handleHide(photoId: string) {
    setActionLoading(photoId);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}/hide`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to hide photo");

      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status: "hidden" } : p)),
      );
      setNotification("Photo moved to Hidden folder and marked hidden.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnhide(photoId: string) {
    setActionLoading(photoId);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}/unhide`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to unhide photo");

      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status: "confirmed" } : p)),
      );
      setNotification("Photo restored to confirmed.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm("Are you sure you want to permanently delete this photo? This will delete the file from Google Drive and remove the database record.")) {
      return;
    }

    setActionLoading(photoId);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}/delete`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to delete photo");

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setNotification("Photo deleted permanently from Google Drive and database.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-zinc-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Archive</span>
          <h1 className="text-2xl font-serif font-bold text-white mt-1">Photo & Guest Management</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse registered guests, check per-guest uploads, and manage shot states.
          </p>
        </div>

        {rootFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${rootFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <span>Open Wedding Root in Drive</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h4a.75.75 0 0 1 0 1.5h-4Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
            </svg>
          </a>
        )}
      </div>

      {notification && (
        <div className="p-3 mb-6 rounded-xl bg-zinc-900 border border-amber-400/40 text-amber-300 text-xs flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Note on Gallery in Drive */}
      <div className="p-4 mb-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-400 shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
        </svg>
        <p className="leading-relaxed">
          <b>Design Philosophy:</b> All captured photos are stored directly in the couple&apos;s Google Drive. To preserve guests&apos; privacy and keep the app within $0 free tiers, Google Drive is the photo gallery.
        </p>
      </div>

      {/* Guests Summary Table */}
      <div className="p-6 mb-8 rounded-2xl bg-zinc-950 border border-zinc-800">
        <h2 className="text-base font-bold text-white mb-4">
          Registered Guests ({guestsWithStats.length})
        </h2>

        {guestsWithStats.length === 0 ? (
          <p className="text-xs text-zinc-500 font-mono py-4">No guests registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3">Guest Name / ID</th>
                  <th className="py-2.5 px-3">Shots Used</th>
                  <th className="py-2.5 px-3">Confirmed in Drive</th>
                  <th className="py-2.5 px-3">Last Active</th>
                  <th className="py-2.5 px-3 text-right">Drive Subfolder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-mono">
                {guestsWithStats.map((guest) => (
                  <tr key={guest.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-3 px-3 font-sans font-medium text-zinc-200">
                      {guest.display_name || <span className="text-zinc-500 italic">Anonymous ({guest.id.slice(0, 6)})</span>}
                    </td>
                    <td className="py-3 px-3 text-zinc-300">
                      {guest.totalShots} / {shotsPerGuest}
                    </td>
                    <td className="py-3 px-3 text-emerald-400">
                      {guest.confirmedShots}
                    </td>
                    <td className="py-3 px-3 text-zinc-500">
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
                        <span className="text-zinc-600">Pending upload</span>
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
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-white">
              All Photo Records ({photos.length})
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Detailed log of reservations and cloud uploads.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl text-xs font-medium border border-zinc-800 overflow-x-auto no-scrollbar max-w-full">
            {(["all", "confirmed", "hidden", "failed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filter === tab
                    ? "bg-zinc-800 text-amber-300 font-semibold shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredPhotos.length === 0 ? (
          <p className="text-xs text-zinc-500 font-mono py-8 text-center">
            No photos found matching filter &quot;{filter}&quot;.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3">Shot ID</th>
                  <th className="py-2.5 px-3">Look</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Drive File ID</th>
                  <th className="py-2.5 px-3">Captured</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-mono">
                {filteredPhotos.map((photo) => {
                  const isLoading = actionLoading === photo.id;
                  return (
                    <tr key={photo.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="py-3 px-3 text-zinc-300">
                        {photo.shot_id.slice(0, 8)}…
                      </td>
                      <td className="py-3 px-3 text-amber-400 font-semibold">
                        {photo.look_id || "disposable-400"}
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
                      <td className="py-3 px-3 text-zinc-400">
                        {photo.size_bytes ? `${(photo.size_bytes / 1024).toFixed(0)} KB` : "—"}
                      </td>
                      <td className="py-3 px-3 text-zinc-400">
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
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-zinc-500">
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
                              className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                            >
                              Unhide
                            </button>
                          ) : photo.status === "confirmed" ? (
                            <button
                              onClick={() => void handleHide(photo.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[11px] font-sans font-medium transition-colors cursor-pointer"
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
        )}
      </div>
    </div>
  );
}
