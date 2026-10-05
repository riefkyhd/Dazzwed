"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QrGeneratorViewProps {
  event: {
    slug: string;
    couple_names: string;
    shots_per_guest: number;
  };
}

export function QrGeneratorView({ event }: QrGeneratorViewProps) {
  const [baseUrl, setBaseUrl] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrSvg, setQrSvg] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  const guestUrl = `${baseUrl || "https://dazzwed.vercel.app"}/e/${event.slug}`;

  useEffect(() => {
    let ignore = false;
    async function gen() {
      try {
        const png = await QRCode.toDataURL(guestUrl, {
          width: 800,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        const svg = await QRCode.toString(guestUrl, {
          type: "svg",
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
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
    a.download = `qr-${event.slug}.png`;
    a.click();
  }

  function handleDownloadSvg() {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${event.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Controls Header - hidden during print */}
      <div className="print:hidden pb-6 mb-8 border-b border-zinc-800">
        <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Printables</span>
        <h1 className="text-2xl font-serif font-bold text-white mt-1">QR Code & Table Cards</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Generate high-resolution vector QR codes or print standard A6 table cards for reception tables.
        </p>
      </div>

      {/* Configuration & Action Bar - hidden during print */}
      <div className="print:hidden p-6 mb-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
            Event Guest URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-domain.com"
              className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none text-xs font-mono text-zinc-200"
            />
            <span className="self-center text-xs font-mono text-amber-400">
              /e/{event.slug}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleDownloadPng}
            disabled={!qrDataUrl}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-all flex items-center gap-2 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span>Download PNG (1024px)</span>
          </button>

          <button
            onClick={handleDownloadSvg}
            disabled={!qrSvg}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-all flex items-center gap-2 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span>Download SVG (Vector)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 transition-all flex items-center gap-2 shadow-lg shadow-amber-400/10 cursor-pointer ml-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.5A1.75 1.75 0 0 1 13.25 8H6.75A1.75 1.75 0 0 1 5 6.25v-3.5Zm1.5 0v3.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M2.5 7A1.5 1.5 0 0 0 1 8.5v5A1.5 1.5 0 0 0 2.5 15h1.75v-2.25a2.25 2.25 0 0 1 2.25-2.25h7a2.25 2.25 0 0 1 2.25 2.25V15h1.75a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 17.5 7h-15Zm12 2a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              <path d="M5.75 12A.75.75 0 0 0 5 12.75v4.5c0 .966.784 1.75 1.75 1.75h6.5A1.75 1.75 0 0 0 15 17.25v-4.5a.75.75 0 0 0-.75-.75h-8.5Z" />
            </svg>
            <span>Print A6 Table Card</span>
          </button>
        </div>
      </div>

      {/* Printable A6 Table Card Section */}
      <div className="flex justify-center items-center py-4">
        {/*
          A6 Dimensions: 105mm x 148mm (aspect ratio approx 1 : 1.414).
          In CSS pixels for screen display: ~396px x 560px.
        */}
        <div
          ref={cardRef}
          className="print-card bg-[#FDFBF7] text-[#1A1816] w-[105mm] min-h-[148mm] p-[10mm] rounded-2xl shadow-2xl border border-amber-900/10 flex flex-col justify-between items-center text-center relative overflow-hidden"
          style={{ boxSizing: "border-box" }}
        >
          {/* Decorative Corner Ornaments */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#D4AF37]/80" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#D4AF37]/80" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#D4AF37]/80" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#D4AF37]/80" />

          {/* Top Section: Names & Motif */}
          <div className="space-y-1 mt-1">
            <span className="text-[9px] uppercase tracking-[0.3em] text-[#8C7A5B] font-sans font-semibold">
              Guest Disposable Camera
            </span>
            <h2 className="text-2xl font-serif font-bold text-[#1A1816] tracking-tight">
              {event.couple_names}
            </h2>
            <div className="w-12 h-px bg-[#D4AF37] mx-auto my-2" />
          </div>

          {/* Middle Section: QR Code */}
          <div className="my-3 flex flex-col items-center">
            <div className="p-2.5 bg-white rounded-xl shadow-md border border-[#EBE7DF]">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${event.couple_names}`}
                  className="w-44 h-44 object-contain"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-xs text-zinc-400 font-mono">
                  Generating QR…
                </div>
              )}
            </div>

            <p className="text-[12px] font-medium text-[#1A1816] mt-3 max-w-[210px] leading-snug">
              Scan with your phone to take your {event.shots_per_guest} wedding photos!
            </p>
          </div>

          {/* Bottom Section: Instructions & Privacy */}
          <div className="space-y-1 mb-1">
            <p className="text-[9px] text-[#6B655B] max-w-[220px] leading-relaxed">
              No app download required. Each shot is vintage-styled with grain and warmth.
            </p>
            <p className="text-[9px] font-medium text-[#8C7A5B] tracking-wide">
              Photos are private and go directly to our album &hearts;
            </p>
            <p className="text-[8px] font-mono text-[#A8A196] pt-1">
              {guestUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, nav, .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            min-height: 100vh !important;
          }
          .print-card {
            box-shadow: none !important;
            border: 1px solid #d4af37 !important;
            page-break-inside: avoid !important;
            margin: auto !important;
            width: 105mm !important;
            min-height: 148mm !important;
            padding: 8mm !important;
          }
        }
      `}</style>
    </div>
  );
}
