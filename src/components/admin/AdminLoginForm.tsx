"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface AdminLoginFormProps {
  nextPath?: string | null;
}

export function AdminLoginForm({ nextPath }: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; redirectTo?: string; role?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Invalid email or password.");
      }

      // Priority: explicit next query param -> server redirectTo -> role fallback
      const destination = nextPath || data.redirectTo || (data.role === "superadmin" ? "/superadmin" : "/admin");
      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0A09] text-zinc-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-zinc-950/80 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative h-12 w-40 mb-3 drop-shadow-md">
            <Image
              src="/Unveiled_logo_horizontal_transparent.png"
              alt="Unveiled"
              fill
              priority
              sizes="160px"
              className="object-contain"
            />
          </div>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-mono">Admin Sign In</p>
        </div>

        <p className="text-xs text-zinc-400 mb-6 leading-relaxed text-center">
          Sign in with your administrator email and password to manage your event.
        </p>

        {error && (
          <div className="p-3.5 mb-5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs leading-relaxed">
            {error}
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
              placeholder="couple@example.com"
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
              placeholder="Enter your password"
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold text-sm shadow-lg shadow-amber-400/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
