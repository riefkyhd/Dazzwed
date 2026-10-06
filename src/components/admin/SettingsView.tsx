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

  const [availableLuts, setAvailableLuts] = useState<Array<{ fileName: string; url: string; name: string }>>([
    { fileName: "dazz-cpm35.cube", url: "/luts/dazz-cpm35.cube", name: "Dazz Cam CPM35 (Classic 35mm Warmth)" },
    { fileName: "fuji-classic-neg.cube", url: "/luts/fuji-classic-neg.cube", name: "Fujifilm Classic Neg (Teal & Crimson)" },
    { fileName: "kodak-gold-200.cube", url: "/luts/kodak-gold-200.cube", name: "Kodak Gold 200 (Golden Nostalgia)" },
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
              <optgroup label="✨ Calibrated Film & Dazz Cam Recipes">
                <option value="cpm-35">Dazz Cam CPM35 (Classic 35mm Rangefinder — Golden Warmth)</option>
                <option value="classic-neg">Fujifilm Classic Neg (Superia 400 — Deep Teal Foliage & Crimson)</option>
                <option value="golden-200">Kodak Gold 200 (Warm Sunny Wedding Nostalgia)</option>
                <option value="disposable-400">Fuji Quicksnap Disposable 400 (Authentic 90s Disposable)</option>
                <option value="ccd-flash">CCD Direct Flash (Canon PowerShot Digicam Vibe)</option>
                <option value="instant">Instant Polaroid (Milky Blacks & Square Framing)</option>
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
    </div>
  );
}
