"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { triggerHaptic } from "@/lib/camera/haptics";

interface AdminNavbarProps {
  userEmail: string;
}

export function AdminNavbar({ userEmail }: AdminNavbarProps) {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const desktopNavItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Health", href: "/admin/health" },
    { label: "Look Lab", href: "/admin/look-lab" },
    { label: "Settings", href: "/admin/settings" },
    { label: "Photos & Guests", href: "/admin/photos" },
    { label: "QR & Print", href: "/admin/qr" },
    { label: "User Guide", href: "/admin/guide" },
    { label: "Connect Drive", href: "/admin/connect-drive" },
  ];

  // Mobile Bottom Tab Items (App Bar)
  const mobilePrimaryTabs = [
    {
      label: "Overview",
      href: "/admin",
      exact: true,
      icon: (active: boolean) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-amber-400" : "text-zinc-400"}`}
        >
          <path d="M3 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4Zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4ZM3 12a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z" />
        </svg>
      ),
    },
    {
      label: "Photos",
      href: "/admin/photos",
      exact: false,
      icon: (active: boolean) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-amber-400" : "text-zinc-400"}`}
        >
          <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909a.75.75 0 0 1-1.06 0L6.72 7.22a.75.75 0 0 0-1.06 0L2.5 11.06Zm10.25-4.81a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "QR & Print",
      href: "/admin/qr",
      exact: false,
      icon: (active: boolean) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-amber-400" : "text-zinc-400"}`}
        >
          <path fillRule="evenodd" d="M3 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3Zm1 2h-.01v2H4V5Zm7-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2Zm1 2h-.01v2H12V5ZM3 11a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H3Zm1 2h-.01v2H4v-2Zm8-2a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1Zm-2 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1Zm5-4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-1Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Settings",
      href: "/admin/settings",
      exact: false,
      icon: (active: boolean) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-amber-400" : "text-zinc-400"}`}
        >
          <path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 0 1 .804.98v1.361a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.294 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.294A1 1 0 0 1 1 10.68V9.32a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.38 3.03l1.25.834a6.957 6.957 0 0 1 1.416-.587l.294-1.473ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  // Secondary items accessed via "More" sheet on mobile
  const moreItems = [
    {
      label: "System Health",
      href: "/admin/health",
      desc: "Diagnostics, logs & database health",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-400">
          <path fillRule="evenodd" d="M10 1a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9Zm.75 4a.75.75 0 0 0-1.5 0v3.44l-2.22 1.28a.75.75 0 1 0 .75 1.3l2.6-1.5a.75.75 0 0 0 .37-.65V5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Look Lab",
      href: "/admin/look-lab",
      desc: "Fine-tune color profiles & LUTs",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-purple-400">
          <path fillRule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Connect Google Drive",
      href: "/admin/connect-drive",
      desc: "Automated cloud storage sync",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-blue-400">
          <path d="M5.5 16a3.5 3.5 0 0 1-.369-6.98 4 4 0 1 1 7.753-1.977A4.5 4.5 0 1 1 13.5 16h-8Z" />
        </svg>
      ),
    },
    {
      label: "User Guide & Manual",
      href: "/admin/guide",
      desc: "Timeline checklist, QR rules & FAQ",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-400">
          <path d="M10.75 16.82A7.462 7.462 0 0 1 15 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0 0 18 15.06v-11a.75.75 0 0 0-.546-.721A9.006 9.006 0 0 0 15 3a8.963 8.963 0 0 0-4.25 1.065V16.82ZM9.25 4.065A8.963 8.963 0 0 0 5 3c-.85 0-1.673.118-2.455.339A.75.75 0 0 0 2 4.06v11a.75.75 0 0 0 .954.722A7.462 7.462 0 0 1 5 15.5c1.579 0 3.042.487 4.25 1.32V4.065Z" />
        </svg>
      ),
    },
  ];

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 print:hidden">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-amber-500/30 group-hover:scale-105 transition-transform shrink-0 bg-[#F9F6EE]">
                <Image src="/icon-192.png" alt="Unveiled" fill sizes="32px" className="object-contain p-0.5" />
              </div>
              <span className="font-serif font-bold text-sm sm:text-base text-white tracking-tight">
                Unveiled
              </span>
            </Link>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>

          {/* Navigation Items (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {desktopNavItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-zinc-800 text-amber-300 font-semibold"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Badge & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden lg:inline-block text-xs font-mono text-zinc-400 truncate max-w-[180px]">
              {userEmail}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-xs px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer whitespace-nowrap min-h-[36px] flex items-center justify-center"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile-First App Bottom Navigation Bar (Visible only on mobile screens < md) */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-xl px-2 py-1 flex items-center justify-around shadow-2xl print:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {mobilePrimaryTabs.map((tab) => {
          const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => {
                triggerHaptic([10]);
                setShowMoreMenu(false);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all min-h-[48px] cursor-pointer ${
                isActive ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <div className="relative">
                {tab.icon(isActive)}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium tracking-tight ${isActive ? "text-amber-400 font-semibold" : "text-zinc-400"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* More Tab Trigger */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic([15]);
            setShowMoreMenu((prev) => !prev);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all min-h-[48px] cursor-pointer ${
            showMoreMenu || isMoreActive ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-5 h-5 transition-transform ${showMoreMenu || isMoreActive ? "scale-110 text-amber-400" : "text-zinc-400"}`}
            >
              <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
            </svg>
            {isMoreActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
            )}
          </div>
          <span className={`text-[10px] mt-1 font-medium tracking-tight ${showMoreMenu || isMoreActive ? "text-amber-400 font-semibold" : "text-zinc-400"}`}>
            More
          </span>
        </button>
      </nav>

      {/* Mobile "More" Menu Drawer */}
      {showMoreMenu && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-5 space-y-4 shadow-2xl"
            style={{ paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-600 mx-auto -mt-1 mb-2" />
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-semibold">
                Additional Tools
              </span>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {moreItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      triggerHaptic([10]);
                      setShowMoreMenu(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.99] ${
                      isActive
                        ? "bg-zinc-800 border-amber-500/40 text-amber-300"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-[11px] text-zinc-400">{item.desc}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[200px]">
                {userEmail}
              </span>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-rose-300 border border-zinc-700 transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
