"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { triggerHaptic } from "@/lib/camera/haptics";

interface EmptyEventOnboardingViewProps {
  clientName?: string;
  clientEmail?: string;
  isSuperadmin?: boolean;
}

export function EmptyEventOnboardingView({
  clientName,
  isSuperadmin,
}: EmptyEventOnboardingViewProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [eventName, setEventName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStarterEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple_names: eventName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");

      triggerHaptic([20, 50]);
      router.refresh();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto">
      <div className="relative h-12 w-36 mb-6 opacity-80">
        <Image
          src="/Unveiled_logo_horizontal_transparent.png"
          alt="Unveiled"
          fill
          priority
          sizes="144px"
          className="object-contain"
        />
      </div>

      <div className="w-14 h-14 rounded-2xl bg-amber-400/[0.08] border border-amber-400/20 flex items-center justify-center text-amber-400 mb-5 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      </div>

      <h1 className="font-serif text-2xl sm:text-3xl text-zinc-100 font-normal tracking-tight mb-3">
        Welcome to Unveiled{clientName ? `, ${clientName}` : ""}
      </h1>

      <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mb-8">
        Your client account is active and verified. Create your first wedding or event roll to configure guest camera limits, choose film recipes, and generate A4 print posters.
      </p>

      {isSuperadmin ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/superadmin"
            className="h-9 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-amber-400/10"
          >
            <span>Open Superadmin Console</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="h-10 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-400/10 active:scale-98"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Create Your First Event Roll</span>
        </button>
      )}

      {/* Modal: Create First Event */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl relative text-left">
            <h2 className="text-lg font-serif font-bold text-white mb-1">
              Create Your Event Roll
            </h2>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              Name your wedding or event (e.g. &ldquo;Sarah &amp; Michael&rdquo;). You can customize film recipes and download QR posters once created.
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateStarterEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Couple / Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dhifa & Riefky"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isCreating}
                  className="h-8 px-4 rounded-lg text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !eventName.trim()}
                  className="h-8 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isCreating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
