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
  const [copiedUrl, setCopiedUrl] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  // Pre-load official Unveiled horizontal brand logo as base64 for self-contained SVG & PNG export
  useEffect(() => {
    let ignore = false;
    async function loadEmblem() {
      try {
        const res = await fetch("/Unveiled_logo_horizontal_transparent.png");
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
    const nameFontSize = nameLen > 28 ? 44 : nameLen > 20 ? 52 : 60;
    const emblemHref = emblemDataUrl || "/Unveiled_logo_horizontal_transparent.png";

    // 35mm film stock sprocket perforations along left & right margins
    const sprockets: string[] = [];
    for (let i = 0; i < 22; i++) {
      const y = 120 + i * 68;
      sprockets.push(`<rect x="72" y="${y}" width="22" height="34" rx="6" fill="#1A1816" fill-opacity="0.09" />`);
      sprockets.push(`<rect x="1106" y="${y}" width="22" height="34" rx="6" fill="#1A1816" fill-opacity="0.09" />`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1697" width="1200" height="1697">
  <defs>
    <filter id="poster-card-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.08" />
    </filter>
  </defs>

  <!-- Background Warm Luxury Paper -->
  <rect width="1200" height="1697" fill="#FDFBF7" />

  <!-- 35mm Film Sprocket Perforations -->
  ${sprockets.join("\n  ")}

  <!-- Double Gold Borders -->
  <rect x="44" y="44" width="1112" height="1609" rx="28" fill="none" stroke="#D4AF37" stroke-width="3" stroke-opacity="0.45" />
  <rect x="112" y="60" width="976" height="1577" rx="20" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.3" />

  <!-- Brand Logo (Horizontal) -->
  <image href="${emblemHref}" x="465" y="80" width="270" height="112" preserveAspectRatio="xMidYMid meet" />

  <!-- Subtitle -->
  <text x="600" y="232" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="#8C7A5B" letter-spacing="6">${escapeXml(eventSubtitle.toUpperCase())}</text>

  <!-- Couple Names -->
  <text x="600" y="300" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${nameFontSize}" font-weight="normal" fill="#1A1816" letter-spacing="-0.5">${escapeXml(event.couple_names)}</text>

  <!-- Bold Camera Header Badge -->
  <rect x="280" y="345" width="640" height="50" rx="25" fill="#1A1816" />
  <g transform="translate(305, 358)">
    <!-- Vector Camera Glyph -->
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" fill="none" stroke="#D4AF37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="12" cy="13" r="3" fill="none" stroke="#D4AF37" stroke-width="2" />
  </g>
  <text x="620" y="377" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="16" font-weight="bold" fill="#D4AF37" letter-spacing="3">GUEST CAMERA • SCAN TO TAKE PICTURES</text>

  <!-- Hero QR Card Box (640 x 640 px) -->
  <rect x="280" y="425" width="640" height="640" rx="30" fill="#FFFFFF" stroke="#EBE7DF" stroke-width="3" filter="url(#poster-card-shadow)" />

  <!-- Viewfinder Frame Corner Guides [ + ] -->
  <path d="M 305 450 L 305 485 M 305 450 L 340 450" fill="none" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" />
  <path d="M 895 450 L 895 485 M 895 450 L 860 450" fill="none" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" />
  <path d="M 305 1040 L 305 1005 M 305 1040 L 340 1040" fill="none" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" />
  <path d="M 895 1040 L 895 1005 M 895 1040 L 860 1040" fill="none" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" />

  <!-- Hero High-Density QR Code (540 x 540 px) -->
  ${qrDataUrl ? `<image href="${qrDataUrl}" x="330" y="475" width="540" height="540" />` : ""}

  <!-- Scan Instruction Headline -->
  <text x="600" y="1125" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="600" fill="#1A1816" letter-spacing="0.2">Scan with your phone to take pictures</text>

  <!-- Photos Quota & Value Badge -->
  <text x="600" y="1165" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="18" font-weight="bold" fill="#8C7A5B" letter-spacing="2">${event.shots_per_guest} PHOTOS PER GUEST • NO APP REQUIRED</text>

  <!-- 3-Step Guide Container -->
  <rect x="140" y="1205" width="920" height="230" rx="24" fill="#F4EFE6" fill-opacity="0.85" stroke="#E6DEC8" stroke-width="2" />

  <!-- Vertical Column Dividers -->
  <line x1="446" y1="1225" x2="446" y2="1415" stroke="#E6DEC8" stroke-width="2" />
  <line x1="753" y1="1225" x2="753" y2="1415" stroke="#E6DEC8" stroke-width="2" />

  <!-- Step 1 -->
  <circle cx="293" cy="1260" r="22" fill="#D4AF37" />
  <text x="293" y="1267" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" font-weight="bold" fill="#FFFFFF">1</text>
  <text x="293" y="1312" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#1A1816">01. Scan QR Code</text>
  <text x="293" y="1348" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#6B655B">Open phone camera &amp; tap link</text>
  <text x="293" y="1378" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#8C7A5B">Opens in browser instantly</text>

  <!-- Step 2 -->
  <circle cx="600" cy="1260" r="22" fill="#D4AF37" />
  <text x="600" y="1267" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" font-weight="bold" fill="#FFFFFF">2</text>
  <text x="600" y="1312" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#1A1816">02. Take Pictures</text>
  <text x="600" y="1348" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#6B655B">Capture candid wedding moments</text>
  <text x="600" y="1378" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#8C7A5B">Authentic vintage film looks</text>

  <!-- Step 3 -->
  <circle cx="907" cy="1260" r="22" fill="#D4AF37" />
  <text x="907" y="1267" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" font-weight="bold" fill="#FFFFFF">3</text>
  <text x="907" y="1312" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#1A1816">03. Saved Automatically</text>
  <text x="907" y="1348" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#6B655B">Photos go straight to the album</text>
  <text x="907" y="1378" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#8C7A5B">Stored privately in full quality</text>

  <!-- Bottom Section: Privacy & Direct URL -->
  <text x="600" y="1495" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#8C7A5B">Photos are saved privately for the couple's album &#x2665;</text>
  <text x="600" y="1535" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="18" fill="#A8A196">${escapeXml(cleanGuestUrl)}</text>
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

  function handleCopyGuestUrl() {
    if (!guestUrl) return;
    navigator.clipboard.writeText(guestUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Controls Header - hidden during print */}
      <div className="print:hidden pb-6 mb-6 sm:mb-8 border-b border-zinc-800/80">
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-400 font-medium">Printables & Stationary</span>
        <h1 className="text-2xl sm:text-3xl font-serif font-normal text-zinc-100 tracking-tight mt-1">QR Code & Vertical A4 Poster</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
          Printable A4 table sign with event QR code and guest instructions.
        </p>
      </div>

      {/* Configuration & Action Bar - hidden during print */}
      <div className="print:hidden p-5 sm:p-6 mb-8 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-5">
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-400 mb-2">
            Event Guest URL (Includes Active Token)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center min-w-0 bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus-within:border-amber-400/60 focus-within:ring-1 focus-within:ring-amber-400/30">
              <span className="truncate">{guestUrl}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyGuestUrl}
              className="h-9 px-3.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedUrl ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-emerald-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-emerald-400 font-sans">Copied</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span className="font-sans">Copy URL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Primary Action Buttons: Complete Poster Downloads & Print */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          <button
            onClick={handleDownloadPosterPng}
            disabled={!qrDataUrl || isGeneratingPng}
            className="w-full h-11 sm:h-9 min-h-[44px] sm:min-h-[36px] px-4 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-400 shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="truncate">{isGeneratingPng ? "Preparing Poster…" : "Download Poster (PNG)"}</span>
          </button>

          <button
            onClick={handleDownloadPosterSvg}
            disabled={!qrDataUrl}
            className="w-full h-11 sm:h-9 min-h-[44px] sm:min-h-[36px] px-4 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-400 shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="truncate">Download Poster (SVG)</span>
          </button>

          <button
            onClick={handlePrint}
            className="w-full h-11 sm:h-9 min-h-[44px] sm:min-h-[36px] px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
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
      <div className="flex justify-center items-center py-6 sm:py-10 px-4 rounded-2xl bg-black/40 border border-white/[0.06] w-full overflow-hidden print-card-wrapper shadow-2xl">
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
