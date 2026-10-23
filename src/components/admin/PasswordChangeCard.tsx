"use client";

import React, { useState } from "react";
import { IconLock } from "@/components/ui/Icons";

interface PasswordChangeCardProps {
  sectionNumber?: string;
  className?: string;
  title?: string;
}

export function PasswordChangeCard({
  sectionNumber = "6",
  className = "",
  title = "Account Security & Credentials",
}: PasswordChangeCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword.trim()) {
      setErrorMsg("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to update password. Please check your credentials.");
        return;
      }

      setSuccessMsg("Password updated successfully. Your new credentials are now active.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setSuccessMsg(null);
      }, 6000);
    } catch {
      setErrorMsg("A network error occurred while updating your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`p-6 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <IconLock className="w-3.5 h-3.5 text-amber-400" />
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
            {sectionNumber ? `${sectionNumber}. ${title}` : title}
          </h2>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
          Security & Access
        </span>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed font-sans">
        Update your administrative console password. New passwords must be at least 8 characters long and are encrypted using military-grade scrypt hashing.
      </p>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs leading-relaxed font-sans flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-rose-400 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs leading-relaxed font-sans flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-emerald-400 shrink-0"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              required
              placeholder="Enter current password"
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40 text-sm text-zinc-100 placeholder-zinc-600 font-sans transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              tabIndex={-1}
              aria-label={showCurrent ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              {showCurrent ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-zinc-300 font-medium">New Password</label>
              <span
                className={`text-[10px] font-mono ${
                  newPassword.length >= 8 ? "text-emerald-400" : "text-zinc-500"
                }`}
              >
                {newPassword.length}/8 min chars
              </span>
            </div>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40 text-sm text-zinc-100 placeholder-zinc-600 font-sans transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
                aria-label={showNew ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showNew ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                required
                minLength={8}
                placeholder="Repeat new password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40 text-sm text-zinc-100 placeholder-zinc-600 font-sans transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showConfirm ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={
              submitting ||
              !currentPassword ||
              newPassword.length < 8 ||
              newPassword !== confirmPassword
            }
            className="h-9 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-medium text-xs shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation"
          >
            {submitting ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 text-zinc-950"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Updating Password…</span>
              </>
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
