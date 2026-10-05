"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = mode === "setup" ? "/api/auth/setup-admin" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (mode === "setup") {
        setSuccess(data.message || "Admin password created!");
        setTimeout(() => {
          router.push("/admin");
          router.refresh();
        }, 1200);
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0A09] text-zinc-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-zinc-950/80 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
              <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.413l.84 1.399a2.25 2.25 0 0 0 1.927 1.096c.725 0 1.433.072 2.115.213A2.25 2.25 0 0 1 24 9.378V18.75A2.25 2.25 0 0 1 21.75 21H2.25A2.25 2.25 0 0 1 0 18.75V9.378a2.25 2.25 0 0 1 2.126-2.19c.682-.14 1.39-.213 2.115-.213a2.25 2.25 0 0 0 1.927-1.096l.84-1.399A2.75 2.75 0 0 1 9.344 3.07ZM12 7.5a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Disposable Cam</h1>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-mono mt-1">Admin Portal</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-zinc-900/90 p-1 rounded-xl mb-6 border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 py-2 rounded-lg transition-all ${mode === "login" ? "bg-amber-400 text-black font-semibold shadow" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("setup"); setError(null); }}
            className={`flex-1 py-2 rounded-lg transition-all ${mode === "setup" ? "bg-amber-400 text-black font-semibold shadow" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Initial Setup
          </button>
        </div>

        {/* Mode explanation */}
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed text-center">
          {mode === "login"
            ? "Sign in with your allowlisted admin email and password."
            : "First time logging in? Enter your allowlisted email to create your admin password."}
        </p>

        {error && (
          <div className="p-3.5 mb-5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs leading-relaxed">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3.5 mb-5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs leading-relaxed">
            {success} Redirecting to dashboard…
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. riefkyhd.dev@gmail.com"
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold text-sm shadow-lg shadow-amber-400/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            {loading ? "Processing…" : mode === "login" ? "Sign In to Admin" : "Create Password & Sign In"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-900 text-center text-[11px] text-zinc-500">
          Only allowlisted emails in <code className="text-zinc-400">ADMIN_EMAILS</code> are granted access.
        </div>
      </div>
    </div>
  );
}
