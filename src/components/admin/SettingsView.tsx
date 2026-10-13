"use client";

import React, { useState } from "react";

interface SettingsViewProps {
  initialEvent: {
    id: string;
    slug: string;
    couple_names: string;
    shots_per_guest: number;
    opens_at: string | null;
    closes_at: string | null;
    manually_closed: boolean;
    theme: {
      accentColor?: string;
      accentFg?: string;
      bgColor?: string;
      note?: string;
      activeLookId?: string;
      sessionResetAt?: string;
    };
  };
}

export function SettingsView({ initialEvent }: SettingsViewProps) {
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
  const [activeLookId, setActiveLookId] = useState(
    initialEvent.theme?.activeLookId || "cpm-35",
  );
  const [sessionResetAt, setSessionResetAt] = useState<string | null>(
    initialEvent.theme?.sessionResetAt || null,
  );
  const [resettingSessions, setResettingSessions] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

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
            1. Wedding Information
          </h2>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Couple Names (Displayed on Camera and Table Cards)
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
              Shots Per Guest (Limit enforced atomically)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              required
              value={shotsPerGuest}
              onChange={(e) => setShotsPerGuest(parseInt(e.target.value, 10) || 1)}
              className="w-full sm:w-48 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm font-mono text-zinc-100"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Standard disposable camera has 15 or 27 exposures.
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

        {/* Theme Customizer Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            3. Visual Theme & Accents
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
    </div>
  );
}
