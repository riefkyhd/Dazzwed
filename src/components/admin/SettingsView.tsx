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
}

export function SettingsView({ initialEvent }: SettingsViewProps) {
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
      <div className="pb-6 mb-8 border-b border-zinc-800">
        <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Administration</span>
        <h1 className="text-2xl font-serif font-bold text-white mt-1">Event Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure guest limits, access schedule, and visual theme for slug <code className="text-amber-400 font-mono font-semibold">/e/{initialEvent.slug}</code>.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 mb-6 rounded-2xl border text-xs leading-relaxed ${
            message.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-200"
              : "bg-red-950/60 border-red-800 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            1. Event & Couple Information
          </h2>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Event Tagline / Subtitle (e.g. &quot;the wedding of&quot;, &quot;the celebration of&quot;, &quot;the 30th birthday of&quot;)
            </label>
            <input
              type="text"
              value={eventSubtitle}
              onChange={(e) => setEventSubtitle(e.target.value)}
              placeholder="Defaults to 'the wedding of' if left blank"
              maxLength={80}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Displayed above the names on the guest front page and printable poster.
            </p>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Couple or Host Names (Displayed on Camera and Posters)
            </label>
            <input
              type="text"
              required
              value={coupleNames}
              onChange={(e) => setCoupleNames(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Shots Per Guest (Film Roll Capacity)
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="number"
                min={1}
                max={initialEvent.package_max_shots_per_guest || 100}
                required
                value={shotsPerGuest}
                onChange={(e) => setShotsPerGuest(parseInt(e.target.value, 10) || 1)}
                className="w-full sm:w-48 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm font-mono text-zinc-100"
              />
              <span className="text-[11px] font-mono text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1.5 rounded-lg w-fit">
                Package Quota: Max {initialEvent.package_max_shots_per_guest || 100} shots ({initialEvent.package_tier || "owner_unlimited"})
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Standard disposable camera has 15 or 27 exposures. Capped by your client package entitlement.
            </p>
          </div>
        </div>

        {/* Schedule & Availability Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            2. Schedule & Camera Control
          </h2>

          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div>
              <p className="text-sm font-semibold text-white">Manual Closed Switch</p>
              <p className="text-xs text-zinc-400">
                Instantly disable photo capture regardless of scheduled times.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManuallyClosed(!manuallyClosed)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                manuallyClosed ? "bg-red-500" : "bg-zinc-700"
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
                className="w-full px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-xs font-mono text-zinc-200"
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
                className="w-full px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-xs font-mono text-zinc-200"
              />
            </div>
          </div>
        </div>

        {/* 3. Event Link & Rotating Access Token Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                3. Event Link & Access Window
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage rotating access tokens, secure QR links, and guest camera expiration.
              </p>
            </div>
            {accessToken && (
              <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold tracking-wider">
                TOKEN: {accessToken}
              </span>
            )}
          </div>

          {/* Guest Link Display & Copy */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Active Guest Camera Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/e/${initialEvent.slug}${accessToken ? `?t=${accessToken}` : ""}`
                    : `/e/${initialEvent.slug}${accessToken ? `?t=${accessToken}` : ""}`
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-xs font-semibold text-zinc-200 transition cursor-pointer shrink-0"
              >
                {tokenCopied ? "✓ Copied!" : "Copy Link"}
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                      notice.isExpired
                        ? "bg-red-950/80 border border-red-800 text-red-300"
                        : "bg-emerald-950/80 border border-emerald-800 text-emerald-300"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        notice.isExpired ? "bg-red-400" : "bg-emerald-400 animate-pulse"
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
                    className={`px-3 py-2 rounded-xl text-xs font-mono transition text-center cursor-pointer border ${
                      tokenDurationHours === preset.hours
                        ? "bg-amber-400 text-black font-bold border-amber-400"
                        : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
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
                className="w-full sm:w-72 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-xs font-mono text-zinc-200"
              />
            </div>

            {/* Action Buttons for Window & Rotation */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                disabled={updatingToken}
                onClick={handleUpdateExpiration}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {updatingToken ? "Updating…" : "Update Expiration Time (Keep QR)"}
              </button>

              <button
                type="button"
                onClick={() => setShowRotateModal(true)}
                className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-200 text-xs font-semibold transition active:scale-95 cursor-pointer sm:ml-auto flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-red-400">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.75A.75.75 0 0 0 3 12.83v4.482a.75.75 0 0 0 1.5 0v-2.185l.407.407a7 7 0 0 0 11.93-3.414.75.75 0 0 0-1.525-.301Zm-10.624-2.848a5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h4.482A.75.75 0 0 0 17 7.17V2.688a.75.75 0 0 0-1.5 0v2.185l-.407-.407A7 7 0 0 0 3.163 7.88a.75.75 0 0 0 1.525.301Z" clipRule="evenodd" />
                </svg>
                Rotate Token & Generate New QR
              </button>
            </div>

            {tokenSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs leading-relaxed font-sans mt-2">
                ✓ {tokenSuccessMsg}
              </div>
            )}
          </div>
        </div>

        {/* Theme Customizer Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            4. Visual Theme & Accents
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Accent / Shutter Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-32 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Dark Background Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-32 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 uppercase"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Custom Guest Welcome Note (Optional)
            </label>
            <textarea
              rows={2}
              value={welcomeNote}
              onChange={(e) => setWelcomeNote(e.target.value)}
              placeholder="e.g. Capture candid moments for our private album!"
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-xs text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* 4. Film Simulation & 3D LUT Recipe Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              4. Active Film Simulation & 3D LUT Recipe
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              GPU Color Science
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Choose the default photo recipe applied to all guest captures. Guests don&apos;t need to configure anything—the camera automatically bakes in authentic analog film colors, optical halation bloom, and organic silver-halide grain.
          </p>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Active Camera Recipe / LUT
            </label>
            <select
              value={activeLookId}
              onChange={(e) => setActiveLookId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm text-zinc-100 font-medium"
            >
              <optgroup label="✨ Calibrated Film & Camera Recipes">
                <option value="cpm-35">Rangefinder 35 (Classic 35mm Rangefinder — Golden Warmth)</option>
                <option value="portra-400">Warm Portrait 400 (Pastel Warmth & Flattering Skin Tones)</option>
                <option value="editorial-flash">Editorial Flash (High-Fashion Vogue Direct Flash & Obsidian Blacks)</option>
                <option value="airy-romantic">Airy Romantic 400H (Fuji Pro 400H Pastel Mint & Highlight Bloom)</option>
                <option value="warm-vintage">Warm Vintage Heritage (Destination Golden Warmth & Honey Skin)</option>
                <option value="retro-90s-flash">Retro 90s Flash (Point-and-Shoot Xenon Falloff & Chartreuse)</option>
                <option value="classic-chrome">Classic Chrome (Documentary Kodachrome 64 Warmth & Teal Sky)</option>
                <option value="reala-ace">Reala Ace 100 (Fujicolor Reala 4th-Layer Cyan & Luminous Skin)</option>
                <option value="cinestill-800t">Tungsten 800T (Night Tungsten & Red Halation Glow)</option>
                <option value="fuji-eterna-250d">Cinema 250D (Soft Cinema Motion-Picture)</option>
                <option value="classic-neg">Classic Neg 400 (Deep Teal Foliage & Crimson)</option>
                <option value="tri-x-400">Panchromatic B&W 400 (High-Contrast Black & White — Silver Grain)</option>
                <option value="ilford-hp5-plus">Mono Street 400 (High-Contrast Street B&W)</option>
                <option value="kodak-ektar-100">Vivid 100 (Ultra-Vivid Daylight Landscape)</option>
                <option value="super-8mm-vintage">Super 8mm Vintage (1970s Warm Celluloid Home Movie)</option>
                <option value="golden-200">Golden 200 (Warm Sunny Wedding Nostalgia)</option>
                <option value="disposable-400">Disposable 400 (Authentic 90s Disposable)</option>
                <option value="ccd-flash">Digicam Flash (2000s CCD Digicam Vibe)</option>
                <option value="instant">Instant Square (Milky Blacks & Square Framing)</option>
              </optgroup>

              {availableLuts.length > 0 && (
                <optgroup label="📁 Uploaded 3D .cube LUT Files">
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
          <div className="pt-2 border-t border-zinc-900">
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Import New 3D LUT (.cube file)
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-amber-300 font-mono flex items-center gap-2 cursor-pointer transition active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                {uploadingLut ? "Uploading LUT…" : "Choose .cube file"}
                <input
                  type="file"
                  accept=".cube"
                  disabled={uploadingLut}
                  onChange={handleLutUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-zinc-500">
                Upload Adobe 3D .cube LUTs directly from Lightroom, DaVinci Resolve, or film packs.
              </span>
            </div>

            {lutUploadMsg && (
              <p className="text-xs text-amber-300 mt-2 font-mono">
                {lutUploadMsg}
              </p>
            )}
          </div>
        </div>

        {/* 5. Guest Device Sessions & Cookie Management */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              5. Guest Device Sessions & Cookie Cache Reset
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
              Session Management
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Reset active cookies and session storage across all guest phones. When guests have reached their shot limit or you want to start a new round/table, resetting will immediately issue everyone a brand new camera roll with {shotsPerGuest} fresh exposures without requiring guests to clear their browser cache, history, or cookies.
          </p>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Current Session Status:</span>
                {sessionResetAt ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Reset Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
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
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  Clear Reset
                </button>
              )}
              <button
                type="button"
                disabled={resettingSessions}
                onClick={() => setShowResetModal(true)}
                className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-200 text-xs font-semibold shadow-lg shadow-red-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.75A.75.75 0 0 0 3 12.83v4.482a.75.75 0 0 0 1.5 0v-2.185l.407.407a7 7 0 0 0 11.93-3.414.75.75 0 0 0-1.525-.301Zm-10.624-2.848a5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h4.482A.75.75 0 0 0 17 7.17V2.688a.75.75 0 0 0-1.5 0v2.185l-.407-.407A7 7 0 0 0 3.163 7.88a.75.75 0 0 0 1.525.301Z" clipRule="evenodd" />
                </svg>
                {resettingSessions ? "Resetting…" : "Reset All Devices & Cookies"}
              </button>
            </div>
          </div>

          {resetSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs leading-relaxed font-sans">
              ✓ {resetSuccessMsg}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold text-sm shadow-lg shadow-amber-400/10 active:scale-95 transition-all cursor-pointer"
          >
            {saving ? "Saving Changes…" : "Save Event Settings"}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-white font-serif">
                Reset All Guest Device Sessions?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This will invalidate cookies and session storage on every connected guest phone. When guests refresh or reopen the app, they will automatically receive a fresh camera roll with all {shotsPerGuest} shots remaining.
              </p>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 text-left">
                <span className="font-semibold text-emerald-400">✓ Safe:</span> All previously uploaded photos in Google Drive and your wedding gallery remain safe and untouched.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={resettingSessions}
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resettingSessions}
                onClick={handleResetSessions}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {resettingSessions ? "Resetting Devices…" : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rotate Token Confirmation Modal */}
      {showRotateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm14.49 3.882a7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.986a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 14.056-4.041.75.75 0 0 0-1.449-.382Z" clipRule="evenodd" />
              </svg>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-white font-serif">
                Rotate Token & Invalidate Old Links?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This will generate a brand new 8-character token and immediately invalidate the current guest link and all previously printed QR codes. Anyone scanning the old QR code will see the closed access screen.
              </p>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 text-left space-y-1">
                <div><span className="font-semibold text-amber-400">⚡ New Window:</span> Will be set for {tokenDurationHours} hours from right now.</div>
                <div><span className="font-semibold text-red-400">⚠️ Physical QRs:</span> You will need to re-download or print new table cards.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={rotatingToken}
                onClick={() => setShowRotateModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rotatingToken}
                onClick={handleRotateToken}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold shadow-lg shadow-amber-400/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {rotatingToken ? "Rotating Token…" : "Confirm & Rotate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
