"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface AdminNavbarProps {
  userEmail: string;
}

export function AdminNavbar({ userEmail }: AdminNavbarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Health", href: "/admin/health" },
    { label: "Look Lab", href: "/admin/look-lab" },
    { label: "Settings", href: "/admin/settings" },
    { label: "Photos & Guests", href: "/admin/photos" },
    { label: "QR & Print", href: "/admin/qr" },
    { label: "Connect Drive", href: "/admin/connect-drive" },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50 print:hidden">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-amber-500/30 group-hover:scale-105 transition-transform shrink-0 bg-[#F9F6EE]">
              <Image src="/icon-192.png" alt="Dazzwed" fill sizes="32px" className="object-contain p-0.5" />
            </div>
            <span className="font-serif font-bold text-sm sm:text-base text-white tracking-tight">
              Dazzwed
            </span>
          </Link>
          <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>

        {/* Navigation Items (Desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
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
              className="text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer whitespace-nowrap"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav bar - smooth horizontal scroll without overflow clipping */}
      <div className="md:hidden flex items-center gap-1.5 px-3 py-1.5 border-t border-zinc-900 bg-zinc-950 overflow-x-auto text-xs no-scrollbar">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-medium shrink-0 transition-colors ${
                isActive
                  ? "bg-zinc-800 text-amber-300 font-bold border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
