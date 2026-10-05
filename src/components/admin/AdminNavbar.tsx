"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminNavbarProps {
  userEmail: string;
}

export function AdminNavbar({ userEmail }: AdminNavbarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Settings", href: "/admin/settings" },
    { label: "Photos & Guests", href: "/admin/photos" },
    { label: "QR & Print", href: "/admin/qr" },
    { label: "Connect Drive", href: "/admin/connect-drive" },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50 print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
                <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.413l.84 1.399a2.25 2.25 0 0 0 1.927 1.096c.725 0 1.433.072 2.115.213A2.25 2.25 0 0 1 24 9.378V18.75A2.25 2.25 0 0 1 21.75 21H2.25A2.25 2.25 0 0 1 0 18.75V9.378a2.25 2.25 0 0 1 2.126-2.19c.682-.14 1.39-.213 2.115-.213a2.25 2.25 0 0 0 1.927-1.096l.84-1.399A2.75 2.75 0 0 1 9.344 3.07ZM12 7.5a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-serif font-bold text-base text-white tracking-tight">
              Disposable Cam
            </span>
          </Link>
          <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>

        {/* Navigation Items */}
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
        <div className="flex items-center gap-3">
          <span className="hidden lg:inline-block text-xs font-mono text-zinc-400 truncate max-w-[180px]">
            {userEmail}
          </span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-zinc-900 bg-zinc-950 overflow-x-auto text-xs">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap text-xs ${
                isActive
                  ? "bg-zinc-800 text-amber-300 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
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
