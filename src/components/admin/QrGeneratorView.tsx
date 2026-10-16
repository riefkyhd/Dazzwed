"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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

  // Builds a complete, standalone, vector A4 Poster SVG (1200 x 1697 px / ISO 216 A4 ratio)
  function generatePosterSvg(): string {
    const cleanGuestUrl = guestUrl.replace(/^https?:\/\//, "");
    const escapeXml = (unsafe: string) =>
      unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const nameLen = event.couple_names.length;
    const nameFontSize = nameLen > 28 ? 48 : nameLen > 20 ? 56 : 64;
    const emblemHref = emblemDataUrl || "/unveiled-transparent.png";

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1697" width="1200" height="1697">
  <defs>
    <filter id="poster-card-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.08" />
    </filter>
  </defs>

  <!-- Background Warm Luxury Paper -->
  <rect width="1200" height="1697" fill="#FDFBF7" />

  <!-- Double Gold Borders -->
  <rect x="44" y="44" width="1112" height="1609" rx="28" fill="none" stroke="#D4AF37" stroke-width="3" stroke-opacity="0.45" />
  <rect x="60" y="60" width="1080" height="1577" rx="20" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.3" />

  <!-- Brand Emblem -->
  <image href="${emblemHref}" x="525" y="90" width="150" height="150" preserveAspectRatio="xMidYMid meet" />

  <!-- Subtitle -->
  <text x="600" y="278" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#8C7A5B" letter-spacing="6">${escapeXml(eventSubtitle.toUpperCase())}</text>

  <!-- Couple Names -->
  <text x="600" y="358" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${nameFontSize}" font-weight="normal" fill="#1A1816" letter-spacing="-0.5">${escapeXml(event.couple_names)}</text>

  <!-- Hero QR Card Box (660 x 660 px — 55% of A4 width) -->
  <rect x="270" y="420" width="660" height="660" rx="32" fill="#FFFFFF" stroke="#EBE7DF" stroke-width="3" filter="url(#poster-card-shadow)" />

  <!-- Inner Gold Corner Accent Marks -->
  <path d="M 295 445 L 295 480 M 295 445 L 330 445" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-opacity="0.75" />
  <path d="M 905 445 L 905 480 M 905 445 L 870 445" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-opacity="0.75" />
  <path d="M 295 1055 L 295 1020 M 295 1055 L 330 1055" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-opacity="0.75" />
  <path d="M 905 1055 L 905 1020 M 905 1055 L 870 1055" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-opacity="0.75" />

  <!-- Hero High-Density QR Code (560 x 560 px — scans effortlessly from 2 meters away) -->
  ${qrDataUrl ? `<image href="${qrDataUrl}" x="320" y="470" width="560" height="560" />` : ""}

  <!-- Scan Instruction Headline -->
  <text x="600" y="1132" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-weight="600" fill="#1A1816" letter-spacing="0.2">Scan with your phone to start snapping</text>

  <!-- Photos Quota & Value Badge -->
  <text x="600" y="1172" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="20" font-weight="bold" fill="#8C7A5B" letter-spacing="2">${event.shots_per_guest} DISPOSABLE PHOTOS • NO APP REQUIRED</text>

  <!-- 3-Step Guide Container -->
  <rect x="140" y="1215" width="920" height="235" rx="24" fill="#F4EFE6" fill-opacity="0.85" stroke="#E6DEC8" stroke-width="2" />

  <!-- Vertical Column Dividers -->
  <line x1="446" y1="1235" x2="446" y2="1430" stroke="#E6DEC8" stroke-width="2" />
  <line x1="753" y1="1235" x2="753" y2="1430" stroke="#E6DEC8" stroke-width="2" />

  <!-- Step 1 -->
  <circle cx="293" cy="1272" r="24" fill="#D4AF37" />
  <text x="293" y="1280" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" font-weight="bold" fill="#FFFFFF">1</text>
  <text x="293" y="1328" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#1A1816">Scan Code</text>
  <text x="293" y="1364" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#6B655B">Point camera &amp; tap link</text>
  <text x="293" y="1394" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#8C7A5B">Works on iOS &amp; Android</text>

  <!-- Step 2 -->
  <circle cx="600" cy="1272" r="24" fill="#D4AF37" />
  <text x="600" y="1280" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" font-weight="bold" fill="#FFFFFF">2</text>
  <text x="600" y="1328" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#1A1816">Snap Photos</text>
  <text x="600" y="1364" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#6B655B">Capture candid memories</text>
  <text x="600" y="1394" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#8C7A5B">Authentic analog film looks</text>

  <!-- Step 3 -->
  <circle cx="907" cy="1272" r="24" fill="#D4AF37" />
  <text x="907" y="1280" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" font-weight="bold" fill="#FFFFFF">3</text>
  <text x="907" y="1328" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#1A1816">Auto-Saved</text>
  <text x="907" y="1364" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#6B655B">Saved to couple&apos;s album</text>
  <text x="907" y="1394" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#8C7A5B">Direct to Google Drive</text>

  <!-- Bottom Section: Privacy & Direct URL -->
  <text x="600" y="1512" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="19" font-weight="500" fill="#8C7A5B">Photos stored privately for the couple&apos;s album &#x2665;</text>
  <text x="600" y="1552" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="18" fill="#A8A196">${escapeXml(cleanGuestUrl)}</text>
</svg>`;
  }

  // Memoized SVG string for real-time on-screen preview and vector printing
  const posterSvg = useMemo(() => {
    return generatePosterSvg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestUrl, eventSubtitle, event.couple_names, event.shots_per_guest, qrDataUrl, emblemDataUrl]);

  // 1. Download Complete A4 Poster as high-resolution 300 DPI PNG (2480 x 3508 px)
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
            canvas.width = 2480;
            canvas.height = 3508;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, 2480, 3508);
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
      <div className="flex justify-center items-center py-4 w-full overflow-hidden print-card-wrapper">
        {/*
          Vertical A4 Poster: 210mm x 297mm (ISO 216 1 : 1.4142 ratio).
          Uses high-resolution vector SVG for both on-screen display, 300 DPI PNG rasterization,
          and pixel-perfect A4 browser printing with zero layout distortion.
        */}
        <div
          ref={cardRef}
          className="print-card w-full max-w-[480px] sm:max-w-[540px] aspect-[210/297] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden bg-[#FDFBF7] border border-[#D4AF37]/40 relative select-none"
        >
          <div
            className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
            dangerouslySetInnerHTML={{ __html: posterSvg }}
          />
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
          .print-card-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
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
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fdfbf7 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
            z-index: 999999 !important;
            display: block !important;
          }
          .print-card svg {
            width: 210mm !important;
            height: 297mm !important;
            display: block !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
