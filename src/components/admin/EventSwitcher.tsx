"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { triggerHaptic } from "@/lib/camera/haptics";

export interface EventItem {
  id: string;
  slug: string;
  couple_names: string;
  status: "active" | "paused" | "archived";
  package_tier?: string;
  package_max_guests?: number | null;
  package_max_shots_per_guest?: number;
}

interface EventSwitcherProps {
  currentEvent: EventItem;
  allEvents: EventItem[];
  userRole?: "superadmin" | "client";
  maxEvents?: number;
}

export function EventSwitcher({
  currentEvent,
  allEvents,
  userRole = "superadmin",
  maxEvents = 1,
}: EventSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // New Event Form State
  const [coupleNames, setCoupleNames] = useState("");
  const [slug, setSlug] = useState("");
  const [shotsPerGuest, setShotsPerGuest] = useState(25);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSwitch = async (eventId: string) => {
    if (eventId === currentEvent.id || isSwitching) return;
    setIsSwitching(true);
    triggerHaptic(15);
    try {
      const res = await fetch("/api/admin/events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to switch event:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupleNames.trim() || isCreating) return;
    setIsCreating(true);
    setErrorMsg(null);
    triggerHaptic([20, 40]);

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couple_names: coupleNames.trim(),
          slug: slug.trim() || undefined,
          shots_per_guest: shotsPerGuest,
          status: "active",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to create event");
        return;
      }

      setShowNewModal(false);
      setIsOpen(false);
      setCoupleNames("");
      setSlug("");
      router.refresh();
    } catch (err) {
      setErrorMsg("Network error creating event");
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ACTIVE</span>;
      case "paused":
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PAUSED</span>;
      case "archived":
      default:
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">ARCHIVED</span>;
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-400";
      case "paused":
        return "bg-amber-400";
      case "archived":
      default:
        return "bg-zinc-500";
    }
  };

  // If client only has 1 event, render a static label without dropdown or + New Event
  if (userRole === "client" && allEvents.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs sm:text-sm font-medium text-zinc-200 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(currentEvent.status)} shrink-0`} />
        <span className="max-w-[130px] sm:max-w-[200px] truncate font-sans text-zinc-200">
          {currentEvent.couple_names}
        </span>
      </div>
    );
  }

  const canCreateMore = userRole === "superadmin" || allEvents.length < maxEvents;

  return (
    <div className="relative">
      {/* Trigger Button: Minimal Ghost Vercel/Linear Breadcrumb Style */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Switch active event"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/[0.04] text-xs sm:text-sm font-medium text-zinc-200 hover:text-white transition-all cursor-pointer shrink-0 group"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(currentEvent.status)} shrink-0`} />
        <span className="max-w-[130px] sm:max-w-[200px] truncate font-sans text-zinc-200 group-hover:text-white transition-colors">
          {currentEvent.couple_names}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown Menu: Aligned left with trigger */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-72 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl z-50 overflow-hidden divide-y divide-zinc-800/80 animate-in fade-in zoom-in-95 duration-100">
            <div className="p-3 bg-zinc-900/50 flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Event Switcher
              </span>
              {canCreateMore ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewModal(true);
                    setIsOpen(false);
                  }}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  + New Event
                </button>
              ) : (
                <span className="text-[10px] font-mono text-zinc-400">
                  Plan Quota ({allEvents.length}/{maxEvents})
                </span>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto py-1">
              {allEvents.map((ev) => {
                const isSelected = ev.id === currentEvent.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => handleSwitch(ev.id)}
                    disabled={isSwitching}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-zinc-900/80 transition-colors cursor-pointer ${
                      isSelected ? "bg-amber-400/10 border-l-2 border-amber-400" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-sans font-medium text-white truncate">
                        {ev.couple_names}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 truncate">
                        /e/{ev.slug}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {getStatusBadge(ev.status)}
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* New Event Modal rendered via createPortal so it escapes header stacking context */}
      {showNewModal && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl relative text-left">
            <h2 className="text-xl font-serif font-bold text-white mb-1">Create New Wedding / Event</h2>
            <p className="text-xs text-zinc-400 mb-5">
              Set up an isolated event with its own QR codes, photo stream, and guest roll.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Couple / Event Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nadia & Dennis"
                  value={coupleNames}
                  onChange={(e) => {
                    setCoupleNames(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  URL Slug (Guest Access Link)
                </label>
                <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-400">
                  <span>/e/</span>
                  <input
                    type="text"
                    placeholder="nadia-dennis"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="w-full bg-transparent text-white focus:outline-none ml-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Shots Per Guest (Roll Capacity)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={shotsPerGuest}
                  onChange={(e) => setShotsPerGuest(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Default 25 shots (standard single-use camera roll).</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !coupleNames.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isCreating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
