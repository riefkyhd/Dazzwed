"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QrGeneratorViewProps {
  event: {
    slug: string;
    couple_names: string;
    shots_per_guest: number;
    access_token?: string;
    theme?: unknown;
  };
}

export function QrGeneratorView({ event }: QrGeneratorViewProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrSvg, setQrSvg] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const tokenQuery = event.access_token ? `?t=${event.access_token}` : "";
  const guestUrl = `${baseUrl || "https://dazzwed.vercel.app"}/e/${event.slug}${tokenQuery}`;

  // Extract optional event subtitle/tagline from theme
  const themeObj = event.theme && typeof event.theme === "object" ? (event.theme as Record<string, unknown>) : null;
  const eventSubtitle = typeof themeObj?.eventSubtitle === "string" && themeObj.eventSubtitle.trim()
    ? themeObj.eventSubtitle.trim()
    : "The Wedding Of";

  useEffect(() => {
    let ignore = false;
    async function gen() {
      try {
        const png = await QRCode.toDataURL(guestUrl, {
          width: 1200,
          margin: 1,
          color: { dark: "#1A1816", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        const svg = await QRCode.toString(guestUrl, {
          type: "svg",
          margin: 1,
          color: { dark: "#1A1816", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        if (!ignore) {
          setQrDataUrl(png);
          setQrSvg(svg);
        }
      } catch (err) {
        console.error("Failed to generate QR code:", err);
      }
    }
    void gen();
    return () => {
      ignore = true;
    };
  }, [guestUrl]);

  function handleDownloadPng() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `unveiled-qr-${event.slug}.png`;
    a.click();
  }

  function handleDownloadSvg() {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unveiled-qr-${event.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Controls Header - hidden during print */}
      <div className="print:hidden pb-6 mb-6 sm:mb-8 border-b border-zinc-800">
        <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Printables</span>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">QR Code & Vertical A4 Poster</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          High-resolution vertical A4 portrait printable poster with Unveiled branding and guest camera instructions.
        </p>
      </div>

      {/* Configuration & Action Bar - hidden during print */}
      <div className="print:hidden p-4 sm:p-6 mb-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
            Event Guest URL (Includes Active Token)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-domain.com"
              className="w-full sm:flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-xs font-mono text-zinc-200 truncate"
            />
            <span className="self-center text-xs font-mono text-amber-400 break-all text-center sm:text-left">
              /e/{event.slug}{event.access_token ? `?t=${event.access_token}` : ""}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pt-2">
          <button
            onClick={handleDownloadPng}
            disabled={!qrDataUrl}
            className="w-full sm:w-auto px-3 sm:px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 shrink-0">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span className="truncate">PNG (1200px)</span>
          </button>

          <button
            onClick={handleDownloadSvg}
            disabled={!qrSvg}
            className="w-full sm:w-auto px-3 sm:px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 shrink-0">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span className="truncate">SVG (Vector)</span>
          </button>

          <button
            onClick={handlePrint}
            className="col-span-2 w-full sm:w-auto sm:ml-auto px-5 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10 cursor-pointer min-h-[44px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
              <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.5A1.75 1.75 0 0 1 13.25 8H6.75A1.75 1.75 0 0 1 5 6.25v-3.5Zm1.5 0v3.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M2.5 7A1.5 1.5 0 0 0 1 8.5v5A1.5 1.5 0 0 0 2.5 15h1.75v-2.25a2.25 2.25 0 0 1 2.25-2.25h7a2.25 2.25 0 0 1 2.25 2.25V15h1.75a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 17.5 7h-15Zm12 2a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              <path d="M5.75 12A.75.75 0 0 0 5 12.75v4.5c0 .966.784 1.75 1.75 1.75h6.5A1.75 1.75 0 0 0 15 17.25v-4.5a.75.75 0 0 0-.75-.75h-8.5Z" />
            </svg>
            <span className="truncate">Print Vertical A4 Poster</span>
          </button>
        </div>
      </div>

      {/* Printable Vertical A4 Poster Section */}
      <div className="flex justify-center items-center py-4 w-full overflow-hidden">
        {/*
          Vertical A4 Poster: 210mm x 297mm (1 : 1.414 aspect ratio).
          On screen preview: generous breathing room, styled with warm paper cream (#FDFBF7) and gold luxury border.
        */}
        <div
          ref={cardRef}
          className="print-card bg-[#FDFBF7] text-[#1A1816] w-full max-w-[480px] min-h-[640px] sm:min-h-[680px] sm:aspect-[210/297] p-5 sm:p-9 rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-[#D4AF37]/40 flex flex-col justify-between items-center text-center relative overflow-hidden select-none box-border"
        >
          {/* Inner Inset Border */}
          <div className="absolute inset-3 sm:inset-4 border border-[#D4AF37]/30 rounded-2xl pointer-events-none" />

          {/* Decorative Corner Filigree / Brackets */}
          <div className="absolute top-4 left-4 sm:top-5 sm:left-5 w-6 h-6 border-t-2 border-l-2 border-[#D4AF37] pointer-events-none" />
          <div className="absolute top-4 right-4 sm:top-5 sm:right-5 w-6 h-6 border-t-2 border-r-2 border-[#D4AF37] pointer-events-none" />
          <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 w-6 h-6 border-b-2 border-l-2 border-[#D4AF37] pointer-events-none" />
          <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 w-6 h-6 border-b-2 border-r-2 border-[#D4AF37] pointer-events-none" />

          {/* Top Section: Standalone Unveiled Brand Emblem */}
          <div className="relative z-10 flex flex-col items-center mt-1 sm:mt-3">
            <div className="w-14 h-14 sm:w-20 sm:h-20 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/unveiled-transparent.png"
                alt="Unveiled Brand"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Event & Couple Section */}
          <div className="relative z-10 space-y-1 my-1">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#8C7A5B] font-sans font-semibold">
              {eventSubtitle}
            </p>
            <h2 className="text-2xl sm:text-4xl font-serif text-[#1A1816] font-normal tracking-tight leading-tight px-4">
              {event.couple_names}
            </h2>
          </div>

          {/* Middle Section: QR Code Card with Ornamental Frame */}
          <div className="relative z-10 my-1 sm:my-2 flex flex-col items-center">
            <div className="p-3 sm:p-4 bg-white rounded-2xl shadow-xl border-2 border-[#EBE7DF] relative">
              {/* Subtle inner corner marks around QR */}
              <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-[#D4AF37]/60" />
              <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-[#D4AF37]/60" />
              <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-[#D4AF37]/60" />
              <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-[#D4AF37]/60" />

              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${event.couple_names}`}
                  className="w-40 h-40 sm:w-56 sm:h-56 object-contain"
                />
              ) : (
                <div className="w-40 h-40 sm:w-56 sm:h-56 flex items-center justify-center text-xs text-zinc-400 font-mono">
                  Generating QR…
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm font-serif font-medium text-[#1A1816] mt-3 tracking-wide">
              Scan with your phone to start snapping
            </p>
            <p className="text-[10px] sm:text-xs font-mono text-[#8C7A5B] tracking-wider mt-0.5">
              {event.shots_per_guest} photos
            </p>
          </div>

          {/* 3-Step Guest Instructions Guide */}
          <div className="relative z-10 w-full max-w-sm grid grid-cols-3 gap-2 px-2 py-2.5 sm:py-3 bg-[#F4EFE6]/70 rounded-xl border border-[#E6DEC8] my-1">
            <div className="flex flex-col items-center text-center px-1">
              <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-white font-mono font-bold text-[10px] flex items-center justify-center mb-1">
                1
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-[#1A1816]">Scan Code</span>
              <span className="text-[8px] text-[#6B655B] leading-tight mt-0.5">No app download needed</span>
            </div>

            <div className="flex flex-col items-center text-center px-1 border-x border-[#E6DEC8]">
              <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-white font-mono font-bold text-[10px] flex items-center justify-center mb-1">
                2
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-[#1A1816]">Snap Photos</span>
              <span className="text-[8px] text-[#6B655B] leading-tight mt-0.5">Capture candid moments</span>
            </div>

            <div className="flex flex-col items-center text-center px-1">
              <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-white font-mono font-bold text-[10px] flex items-center justify-center mb-1">
                3
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-[#1A1816]">Auto-Saved</span>
              <span className="text-[8px] text-[#6B655B] leading-tight mt-0.5">Stored to album</span>
            </div>
          </div>

          {/* Bottom Section: Gratitude & Direct URL */}
          <div className="relative z-10 space-y-0.5 my-1">
            <p className="text-[9px] sm:text-[10px] font-medium text-[#8C7A5B] tracking-wide">
              Photos stored privately for the couple&apos;s album &hearts;
            </p>
            <p className="text-[8px] sm:text-[9px] font-mono text-[#A8A196]">
              {guestUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles for Vertical A4 Portrait */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          html,
          body {
            background: #fdfbf7 !important;
            color: #1a1816 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header,
          nav,
          .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }
          .print-card {
            box-shadow: none !important;
            border: 2px solid #d4af37 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            margin: auto !important;
            width: 210mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            height: 297mm !important;
            padding: 20mm 16mm !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
