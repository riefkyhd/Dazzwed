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
  const [emblemDataUrl, setEmblemDataUrl] = useState<string>("");
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  // Pre-load official Unveiled brand emblem as base64 for self-contained SVG & PNG export
  useEffect(() => {
    let ignore = false;
    async function loadEmblem() {
      try {
        const res = await fetch("/unveiled-transparent.png");
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!ignore && typeof reader.result === "string") {
            setEmblemDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Failed to load brand emblem:", err);
      }
    }
    void loadEmblem();
    return () => {
      ignore = true;
    };
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

  // Builds a complete, standalone, vector A4 Poster SVG
  function generatePosterSvg(): string {
    const cleanGuestUrl = guestUrl.replace(/^https?:\/\//, "");
    const escapeXml = (unsafe: string) =>
      unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1697" width="1200" height="1697">
  <defs>
    <filter id="poster-card-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.06" />
    </filter>
  </defs>

  <!-- Background Warm Luxury Paper -->
  <rect width="1200" height="1697" fill="#FDFBF7" />

  <!-- Double Gold Borders (Smooth luxury rounded corners, no sharp outside L brackets) -->
  <rect x="36" y="36" width="1128" height="1625" rx="28" fill="none" stroke="#D4AF37" stroke-width="3" stroke-opacity="0.45" />
  <rect x="52" y="52" width="1096" height="1593" rx="20" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.3" />

  <!-- Brand Emblem -->
  ${emblemDataUrl ? `<image href="${emblemDataUrl}" x="520" y="110" width="160" height="160" preserveAspectRatio="xMidYMid meet" />` : ""}

  <!-- Subtitle -->
  <text x="600" y="335" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#8C7A5B" letter-spacing="6">${escapeXml(eventSubtitle.toUpperCase())}</text>

  <!-- Couple Names -->
  <text x="600" y="415" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="56" font-weight="normal" fill="#1A1816" letter-spacing="-0.5">${escapeXml(event.couple_names)}</text>

  <!-- QR Card Box -->
  <rect x="375" y="475" width="450" height="450" rx="28" fill="#FFFFFF" stroke="#EBE7DF" stroke-width="3" filter="url(#poster-card-shadow)" />

  <!-- Inner corner marks around QR -->
  <path d="M 395 495 L 395 515 M 395 495 L 415 495" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.6" />
  <path d="M 805 495 L 805 515 M 805 495 L 785 495" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.6" />
  <path d="M 395 905 L 395 885 M 395 905 L 415 905" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.6" />
  <path d="M 805 905 L 805 885 M 805 905 L 785 905" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.6" />

  <!-- QR Code -->
  ${qrDataUrl ? `<image href="${qrDataUrl}" x="415" y="515" width="370" height="370" />` : ""}

  <!-- Scan Instruction -->
  <text x="600" y="980" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="500" fill="#1A1816">Scan with your phone to start snapping</text>

  <!-- Photos Quota -->
  <text x="600" y="1020" text-anchor="middle" font-family="monospace, ui-monospace" font-size="20" fill="#8C7A5B" letter-spacing="1">${event.shots_per_guest} photos</text>

  <!-- 3-Step Guide Container -->
  <rect x="220" y="1070" width="760" height="230" rx="24" fill="#F4EFE6" fill-opacity="0.8" stroke="#E6DEC8" stroke-width="2" />

  <!-- Vertical Dividers -->
  <line x1="473" y1="1090" x2="473" y2="1280" stroke="#E6DEC8" stroke-width="1.5" />
  <line x1="726" y1="1090" x2="726" y2="1280" stroke="#E6DEC8" stroke-width="1.5" />

  <!-- Step 1 -->
  <circle cx="346" cy="1130" r="22" fill="#D4AF37" />
  <text x="346" y="1138" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#FFFFFF">1</text>
  <text x="346" y="1185" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#1A1816">Scan Code</text>
  <text x="346" y="1225" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#6B655B">No app download needed</text>

  <!-- Step 2 -->
  <circle cx="600" cy="1130" r="22" fill="#D4AF37" />
  <text x="600" y="1138" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#FFFFFF">2</text>
  <text x="600" y="1185" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#1A1816">Snap Photos</text>
  <text x="600" y="1225" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#6B655B">Capture candid moments</text>

  <!-- Step 3 -->
  <circle cx="853" cy="1130" r="22" fill="#D4AF37" />
  <text x="853" y="1138" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#FFFFFF">3</text>
  <text x="853" y="1185" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#1A1816">Auto-Saved</text>
  <text x="853" y="1225" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#6B655B">Stored to album</text>

  <!-- Bottom Section -->
  <text x="600" y="1460" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#8C7A5B">Photos stored privately for the couple&apos;s album &#x2665;</text>
  <text x="600" y="1500" text-anchor="middle" font-family="monospace, ui-monospace" font-size="17" fill="#A8A196">${escapeXml(cleanGuestUrl)}</text>
</svg>`;
  }

  // 1. Download Complete A4 Poster as high-resolution PNG
  async function handleDownloadPosterPng() {
    if (!qrDataUrl) return;
    setIsGeneratingPng(true);
    try {
      const svg = generatePosterSvg();
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 1754;
            canvas.height = 2480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, 1754, 2480);
              canvas.toBlob((pngBlob) => {
                if (pngBlob) {
                  const pngUrl = URL.createObjectURL(pngBlob);
                  const a = document.createElement("a");
                  a.href = pngUrl;
                  a.download = `unveiled-poster-${event.slug}.png`;
                  a.click();
                  URL.revokeObjectURL(pngUrl);
                }
                resolve();
              }, "image/png");
            } else {
              resolve();
            }
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (e) => reject(e);
        img.src = url;
      });
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate poster PNG:", err);
    } finally {
      setIsGeneratingPng(false);
    }
  }

  // 2. Download Complete A4 Poster as vector SVG
  function handleDownloadPosterSvg() {
    const svg = generatePosterSvg();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unveiled-poster-${event.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 3. Standalone bare QR Code exports (for external stationary designers)
  function handleDownloadBareQrPng() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `unveiled-qr-${event.slug}.png`;
    a.click();
  }

  function handleDownloadBareQrSvg() {
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

        {/* Primary Action Buttons: Complete Poster Downloads & Print */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-2">
          <button
            onClick={handleDownloadPosterPng}
            disabled={!qrDataUrl || isGeneratingPng}
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 shrink-0">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span className="truncate">{isGeneratingPng ? "Preparing Poster…" : "Download Poster (PNG)"}</span>
          </button>

          <button
            onClick={handleDownloadPosterSvg}
            disabled={!qrDataUrl}
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 shrink-0">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span className="truncate">Download Poster (SVG)</span>
          </button>

          <button
            onClick={handlePrint}
            className="w-full px-5 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10 cursor-pointer min-h-[44px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
              <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.5A1.75 1.75 0 0 1 13.25 8H6.75A1.75 1.75 0 0 1 5 6.25v-3.5Zm1.5 0v3.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M2.5 7A1.5 1.5 0 0 0 1 8.5v5A1.5 1.5 0 0 0 2.5 15h1.75v-2.25a2.25 2.25 0 0 1 2.25-2.25h7a2.25 2.25 0 0 1 2.25 2.25V15h1.75a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 17.5 7h-15Zm12 2a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              <path d="M5.75 12A.75.75 0 0 0 5 12.75v4.5c0 .966.784 1.75 1.75 1.75h6.5A1.75 1.75 0 0 0 15 17.25v-4.5a.75.75 0 0 0-.75-.75h-8.5Z" />
            </svg>
            <span className="truncate">Print A4 Poster</span>
          </button>
        </div>

        {/* Secondary Utility Links: Standalone bare QR export for graphic designers */}
        <div className="pt-3 flex flex-wrap items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/60 mt-3">
          <span className="text-[11px] text-zinc-400">Need just the bare QR code without poster graphics?</span>
          <div className="flex items-center gap-3 mt-1.5 sm:mt-0 font-mono text-[11px]">
            <button
              onClick={handleDownloadBareQrPng}
              disabled={!qrDataUrl}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              QR PNG (1200px)
            </button>
            <span className="text-zinc-600">•</span>
            <button
              onClick={handleDownloadBareQrSvg}
              disabled={!qrSvg}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              QR SVG (Vector)
            </button>
          </div>
        </div>
      </div>

      {/* Printable Vertical A4 Poster Section */}
      <div className="flex justify-center items-center py-4 w-full overflow-hidden">
        {/*
          Vertical A4 Poster: 210mm x 297mm (1 : 1.414 aspect ratio).
          On screen preview: generous breathing room, styled with warm paper cream (#FDFBF7) and gold luxury border.
          Outside sharp L corners removed per user request for clean luxury rounded borders.
        */}
        <div
          ref={cardRef}
          className="print-card bg-[#FDFBF7] text-[#1A1816] w-full max-w-[480px] min-h-[640px] sm:min-h-[680px] sm:aspect-[210/297] p-5 sm:p-9 rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-[#D4AF37]/40 flex flex-col justify-between items-center text-center relative overflow-hidden select-none box-border"
        >
          {/* Inner Inset Border */}
          <div className="absolute inset-3 sm:inset-4 border border-[#D4AF37]/30 rounded-2xl pointer-events-none" />

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

      {/* Print Styles for Single-Page A4 Portrait */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          *,
          *::before,
          *::after {
            box-sizing: border-box !important;
          }
          html,
          body {
            background: #fdfbf7 !important;
            color: #1a1816 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header,
          nav,
          .print\\:hidden {
            display: none !important;
          }
          /* Neutralize all parent layout wrappers so dark background and margins are completely wiped */
          div[class*="min-h-screen"],
          main,
          div[class*="max-w-"] {
            background: #fdfbf7 !important;
            background-color: #fdfbf7 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
            overflow: hidden !important;
          }
          .print-card {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 20mm 16mm !important;
            border: 2px solid #d4af37 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fdfbf7 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
            z-index: 999999 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
        }
      `}</style>
    </div>
  );
}
