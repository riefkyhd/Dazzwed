"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { formatExpirationNotice } from "@/lib/event-token";

interface SettingsViewProps {
  initialEvent: {
    id: string;
    slug: string;
    couple_names: string;
    shots_per_guest: number;
    opens_at: string | null;
    closes_at: string | null;
    manually_closed: boolean;
    status?: "active" | "paused" | "archived";
    package_tier?: string;
    package_max_guests?: number | null;
    package_max_shots_per_guest?: number;
    access_token?: string;
    token_expires_at?: string | null;
    token_duration_hours?: number;
    theme: {
      accentColor?: string;
      accentFg?: string;
      bgColor?: string;
      note?: string;
      eventSubtitle?: string;
      activeLookId?: string;
      sessionResetAt?: string;
    };
  };
  userRole?: "superadmin" | "client";
}

export function SettingsView({ initialEvent, userRole = "superadmin" }: SettingsViewProps) {
  const router = useRouter();
  const [coupleNames, setCoupleNames] = useState(initialEvent.couple_names);
  const [shotsPerGuest, setShotsPerGuest] = useState(initialEvent.shots_per_guest);
  const [manuallyClosed, setManuallyClosed] = useState(initialEvent.manually_closed);
  const [opensAt, setOpensAt] = useState(
    initialEvent.opens_at ? initialEvent.opens_at.slice(0, 16) : "",
  );
  const [closesAt, setClosesAt] = useState(
    initialEvent.closes_at ? initialEvent.closes_at.slice(0, 16) : "",
  );
  const [accentColor, setAccentColor] = useState(
    initialEvent.theme?.accentColor || "#D4AF37",
  );
  const [bgColor, setBgColor] = useState(
    initialEvent.theme?.bgColor || "#0C0A09",
  );
  const [welcomeNote, setWelcomeNote] = useState(
    initialEvent.theme?.note || "",
  );
  const [eventSubtitle, setEventSubtitle] = useState(
    initialEvent.theme?.eventSubtitle || "",
  );
  const [activeLookId, setActiveLookId] = useState(
    initialEvent.theme?.activeLookId || "cpm-35",
  );
  const [sessionResetAt, setSessionResetAt] = useState<string | null>(
    initialEvent.theme?.sessionResetAt || null,
  );
  const [resettingSessions, setResettingSessions] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Rotating Token & Expiration Window state
  const [accessToken, setAccessToken] = useState(initialEvent.access_token || "");
  const [tokenExpiresAt, setTokenExpiresAt] = useState(
    initialEvent.token_expires_at ? initialEvent.token_expires_at.slice(0, 16) : "",
  );
  const [tokenDurationHours, setTokenDurationHours] = useState(
    initialEvent.token_duration_hours || 72,
  );
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [updatingToken, setUpdatingToken] = useState(false);
  const [tokenSuccessMsg, setTokenSuccessMsg] = useState<string | null>(null);

  async function handleCopyLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/e/${initialEvent.slug}${accessToken ? `?t=${accessToken}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 3000);
    } catch {}
  }

  async function handleUpdateExpiration() {
    setUpdatingToken(true);
    setTokenSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/events/token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: initialEvent.id,
          tokenDurationHours,
          tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update expiration window");
      }
      setTokenSuccessMsg("Access window updated successfully! Existing QR codes remain valid.");
      if (data.tokenExpiresAt) {
        setTokenExpiresAt(data.tokenExpiresAt.slice(0, 16));
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingToken(false);
    }
  }

  async function handleRotateToken() {
    setRotatingToken(true);
    setTokenSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/events/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: initialEvent.id,
          tokenDurationHours,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to rotate token");
      }
      setAccessToken(data.accessToken);
      if (data.tokenExpiresAt) {
        setTokenExpiresAt(data.tokenExpiresAt.slice(0, 16));
      }
      setTokenSuccessMsg(
        `Token rotated to [${data.accessToken}]! Previous QR codes and links are now deactivated. Remember to download or print new QR codes.`,
      );
      setShowRotateModal(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setRotatingToken(false);
    }
  }

  function handlePresetDuration(hours: number) {
    setTokenDurationHours(hours);
    const newDate = new Date(Date.now() + hours * 3600 * 1000);
    const tzOffsetMs = newDate.getTimezoneOffset() * 60000;
    const localIso = new Date(newDate.getTime() - tzOffsetMs).toISOString().slice(0, 16);
    setTokenExpiresAt(localIso);
  }

  async function handleResetSessions() {
    setResettingSessions(true);
    setResetSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings/reset-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: initialEvent.id, action: "reset" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to reset device sessions");
      }
      setSessionResetAt(data.sessionResetAt);
      setResetSuccessMsg(
        "All guest device sessions and cookies have been reset! Every guest will receive a fresh camera roll with full shots on their next visit or refresh.",
      );
      setShowResetModal(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setResettingSessions(false);
    }
  }

  async function handleClearReset() {
    if (!confirm("Are you sure you want to clear the reset timestamp? This will restore original session tracking.")) return;
    setResettingSessions(true);
    setResetSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings/reset-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: initialEvent.id, action: "clear" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to clear reset");
      }
      setSessionResetAt(null);
      setResetSuccessMsg("Reset timestamp cleared. Original session tracking restored.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setResettingSessions(false);
    }
  }

  const [availableLuts, setAvailableLuts] = useState<Array<{ fileName: string; url: string; name: string }>>([
    { fileName: "kodak-portra-400.cube", url: "/luts/kodak-portra-400.cube", name: "Kodak Portra 400 (Pastel Warmth & Flattering Skin)" },
    { fileName: "cinestill-800t.cube", url: "/luts/cinestill-800t.cube", name: "CineStill 800T (Night Tungsten & Red Halation Glow)" },
    { fileName: "fuji-eterna-250d.cube", url: "/luts/fuji-eterna-250d.cube", name: "Fujifilm Eterna 250D (Soft Cinema Tone & Muted Highlights)" },
    { fileName: "ilford-hp5-plus.cube", url: "/luts/ilford-hp5-plus.cube", name: "Ilford HP5 Plus (Classic British Monochrome B&W)" },
    { fileName: "super-8mm-vintage.cube", url: "/luts/super-8mm-vintage.cube", name: "Super 8mm Vintage (Retro 1970s Home Movie)" },
    { fileName: "kodak-ektar-100.cube", url: "/luts/kodak-ektar-100.cube", name: "Kodak Ektar 100 (Vivid Landscape & Ultra-Fine Grain)" },
    { fileName: "dazz-cpm35.cube", url: "/luts/dazz-cpm35.cube", name: "Dazz Cam CPM35 (Classic 35mm Rangefinder Warmth)" },
    { fileName: "fuji-classic-neg.cube", url: "/luts/fuji-classic-neg.cube", name: "Fujifilm Classic Neg (Superia Teal & Crimson)" },
    { fileName: "kodak-gold-200.cube", url: "/luts/kodak-gold-200.cube", name: "Kodak Gold 200 (Warm Sunny Wedding Nostalgia)" },
  ]);
  const [uploadingLut, setUploadingLut] = useState(false);
  const [lutUploadMsg, setLutUploadMsg] = useState<string | null>(null);

  // Fetch available LUTs on load
  React.useEffect(() => {
    fetch("/api/admin/luts")
      .then((res) => res.json())
      .then((data) => {
        if (data.luts && Array.isArray(data.luts)) {
          setAvailableLuts(data.luts);
        }
      })
      .catch(() => {});
  }, []);

  const handleLutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLut(true);
    setLutUploadMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/luts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to upload LUT");
      }
      setLutUploadMsg(`Successfully uploaded ${data.fileName}!`);
      // Refresh list
      const listRes = await fetch("/api/admin/luts");
      const listData = await listRes.json();
      if (listData.luts) setAvailableLuts(listData.luts);
      setActiveLookId(data.fileName);
    } catch (err) {
      setLutUploadMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingLut(false);
      e.target.value = "";
    }
  };

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialEvent.id,
          couple_names: coupleNames,
          shots_per_guest: Number(shotsPerGuest),
          manually_closed: manuallyClosed,
          opens_at: opensAt ? new Date(opensAt).toISOString() : null,
          closes_at: closesAt ? new Date(closesAt).toISOString() : null,
          theme: {
            accentColor,
            bgColor,
            note: welcomeNote,
            eventSubtitle: eventSubtitle.trim(),
            activeLookId,
            ...(sessionResetAt ? { sessionResetAt } : {}),
          },
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setMessage({ type: "success", text: "Event settings saved successfully!" });
      router.refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 mb-8 border-b border-zinc-800/80">
        <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400/90 font-medium">Administration</span>
        <h1 className="text-xl sm:text-2xl font-serif text-white mt-1">Event Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure guest limits, access schedule, and visual theme for slug <code className="text-amber-400/90 font-mono font-medium">/e/{initialEvent.slug}</code>.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 mb-6 rounded-xl border text-xs leading-relaxed flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
              : "bg-rose-950/40 border-rose-800/60 text-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-rose-400 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Event Identity & Editorial Copy */}
        <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              1. Event Identity & Theme
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Front Cover & Prints
            </span>
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Event Subtitle / Tagline
            </label>
            <input
              type="text"
              value={eventSubtitle}
              onChange={(e) => setEventSubtitle(e.target.value)}
              placeholder="Defaults to 'the wedding of' if left blank"
              maxLength={80}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-100 text-sm focus:border-amber-400/60 focus:outline-none placeholder:text-zinc-600 transition-colors"
            />
            <p className="text-[11px] text-zinc-400 mt-1 font-sans">
              Displayed above names on the guest front camera screen and printable poster.
            </p>
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Couple or Host Names
            </label>
            <input
              type="text"
              required
              value={coupleNames}
              onChange={(e) => setCoupleNames(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-100 text-sm focus:border-amber-400/60 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Exposures Per Guest (Film Roll Capacity)
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="number"
                min={1}
                max={initialEvent.package_max_shots_per_guest || 100}
                required
                value={shotsPerGuest}
                onChange={(e) => setShotsPerGuest(parseInt(e.target.value, 10) || 1)}
                className="w-full sm:w-44 px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-100 text-sm font-mono focus:border-amber-400/60 focus:outline-none transition-colors"
              />
              <span className="text-[11px] font-mono text-amber-300 bg-amber-400/[0.08] border border-amber-400/20 px-2.5 py-1.5 rounded-lg w-fit">
                Package Tier Quota: Max {initialEvent.package_max_shots_per_guest || 100} shots ({initialEvent.package_tier || "owner_unlimited"})
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 font-sans">
              Standard disposable rolls provide 15 or 27 exposures. Capped by your client package tier.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
                Accent / Shutter Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-32 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-200 uppercase focus:border-amber-400/60 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
                Dark Background Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-32 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-200 uppercase focus:border-amber-400/60 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Guest Welcome Note (Optional)
            </label>
            <textarea
              rows={2}
              value={welcomeNote}
              onChange={(e) => setWelcomeNote(e.target.value)}
              placeholder="e.g. Capture candid memories tonight for our private album!"
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-100 text-xs focus:border-amber-400/60 focus:outline-none placeholder:text-zinc-600 transition-colors"
            />
          </div>

          {/* Cloud Storage Vault Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M7 7h10" />
                  <path d="M10 7v10" />
                  <path d="M14 7v10" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-200 flex items-center gap-2">
                  <span>Google Drive Storage</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    CONNECTED
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Guest photos are saved automatically in real time.
                </div>
              </div>
            </div>
            {userRole === "superadmin" && (
              <a
                href="/admin/connect-drive"
                className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors shrink-0 whitespace-nowrap self-end sm:self-center"
              >
                Configure Vault →
              </a>
            )}
          </div>
        </div>

        {/* Section 2: Schedule & Camera Control */}
        <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              2. Schedule & Camera Control
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Access Windows
            </span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div>
              <p className="text-sm font-medium text-white">Manual Closed Switch</p>
              <p className="text-xs text-zinc-400">
                Instantly disable photo capture regardless of scheduled times.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManuallyClosed(!manuallyClosed)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                manuallyClosed ? "bg-rose-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  manuallyClosed ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Opens At (Optional)
              </label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-200 focus:border-amber-400/60 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Closes At (Optional)
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-200 focus:border-amber-400/60 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Event Link & Access Window */}
        <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div>
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                3. Event Link & Access Window
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage rotating access tokens, secure QR links, and camera expiration.
              </p>
            </div>
            {accessToken && (
              <span className="px-2.5 py-1 rounded-md bg-amber-400/[0.08] border border-amber-400/25 text-amber-300 text-xs font-mono font-medium tracking-wider">
                TOKEN: {accessToken}
              </span>
            )}
          </div>

          {/* Guest Link Display & Copy (Strictly Read-Only) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-400/80">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Event Guest URL (Includes Active Token)</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Locked &bull; Read-Only
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  aria-readonly="true"
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/e/${initialEvent.slug}${accessToken ? `?t=${accessToken}` : ""}`
                      : `/e/${initialEvent.slug}${accessToken ? `?t=${accessToken}` : ""}`
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs font-mono text-zinc-300 select-all cursor-text focus:outline-none focus:border-amber-400/40"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="h-8 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {tokenCopied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-emerald-400">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Access Window Expiration Notice */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-zinc-400 font-medium">Camera Expiration Status:</span>
              {tokenExpiresAt ? (() => {
                const notice = formatExpirationNotice(tokenExpiresAt, "en");
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                      notice.isExpired
                        ? "bg-rose-950/60 border border-rose-800/80 text-rose-300"
                        : "bg-emerald-950/60 border border-emerald-800/80 text-emerald-300"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        notice.isExpired ? "bg-rose-400" : "bg-emerald-400"
                      }`}
                    />
                    {notice.isExpired
                      ? `Expired (${notice.formattedDate})`
                      : `Active • Closes in ${notice.relativeRemaining} (${notice.formattedDate})`}
                  </span>
                );
              })() : (
                <span className="text-xs text-zinc-500 font-mono">No expiration set</span>
              )}
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-[11px] text-zinc-400 mb-2">
                Quick Select Duration (from now):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "24 Hours (1 Day)", hours: 24 },
                  { label: "48 Hours (2 Days)", hours: 48 },
                  { label: "72 Hours (3 Days)", hours: 72 },
                  { label: "7 Days (1 Week)", hours: 168 },
                ].map((preset) => (
                  <button
                    key={preset.hours}
                    type="button"
                    onClick={() => handlePresetDuration(preset.hours)}
                    className={`px-3 py-2 rounded-lg text-xs font-mono transition text-center cursor-pointer border ${
                      tokenDurationHours === preset.hours
                        ? "bg-amber-400/[0.12] text-amber-300 font-semibold border-amber-400/40 shadow-sm"
                        : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Expiration Date & Time */}
            <div className="pt-1">
              <label className="block text-[11px] text-zinc-400 mb-1.5">
                Exact Expiration Date & Time:
              </label>
              <input
                type="datetime-local"
                value={tokenExpiresAt}
                onChange={(e) => setTokenExpiresAt(e.target.value)}
                className="w-full sm:w-72 px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:border-amber-400/60 focus:outline-none text-xs font-mono text-zinc-200"
              />
            </div>

            {/* Action Buttons for Window & Rotation */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                disabled={updatingToken}
                onClick={handleUpdateExpiration}
                className="h-8 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {updatingToken ? "Updating…" : "Update Expiration (Keep QR)"}
              </button>

              <button
                type="button"
                onClick={() => setShowRotateModal(true)}
                className="h-8 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 text-xs font-medium transition-colors cursor-pointer sm:ml-auto flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-rose-400">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
                <span>Rotate Token & New QR</span>
              </button>
            </div>

            {tokenSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs leading-relaxed font-sans mt-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{tokenSuccessMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Film Simulation & 3D LUT Recipe */}
        <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              4. Active Film Simulation & 3D LUT Recipe
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
              Default Look
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Choose the default film look applied to guest photos.
          </p>

          <div>
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Active Camera Recipe / LUT
            </label>
            <select
              value={activeLookId}
              onChange={(e) => setActiveLookId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:border-amber-400/60 focus:outline-none text-sm text-zinc-100 font-medium"
            >
              <optgroup label="Calibrated Film & Camera Recipes">
                <option value="fuji-eterna-250d">Cinema 250D (Soft Cinema Motion-Picture & Muted Highlights)</option>
                <option value="classic-chrome">Classic Chrome (Documentary Kodachrome 64 Warmth & Teal Sky)</option>
                <option value="portra-400">Warm Portrait 400 (Pastel Warmth & Flattering Skin Tones)</option>
                <option value="cpm-35">Rangefinder 35 (Classic 35mm Rangefinder — Golden Warmth)</option>
                <option value="reala-ace">Reala Ace 100 (Fujicolor Reala 4th-Layer Cyan & Luminous Skin)</option>
                <option value="editorial-flash">Editorial Flash (High-Fashion Vogue Direct Flash & Obsidian Blacks)</option>
                <option value="warm-vintage">Warm Vintage Heritage (Destination Golden Warmth & Honey Skin)</option>
                <option value="retro-90s-flash">Retro 90s Flash (Point-and-Shoot Xenon Falloff & Chartreuse)</option>
                <option value="classic-neg">Classic Neg 400 (Deep Teal Foliage & Crimson)</option>
                <option value="golden-200">Golden 200 (Warm Sunny Wedding Nostalgia)</option>
                <option value="disposable-400">Disposable 400 (Authentic 90s Disposable)</option>
                <option value="ccd-flash">Digicam Flash (2000s CCD Digicam Vibe)</option>
                <option value="airy-romantic">Airy Romantic 400H (Fuji Pro 400H Soft Matte & Luminous Skin)</option>
                <option value="cinestill-800t">Tungsten 800T (Night Tungsten & Red Halation Glow)</option>
                <option value="kodak-ektar-100">Vivid 100 (Ultra-Fine Grain Daylight Landscape)</option>
                <option value="super-8mm-vintage">Super 8mm Vintage (1970s Warm Celluloid Home Movie)</option>
                <option value="tri-x-400">Panchromatic B&W 400 (High-Contrast Black & White — Silver Grain)</option>
                <option value="ilford-hp5-plus">Mono Street 400 (High-Contrast Street B&W)</option>
                <option value="instant">Instant Square (Milky Blacks & Square Framing)</option>
              </optgroup>

              {availableLuts.length > 0 && (
                <optgroup label="Uploaded 3D .cube LUT Files">
                  {availableLuts.map((lut) => (
                    <option key={lut.fileName} value={lut.fileName}>
                      {lut.name} ({lut.fileName})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Import / Upload new .cube LUT file */}
          <div className="pt-2 border-t border-zinc-800/60">
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Import New 3D LUT (.cube file)
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="h-8 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-amber-300 font-mono flex items-center gap-2 cursor-pointer transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                <span>{uploadingLut ? "Uploading LUT…" : "Choose .cube file"}</span>
                <input
                  type="file"
                  accept=".cube"
                  disabled={uploadingLut}
                  onChange={handleLutUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-zinc-500 font-sans">
                Upload Adobe 3D .cube LUTs directly from Lightroom or DaVinci Resolve.
              </span>
            </div>

            {lutUploadMsg && (
              <p className="text-xs text-amber-300 mt-2 font-mono">
                {lutUploadMsg}
              </p>
            )}
          </div>
        </div>

        {/* Section 5: Guest Device Sessions & Maintenance */}
        <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              5. Guest Device Sessions & Maintenance
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded">
              Device Management
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Reset guest rolls to give everyone {shotsPerGuest} fresh shots. Existing uploaded photos remain safe.
          </p>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white">Current Session Status:</span>
                {sessionResetAt ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Reset Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Initial Wedding Session
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                {sessionResetAt
                  ? `Last reset on ${new Date(sessionResetAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                  : "Never reset. Guests are on their initial camera rolls."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {sessionResetAt && (
                <button
                  type="button"
                  disabled={resettingSessions}
                  onClick={handleClearReset}
                  className="h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Clear Reset
                </button>
              )}
              <button
                type="button"
                disabled={resettingSessions}
                onClick={() => setShowResetModal(true)}
                className="h-8 px-3.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-rose-400">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
                <span>{resettingSessions ? "Resetting…" : "Reset All Devices & Cookies"}</span>
              </button>
            </div>
          </div>

          {resetSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs leading-relaxed font-sans flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400 shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{resetSuccessMsg}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-6 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-medium text-xs shadow-sm transition-colors cursor-pointer"
          >
            {saving ? "Saving Changes…" : "Save Event Settings"}
          </button>
        </div>
      </form>

      {/* Confirmation Modal: Reset Sessions */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-serif text-white">
                Reset All Guest Device Sessions?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connected guest phones will receive a fresh roll of {shotsPerGuest} shots upon refreshing.
              </p>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 text-left flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span><strong>Safe:</strong> All previously uploaded photos in Google Drive and your gallery remain completely untouched.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={resettingSessions}
                onClick={() => setShowResetModal(false)}
                className="h-8 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resettingSessions}
                onClick={handleResetSessions}
                className="h-8 px-5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {resettingSessions ? "Resetting…" : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Rotate Token */}
      {showRotateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-amber-400 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-serif text-white">
                Rotate Token & Invalidate Old Links?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Generates a new token and immediately invalidates previous links and printed QR codes.
              </p>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 text-left space-y-1">
                <div><span className="font-medium text-amber-400">New Window:</span> Set for {tokenDurationHours} hours from right now.</div>
                <div><span className="font-medium text-rose-400">Physical Cards:</span> You will need to re-download or print new table cards.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={rotatingToken}
                onClick={() => setShowRotateModal(false)}
                className="h-8 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rotatingToken}
                onClick={handleRotateToken}
                className="h-8 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {rotatingToken ? "Rotating…" : "Confirm & Rotate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
