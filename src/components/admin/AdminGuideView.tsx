"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type GuideLang = "en" | "id";

export function AdminGuideView() {
  const [lang, setLang] = useState<GuideLang>("en");
  const [activeSection, setActiveSection] = useState<"checklist" | "controls" | "faq">("checklist");

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Header & Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
              Host Manual & Best Practices
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
              v2.7
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
            {lang === "en" ? "Unveiled Host & Event Guide" : "Panduan Tuan Rumah & Acara Unveiled"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {lang === "en"
              ? "Everything you need to plan, print, manage, and successfully run analog wedding camera experiences."
              : "Semua panduan untuk merencanakan, mencetak QR, mengelola, dan menjalankan kamera saku pernikahan analog."}
          </p>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center self-start sm:self-center gap-1 p-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
              lang === "en"
                ? "bg-amber-400 text-black font-bold shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("id")}
            className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
              lang === "id"
                ? "bg-amber-400 text-black font-bold shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Bahasa Indonesia
          </button>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex gap-2 border-b border-zinc-800/80 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSection("checklist")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === "checklist"
              ? "bg-amber-400/10 text-amber-300 border border-amber-400/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          {lang === "en" ? "1. Wedding Timeline Checklist" : "1. Panduan Timeline Pernikahan"}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("controls")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === "controls"
              ? "bg-amber-400/10 text-amber-300 border border-amber-400/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          {lang === "en" ? "2. Admin Controls Reference" : "2. Referensi Kontrol Admin"}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("faq")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === "faq"
              ? "bg-amber-400/10 text-amber-300 border border-amber-400/30"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          {lang === "en" ? "3. Guest Experience & FAQ" : "3. Pengalaman Tamu & FAQ"}
        </button>
      </div>

      {/* SECTION 1: TIMELINE CHECKLIST */}
      {activeSection === "checklist" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Phase 1: Pre-Wedding Testing */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center font-bold text-sm">
                1
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-white">
                  {lang === "en" ? "Before the Wedding: Testing & Preparation" : "Sebelum Pernikahan: Uji Coba & Persiapan"}
                </h3>
                <p className="text-xs text-zinc-400">
                  {lang === "en" ? "Test the workflow with your partner or wedding planner" : "Uji coba alur kamera bersama pasangan atau wedding organizer"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-zinc-300 pl-11 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Connect Google Drive:" : "Hubungkan Google Drive:"}</strong>{" "}
                  {lang === "en"
                    ? "Go to `/admin/connect-drive` and authorize the host Google account. This ensures photos sync automatically."
                    : "Buka `/admin/connect-drive` dan otorisasi akun Google Drive mempelai untuk sinkronisasi otomatis."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Test Camera & Color Recipes:" : "Uji Coba Kamera & Resep Film:"}</strong>{" "}
                  {lang === "en"
                    ? "Open the guest link on your phone. Snap a test photo to test the analog film grain and color rendering."
                    : "Buka tautan tamu di ponsel Anda. Ambil beberapa foto percobaan untuk melihat tekstur film analog dan pewarnaan."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold shrink-0">★</span>
                <span className="text-amber-200">
                  <strong>{lang === "en" ? "MANDATORY CLEANUP BEFORE PRINTING:" : "WAJIB BERSIHKAN SEBELUM CETAK:"}</strong>{" "}
                  {lang === "en"
                    ? "Once testing is done, navigate to `/admin/settings`. Click 'Rotate Token & Generate New QR' to generate a fresh token, then click 'Reset All Guest Sessions'. This clears test photos from your device and guarantees a clean start."
                    : "Setelah uji coba selesai, buka `/admin/settings`. Klik 'Rotate Token & Generate New QR' untuk menghasilkan token baru, lalu klik 'Reset All Guest Sessions' agar perangkat uji coba bersih."}
                </span>
              </div>
            </div>
          </div>

          {/* Phase 2: Printing QR Cards */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-amber-500/30 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold text-sm">
                2
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-white">
                  {lang === "en" ? "Printing Table Cards & Signage (/admin/qr)" : "Mencetak Kartu Meja & Signage (/admin/qr)"}
                </h3>
                <p className="text-xs text-amber-300/80">
                  {lang === "en" ? "The most critical operational rule for event hosts" : "Aturan operasional terpenting bagi penyelenggara"}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-zinc-300 pl-11 leading-relaxed">
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200">
                <div className="font-bold flex items-center gap-2 mb-1 text-amber-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                  <span>{lang === "en" ? "CRITICAL RULE: DO NOT ROTATE TOKEN AFTER PRINTING" : "ATURAN KRUSIAL: JANGAN ROTATE TOKEN SETELAH DICETAK"}</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-100">
                  {lang === "en"
                    ? "Once you print physical QR cards or posters, NEVER click 'Rotate Token & Generate New QR'. Rotating the token will change the secret link and permanently invalidate your printed cards! If your wedding runs late and you need to extend the event window, use 'Update Expiration Time' instead."
                    : "Setelah kartu fisik atau poster dicetak, JANGAN PERNAH klik 'Rotate Token & Generate New QR'. Memutar token akan mengubah URL dan membuat kartu cetak Anda tidak berfungsi! Jika acara berlangsung lebih lama dan ingin memperpanjang waktu, gunakan tombol 'Update Expiration Time'."}
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Vertical A4 Portrait Poster:" : "Poster Vertikal A4 Portrait:"}</strong>{" "}
                  {lang === "en"
                    ? "Visit `/admin/qr` to print or export the complete A4 signage poster. Features an enlarged hero QR code (560px / 55% of card width) for effortless scanning from across dinner tables, luxury typography, balanced spacing, and unified vector SVG rendering that guarantees 100% distortion-free 1-page A4 printing (Save as PDF) and 300 DPI high-res PNG export."
                    : "Buka `/admin/qr` untuk mencetak atau mengunduh poster signage A4 lengkap. Dilengkapi kode QR ukuran besar (560px / 55% lebar kartu) agar mudah dipindai tamu dari kejauhan meja, tipografi mewah yang seimbang, serta rendering vektor SVG terpadu yang menjamin cetak 1 halaman A4 (Save as PDF) bebas distorsi dan ekspor PNG resolusi tinggi 300 DPI."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Bare QR Export for Stationery Designers:" : "Ekspor QR Polos untuk Desainer Undangan:"}</strong>{" "}
                  {lang === "en"
                    ? "Download standalone raw QR PNG (1200px) or QR SVG (Vector) if your stationery designer is creating custom wedding cards or bespoke stationery suites."
                    : "Unduh file QR polos PNG (1200px) atau SVG (Vektor) jika desainer undangan Anda ingin merancang kartu meja custom."}
                </span>
              </div>
            </div>
          </div>

          {/* Phase 3: Wedding Day */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center font-bold text-sm">
                3
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-white">
                  {lang === "en" ? "During the Wedding: Guest Operations" : "Hari Pernikahan: Operasional Tamu"}
                </h3>
                <p className="text-xs text-zinc-400">
                  {lang === "en" ? "Frictionless, zero-install guest experience" : "Pengalaman tamu tanpa install aplikasi, tanpa ribet"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-zinc-300 pl-11 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "No App Store Needed:" : "Tanpa Unduh App Store:"}</strong>{" "}
                  {lang === "en"
                    ? "Guests open their phone camera, point it at the QR code on the table, and tap the link."
                    : "Tamu cukup membuka kamera bawaan HP, mengarahkannya ke QR code di meja, dan mengetuk tautan yang muncul."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Offline Resilience on Spotty Wi-Fi:" : "Tahan Sinyal Lemah / Venue Padat:"}</strong>{" "}
                  {lang === "en"
                    ? "Even if the ballroom Wi-Fi drops, photos are securely saved locally on the guest's device in IndexedDB and automatically upload in the background once signal returns."
                    : "Bahkan jika sinyal di gedung terganggu, foto tetap tersimpan aman di memori lokal HP tamu dan otomatis terunggah saat sinyal kembali normal."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "15-Shot Film Limit:" : "Batas 15 Foto per Tamu:"}</strong>{" "}
                  {lang === "en"
                    ? "Each roll is capped at 15 shots (configurable in Settings), creating anticipation and deliberate analog captures."
                    : "Setiap roll dibatasi 15 jepretan (dapat diubah di Settings), menciptakan nostalgia kamera saku sekali pakai."}
                </span>
              </div>
            </div>
          </div>

          {/* Phase 4: Post-Wedding */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center font-bold text-sm">
                4
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-white">
                  {lang === "en" ? "After the Wedding: Receiving Your Memories" : "Setelah Pernikahan: Mengunduh Kenangan"}
                </h3>
                <p className="text-xs text-zinc-400">
                  {lang === "en" ? "Organized Google Drive folders ready for download" : "Folder Google Drive rapi siap diunduh"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-zinc-300 pl-11 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Guest Folders in Google Drive:" : "Folder Tamu di Google Drive:"}</strong>{" "}
                  {lang === "en"
                    ? "Photos are organized into folders labeled `Guest Name (RollCode)` (e.g., `Dhifa (7EGE9X)`). If no name was entered, it is labeled `Roll 7EGE9X`."
                    : "Foto diorganisasi dalam folder bernama `Nama Tamu (KodeRoll)` (contoh: `Dhifa (7EGE9X)`). Jika tamu tidak mengisi nama, folder bernama `Roll 7EGE9X`."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Processed Film + Clean Originals:" : "Hasil Simulasi Film + File Asli:"}</strong>{" "}
                  {lang === "en"
                    ? "Each guest folder contains the film-graded photos plus an `originals/` subfolder with pristine camera captures."
                    : "Setiap folder tamu berisi foto analog yang sudah diproses, plus subfolder `originals/` berisi foto asli kamera tanpa filter."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "One-Click Bulk ZIP Export:" : "Unduh Masal Satu Klik (.ZIP):"}</strong>{" "}
                  {lang === "en"
                    ? "In addition to browsing Google Drive, hosts can click 'Download All (.ZIP)' in the admin gallery (/admin/photos) or dashboard to download all event photos directly to their laptop, organized into Film/ and Original/ subfolders."
                    : "Selain membuka Google Drive, tuan rumah dapat mengklik 'Download All (.ZIP)' di galeri admin (/admin/photos) atau dasbor untuk mengunduh semua foto acara langsung ke laptop, tersusun rapi dalam subfolder Film/ dan Original/."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>{lang === "en" ? "Automatic 30-Day Cleanup:" : "Pembersihan Otomatis 30 Hari:"}</strong>{" "}
                  {lang === "en"
                    ? "Anonymous telemetry logs and security rate-limits are automatically purged after 30 days to protect guest privacy under UU PDP."
                    : "Log telemetri anonim dan data keamanan otomatis dibersihkan setelah 30 hari sesuai ketentuan UU Pelindungan Data Pribadi (UU PDP)."}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CONTROLS REFERENCE */}
      {activeSection === "controls" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Control 1: Link Duration */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Link Duration & Access Window" : "Durasi Tautan & Jendela Akses"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Controls how long the QR code remains active. Presets include 24 Hours (1 Day), 48 Hours (2 Days), 72 Hours (3 Days), 7 Days, or a Custom Date/Time picker."
                  : "Mengatur berapa lama QR code dapat diakses. Pilihan preset meliputi 24 Jam (1 Hari), 48 Jam (2 Hari), 72 Jam (3 Hari), 7 Hari, atau pemilih Tanggal/Waktu Kustom."}
              </p>
            </div>

            {/* Control 2: Update Expiration vs Rotate */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Update Time vs. Rotate Token" : "Perpanjang Waktu vs. Putar Token"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "'Update Expiration Time' extends the link duration WITHOUT changing the QR code (safe after printing). 'Rotate Token' creates a brand-new QR code and kills the previous one (use ONLY before printing!)."
                  : "'Update Expiration Time' memperpanjang batas waktu TANPA mengubah QR code (aman setelah dicetak). 'Rotate Token' membuat kode baru dan mematikan kode lama (HANYA gunakan sebelum cetak!)."}
              </p>
            </div>

            {/* Control 3: Shots Per Guest */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Shots Per Guest (Roll Limit)" : "Batas Jepretan per Tamu"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Configures how many exposures each guest can take (e.g. 15 or 30). Changes sync in real time to all guests' active screens within seconds, automatically updating the remaining shot counter, displaying a roll extension toast, and reopening the camera for guests who had already finished."
                  : "Menentukan jumlah jepretan yang didapat setiap tamu (misal 15 atau 30). Perubahan tersinkronisasi otomatis secara real time ke layar tamu dalam beberapa detik, memperbarui sisa jepretan, menampilkan notifikasi perpanjangan rol, dan membuka kembali kamera bagi tamu yang sudah selesai."}
              </p>
            </div>

            {/* Control 4: Reset All Guest Sessions */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Reset All Guest Sessions" : "Reset Semua Sesi Tamu"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Grants every guest an additional fresh roll (15 shots) on their next visit, while keeping all previously uploaded photos 100% safe in Google Drive and Supabase."
                  : "Memberikan seluruh tamu roll film baru (15 jepretan) saat membuka kembali kamera, tanpa menghapus foto-foto sebelumnya yang sudah tersimpan aman."}
              </p>
            </div>

            {/* Control 5: Guest Camera Preview */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Guest Camera Preview" : "Pratinjau Kamera Tamu"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "The 'Guest Camera' button on the dashboard automatically includes the current cryptographic token (?t=<token>) so hosts can directly test and experience what guests see."
                  : "Tombol 'Guest Camera' pada dasbor secara otomatis menyertakan token kriptografis aktif (?t=<token>) agar tuan rumah dapat langsung menguji tampilan kamera tamu."}
              </p>
            </div>

            {/* Control 6: In-App Editorial Gallery & Lightbox */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "In-App Editorial Gallery & Lightbox" : "Galeri Editorial & Lightbox Admin"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Browse wedding photos in Retina clarity directly in the admin panel (/admin/photos and /admin/guests). Switch between contact-sheet Editorial Gallery and Guest Rolls Table, filter with sleek horizontal recipe pills and guest dropdowns, and open the full-screen React Portal lightbox with touch swipe navigation, background scroll-lock, and Film Graded vs. RAW Sensor Original comparison. Features strict aspect-ratio containment (w-full h-full min-h-0 min-w-0 with object-contain) across widescreen desktop, tablet, and mobile orientations so 3:4 portrait photos are never vertically cropped or zoomed in. Includes click-outside backdrop dismissal, automatic Crockford Base32 roll code resolution, and resilient dark-room fallback cards if a photo was removed or deleted from Google Drive."
                  : "Jelajahi foto pernikahan dengan kejernihan Retina langsung di panel admin (/admin/photos dan /admin/guests). Beralih antara Galeri Editorial kontak-sheet dan Tabel Rol Tamu, filter dengan deretan pil resep film horizontal yang rapi, dan buka lightbox React Portal layar penuh dengan gestur geser (swipe), penguncian scroll latar belakang, serta perbandingan tampilan Film Graded vs Sensor RAW Asli. Dilengkapi penahanan rasio aspek presisi (w-full h-full min-h-0 min-w-0 dengan object-contain) di layar desktop lebar, tablet, maupun ponsel agar foto potret 3:4 tidak terpotong atau ter-zoom secara paksa. Termasuk fitur klik luar latar untuk menutup, resolusi kode rol Crockford Base32 otomatis, dan kartu pengganti kamar gelap yang anggun jika file foto telah dihapus dari Google Drive."}
              </p>
            </div>

            {/* Control 7: Zero-Overhead Product & Filter Analytics */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Zero-Overhead Product & Filter Analytics" : "Analitik Resep Film & Keterlibatan Tamu"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Live aggregate insights (/admin/health) with 0ms added guest latency and 100% UU PDP compliance. View the film recipes leaderboard (kept vs. retakes), guest shooting conversion funnel (consents → active shooters → completed rolls), and camera capture engine reliability."
                  : "Wawasan analitik langsung (/admin/health) dengan 0ms latensi tambahan pada kamera tamu dan 100% kepatuhan UU PDP. Pantau papan peringkat resep film terpopuler, funnel keterlibatan tamu (izin → pemotret aktif → rol tuntas), dan keandalan mesin kamera."}
              </p>
            </div>

            {/* Control 8: Instant 0ms Navigation & Streaming Skeletons */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Instant 0ms Navigation & Dark-Room Skeletons" : "Navigasi Instan 0ms & Kerangka Kamar Gelap"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Every menu tab click switches URLs in 0ms with Next.js link prefetching and optimistic active tab highlighting. Tailored dark-room pulse skeletons render immediately across all admin routes and the guest camera entry while database queries execute in parallel, eliminating perceived loading latency and white-flash."
                  : "Setiap klik tab menu berpindah URL dalam 0ms dengan prefetching Next.js dan penandaan tab aktif optimistik. Kerangka animasi kamar gelap langsung tampil di semua rute admin dan pintu masuk kamera tamu saat data diproses secara paralel, menghilangkan jeda muat dan kilatan layar putih."}
              </p>
            </div>

            {/* Control 9: Calibrated Editorial & Fine-Art Film Recipes */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Editorial & Fine-Art Film Emulations" : "Emulasi Film Editorial & Seni Halus"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Hosts can select from 20 calibrated recipes in /admin/settings or let guests dial on camera: Editorial Flash (high-fashion Vogue direct flash with pure obsidian blacks), Airy Romantic 400H (Fuji Pro 400H pastel mint greens and ethereal bridal lace bloom), Warm Vintage Heritage (destination golden-amber warmth, honey skin, and chocolate shadows), Retro 90s Flash (compact point-and-shoot xenon flash falloff with chartreuse and mustard pop), Classic Chrome (documentary Kodachrome 64 teal sky), and Reala Ace 100 (4th-layer cyan faithful fidelity)."
                  : "Tuan rumah dapat memilih dari 20 resep terkalibrasi di /admin/settings atau membiarkan tamu memilih di kamera: Editorial Flash (kilat langsung mode Vogue dengan hitam obsidian pekat), Airy Romantic 400H (hijau mint pastel Fuji Pro 400H dan pendaran renda gaun pengantin), Warm Vintage Heritage (kehangatan emas destinasi, kulit madu, dan bayangan cokelat), Retro 90s Flash (jatuhnya kilat xenon kamera saku 90-an dengan warna chartreuse dan mustard), Classic Chrome (langit teal Kodachrome 64 dokumenter), dan Reala Ace 100 (ketelitian warna alami lapisan sian ke-4)."}
              </p>
            </div>

            {/* Control 10: Google Pixel 10 Self-Timer Cadence & Instant Settings Invalidation */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Google Pixel 10 Self-Timer (3s / 5s / 10s) & Instant Settings Sync" : "Self-Timer Google Pixel 10 (3d / 5d / 10d) & Sinkronisasi Pengaturan Instan"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Camera self-timer cycles cleanly through Off (0s) -> 3s -> 5s -> 10s -> Off (0s). To guarantee an unobstructed, distraction-free view while framing, countdown numbers and the animated circular progress sweep are rendered strictly inside the bottom tactile Shutter Button, leaving the camera viewfinder 100% clean. The countdown features the authentic Google Pixel 10 cadence: 1 sustained beat/sec (>3s), 2 double-time fast beats/sec (3s & 2s), and a steady final beat on 1s with audible ticks and gentle haptics. Hardware torch pulsing is intentionally omitted during the countdown to protect subject eyes from 100% saturation glare, reserving the physical LED flash exclusively for the moment of actual photo capture at 0s when Flash is toggled ON. When editing event descriptions, couple names, or limits in /admin/settings, multi-layer cache invalidation guarantees /admin/qr and A4 posters reflect changes in 0ms without requiring browser refreshes."
                  : "Self-timer kamera berpindah mulus melalui Mati (0d) -> 3d -> 5d -> 10d -> Mati (0d). Untuk menjamin tampilan jendela bidik yang bersih dan bebas halangan saat membidik, angka hitung mundur dan animasi cincin progres melingkar ditampilkan khusus di dalam Tombol Rana taktil di bagian bawah. Irama hitung mundur mengadopsi ketukan Google Pixel 10: 1 ketukan/detik (>3d), 2 detak cepat/detik (3d & 2d), dan ketukan mantap pada detik terakhir (1d) disertai audio dan haptik halus. Lampu kilat perangkat keras sengaja tidak dinyalakan selama hitungan mundur agar tidak menyilaukan mata subjek, dan khusus dicadangkan untuk momen jepretan foto sebenarnya pada 0d saat Flash diaktifkan. Saat mengubah deskripsi, nama pasangan, atau kuota di /admin/settings, pembersihan cache memastikan /admin/qr dan poster A4 diperbarui dalam 0ms tanpa perlu muat ulang peramban."}
              </p>
            </div>

            {/* Control 11: Flash Intensity Management & Zero-Lag Instant Capture */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Flash Intensity (Soft Fill vs Standard) & Zero-Lag Shutter" : "Intensitas Lampu Kilat (Soft Fill vs Standar) & Jepretan Tanpa Jeda"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Guests can select between 'Soft Fill' (gentle warm fill light with automatic highlight-protecting negative EV offset on rear camera, and soft 65% warm-ivory screen glow on front camera to prevent washed-out faces) and 'Standard' full-power direct flash. Shutter latency is optimized with 0ms cooldown overhead, snapping illuminated frames cleanly and instantly."
                  : "Tamu dapat memilih antara 'Alami / Soft Fill' (cahaya pengisi lembut dengan perlindungan highlight kompensasi pencahayaan negatif otomatis pada kamera belakang, dan pendaran layar gading hangat 65% pada kamera depan agar wajah tidak overexposed) dan 'Standar' lampu kilat langsung daya penuh. Latensi rana dioptimalkan tanpa jeda buatan, memotret seketika dan responsif."}
              </p>
            </div>

            {/* Control 12: Deterministic Flash Sync, Single-Step Capture & Godox Strobe Aesthetic */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Deterministic Flash Sync, Single-Step Capture & Godox Xenon Strobe" : "Sinkronisasi Kilat Deterministik, Transisi 1-Langkah & Estetika Godox Xenon"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Flash illumination operates with a frame-verified convergence state machine: the LED torch is energized with atomic -0.5 EV negative exposure bias, enforces a 240ms hardware warmup floor until frame luminance stabilizes, and holds full power until pixel readout completes (+ 60ms guard tick), eliminating missed flashes and dark frames. Shutter transitions are unified into a single mechanical curtain: the review modal mounts directly with the 100% developed photo (zero preview swapping or color popping). Photos taken with flash receive a dedicated 'Godox Xenon Strobe' grading pass featuring inverse-square radial falloff (cx=0.50, cy=0.46), soft-knee highlight roll-off (luma > 0.78), 5600K xenon daylight balance, and specular jewelry halation, while clean original un-graded captures remain preserved for the admin comparison toggle."
                  : "Pencahayaan lampu kilat beroperasi dengan mesin status konvergensi terverifikasi bingkai: lampu LED dinyalakan dengan bias pencahayaan negatif -0.5 EV atomik, menerapkan ambang pemanasan perangkat keras 240ms hingga luminansi stabil, dan mempertahankan daya penuh hingga pembacaan piksel tuntas (+ 60ms tick pengaman), mencegah kilat terlewat atau foto gelap. Transisi rana disatukan dalam tirai mekanis tunggal: modal pratinjau langsung menampilkan foto matang 100% (tanpa pergantian gambar kasar atau loncatan warna). Foto dengan kilat mendapat polesan 'Godox Xenon Strobe' dengan jatuhnya cahaya kuadrat-terbalik (cx=0.50, cy=0.46), roll-off highlight lembut (luma > 0.78), keseimbangan siang hari xenon 5600K, dan pendaran kilau perhiasan, sementara foto asli tanpa polesan tetap tersimpan rapi untuk tombol perbandingan admin."}
              </p>
            </div>

            {/* Control 13: Native Gravity-Based Icon Rotation & Zero Layout Reflow */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Native Gravity-Based Icon Rotation & Zero Layout Reflow" : "Rotasi Ikon Berbasis Gravitasi Alami & Nol Perubahan Tata Letak"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Behaving exactly like native iOS and Android flagship camera apps, Dazzwed tracks physical phone tilt in real time using the hardware accelerometer/gravity vector (DeviceMotionEvent with 200ms deadzone hysteresis)—functioning seamlessly even when the guest's phone has OS Portrait Orientation Lock enabled. Device platform detection strictly discriminates Android from iOS (preventing modern Android Chrome's DeviceMotionEvent.requestPermission API from triggering false iOS flags) so Android directly receives pure W3C vectors while iOS Safari (iPhone 13+) automatically normalizes CoreMotion's inverted coordinate signs (-1x multiplier) to standard W3C frame coordinates. As a result, Landscape Left (90°) and Landscape Right (-90°) orient with exact upright precision across every smartphone model. Motion permissions are requested via Safari-compliant user clicks (on Landing Screen start, first screen tap, or dedicated camera pill) without throwing WebKit NotAllowedError. To prevent WebKit GPU process crashes and black photos on iOS, camera frames are snapshot synchronously from live video before freezing, archival maxEdge is safely clamped to 1920px, and all temporary canvas buffers are deallocated immediately upon render. The camera viewport structure, top bar, viewfinder, and bottom shutter dock never reflow or rearrange into side rails. Instead, only the individual icon glyphs and text labels pivot smoothly in place (300ms cubic-bezier(0.22, 1, 0.36, 1)) on top bar action buttons, 0.5x-3x lens numbers inside stationary circular pills, film roll badges, flip camera icons, and countdown numbers. In the Review Modal, action buttons ('Retake' & 'Keep Photo') always follow their horizontal bottom container without rotating, ensuring clean typography and optimal touch targets. The tactile shutter curtain stays closed during the brief archival development and opens seamlessly with the final photo, guaranteeing zero unrotated preview jumps. Photos captured while held horizontally are rendered and developed in true archival landscape dimensions (4:3 or 16:9, width > height) with the analog date stamp anchored to the true bottom-right corner."
                  : "Berperilaku persis seperti aplikasi kamera bawaan iOS dan Android flagship, Dazzwed melacak kemiringan fisik ponsel secara real-time menggunakan akselerometer/vektor gravitasi perangkat keras (DeviceMotionEvent dengan histeresis deadzone 200ms)—berfungsi sempurna bahkan ketika kunci orientasi potret HP tamu aktif. Deteksi platform secara ketat membedakan Android dari iOS (mencegah API DeviceMotionEvent.requestPermission pada Chrome Android modern salah terdeteksi sebagai iOS) sehingga Android langsung menerima vektor W3C murni tanpa pembalikan tanda sementara iOS Safari (iPhone 13+) otomatis menormalisasi tanda koordinat terbalik CoreMotion (pengali -1x) ke kerangka standar W3C. Hasilnya, Lanskap Kiri (90°) dan Lanskap Kanan (-90°) terorientasi tegak lurus sempurna di seluruh model smartphone. Izin sensor gerak diminta melalui interaksi klik pengguna yang patuh standar Safari (saat tombol mulai di Landing Screen ditekan, ketukan pertama layar kamera, atau pil bantuan rotasi) tanpa memicu error WebKit NotAllowedError. Untuk mencegah crash memori GPU WebKit dan foto hitam di iOS, frame kamera di-snapshot secara sinkron dari video langsung sebelum dibekukan, maxEdge arsip dibatasi aman pada 1920px, dan semua buffer kanvas sementara segera dibebaskan setelah render. Struktur tata letak kamera, bilah atas, jendela bidik, dan dok rana bawah tidak pernah bergeser atau berubah posisi menjadi rel samping. Sebaliknya, hanya glif ikon dan label teks individual yang berputar mulus di tempat (300ms cubic-bezier(0.22, 1, 0.36, 1)) pada tombol bilah atas, angka lensa 0.5x-3x di dalam pil melingkar yang tetap stasioner, lencana rol film, ikon putar kamera, dan angka hitung mundur. Pada Modal Pratinjau, tombol aksi ('Ulangi' & 'Simpan Foto') selalu mengikuti wadah horizontal bawahnya tanpa berputar, memastikan tipografi yang rapi dan target sentuh optimal. Tirai rana taktil tetap tertutup selama proses pengembangan foto singkat dan terbuka langsung menampilkan foto final, menjamin ketiadaan lompatan pratinjau yang belum terotasi. Foto yang diambil saat ponsel dimiringkan horizontal diproses dan disimpan dalam dimensi lanskap murni (4:3 atau 16:9, lebar > tinggi) dengan cap tanggal analog di sudut kanan bawah lanskap sebenarnya."}
              </p>
            </div>

            {/* Control 14: Bulk Photo Export (.ZIP) */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Bulk Photo Export (.ZIP)" : "Unduh Masal Semua Foto (.ZIP)"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Download all high-resolution event captures as a single structured .ZIP archive with one click (/admin/photos and /admin dashboard quick action). Powered by a zero-timeout in-browser PKZIP STORE engine (Method 0) that avoids serverless function timeouts. Offers two folder categorization structures: 'Per Guest Folders' (Google Drive style where unzipping organizes photos into Name (RollCode)/ folders with an originals/ subfolder) and 'By Variant' (grouped into Film/ and Original/ folders). Select between Film Developed photos (analog recipes, grain & date stamps), Clean RAW Sensor Originals, or Both. Includes live progress tracking, bounded concurrency (4 parallel workers) to prevent Google Drive rate limits, graceful fail-soft skipping on deleted files, and a responsive Cancel button."
                  : "Unduh seluruh foto acara resolusi penuh dalam satu arsip .ZIP terstruktur hanya dengan satu klik (dari /admin/photos atau tombol aksi cepat dasbor /admin). Didukung oleh mesin PKZIP STORE (Metode 0) langsung di peramban yang bebas batas waktu serverless (zero-timeout). Menyediakan dua struktur kategorisasi folder: 'Folder Per Tamu' (gaya Google Drive di mana hasil ekstrak tersusun dalam folder Nama (KodeRoll)/ dengan subfolder originals/) dan 'Berdasarkan Varian' (dikelompokkan dalam folder Film/ dan Original/). Pilih antara foto Film Developed (resep analog, grain & date stamp), Foto Asli Sensor RAW, atau Keduanya. Dilengkapi pemantau progres langsung, batas konkurensi (4 pekerja paralel) untuk mencegah batas kuota Google Drive, penanganan fail-soft jika ada file yang dihapus, serta tombol Batal yang responsif."}
              </p>
            </div>

            {/* Control 15: Multi-Event SaaS Isolation, Event Switcher & Anti-Tamper Quota Locks */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {lang === "en" ? "Multi-Event SaaS Isolation & Quota Locks" : "Isolasi Multi-Acara SaaS & Kunci Kuota"}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === "en"
                  ? "Host multiple weddings and celebrations simultaneously with complete data isolation. Use the Event Switcher dropdown in the top navigation bar to seamlessly switch between events or create a new event. Each event has its own independent QR link, rotating cryptographic access token (?t=<token>), dedicated Google Drive folder structure, guest rolls, and photo gallery. Features formal lifecycle management (Active, Paused for intermission, or Archived) and server-side package quota locks (Pocket Roll, Classic 35mm, Grand Archive, or Owner Unlimited) that prevent guest counts and shots per roll from exceeding purchased package entitlements."
                  : "Kelola berbagai acara pernikahan dan perayaan sekaligus dengan isolasi data yang menyeluruh. Gunakan dropdown Event Switcher di bilah navigasi atas untuk berpindah acara atau membuat acara baru dengan mudah. Setiap acara memiliki tautan QR mandiri, token akses kriptografis berputar (?t=<token>), struktur folder Google Drive khusus, rol tamu, dan galeri foto terpisah. Dilengkapi manajemen siklus acara (Aktif, Dijeda untuk istirahat, atau Diarsipkan) serta kunci kuota paket di sisi server (Pocket Roll, Classic 35mm, Grand Archive, atau Owner Unlimited) yang memastikan batas tamu dan jepretan per rol tidak melampaui paket yang disewa."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: FAQ & TROUBLESHOOTING */}
      {activeSection === "faq" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: What happens if a guest closes the browser or loses internet connection?"
                : "T: Apa yang terjadi jika tamu menutup browser atau kehilangan koneksi internet?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "Photos are stored immediately in local IndexedDB storage on the guest's device. When they reopen the page or reconnect to Wi-Fi, the background sync worker automatically resumes uploading any pending photos to Google Drive."
                : "Foto disimpan seketika di penyimpanan IndexedDB lokal di HP tamu. Saat mereka membuka kembali halaman atau terhubung ke internet, sinkronisasi latar belakang otomatis mengunggah foto ke Google Drive."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: How does a guest recover their roll if they switch tabs or devices?"
                : "T: Bagaimana cara tamu melanjutkan roll film jika berpindah tab atau perangkat?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "Every guest is assigned a unique 6-character Film Code (e.g., D47PG8) shown in the camera settings sheet. On the landing screen, they can tap 'Continue my roll', enter their code, and resume shooting right where they left off."
                : "Setiap tamu memiliki Kode Roll 6-karakter unik (contoh: D47PG8) yang tercantum di menu pengaturan kamera. Di halaman depan, mereka dapat mengetuk 'Lanjutkan roll film saya', memasukkan kode tersebut, dan langsung melanjutkan jepretan."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: How does privacy and photo erasure work under UU PDP?"
                : "T: Bagaimana perlindungan privasi dan penghapusan data bekerja sesuai UU PDP?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "Zero cookies or storage are written before explicit consent is granted. GPS metadata and EXIF locations are stripped on capture. If a guest exercises their legal Right to Erasure, they can tap 'Withdraw consent & delete my roll' at any time: on the landing screen, inside the in-camera 3-dots settings sheet ('Privacy & data rights'), or on the final thank-you screen. This permanently removes all their photos from Google Drive and Supabase, and wipes local device storage."
                : "Tidak ada cookie atau data yang disimpan sebelum tamu menyetujui izin. Metadata lokasi GPS dihapus otomatis saat pengambilan foto. Jika tamu ingin menghapus data mereka, opsi 'Tarik persetujuan & hapus rol' dapat diakses kapan saja: di halaman depan, di dalam menu 3-titik kamera ('Hak privasi & data'), atau di layar penutup terima kasih. Tindakan ini menghapus permanen seluruh foto dari Google Drive dan Supabase, serta membersihkan penyimpanan perangkat."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: A guest's phone shows 'Camera permission denied'. How do they fix it?"
                : "T: Ponsel tamu menampilkan 'Izin kamera ditolak'. Bagaimana mengatasinya?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "In Safari (iPhone): Tap the 'aA' or page settings icon on the left of the address bar -> Website Settings -> Camera -> Allow. In Chrome (Android): Tap the lock icon or tune icon beside the URL -> Permissions -> Camera -> Allow, then refresh the page. Alternatively, they can tap 'Use my phone's camera app' to upload photos via the native camera."
                : "Di Safari (iPhone): Ketuk ikon 'aA' di bilah alamat -> Pengaturan Situs Web -> Kamera -> Izinkan. Di Chrome (Android): Ketuk ikon gembok di samping URL -> Izin -> Kamera -> Izinkan, lalu muat ulang halaman. Tamu juga dapat memilih opsi 'Gunakan kamera bawaan HP' untuk mengambil foto langsung."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: How do the 0.5x / 1x / 2x / 3x multi-lens zoom controls work across different smartphones?"
                : "T: Bagaimana kontrol multi-lensa 0.5x / 1x / 2x / 3x bekerja di berbagai jenis ponsel pintar?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "Unveiled features universal hardware multi-lens zoom. On Android multi-camera devices (like Samsung Galaxy S23 FE), the engine classifies physical Camera2 sensors: 0.5x opens the true Ultra-Wide optical lens (camera2 2), 1x binds to the Primary Wide sensor (camera2 0) with autofocus and LED flash, and 2x/3x use hardware zoom or telephoto (camera2 3). On Google Pixel and iPhone, it seamlessly bridges unified track zoom and multi-sensor switching. To ensure a flawless user experience when switching between front and back cameras (especially on iPhone 13), Dazzwed maintains a persistent module-level lens cache and synchronizes UI mounting with the confirmed hardware sensor state (actualFacing). This completely eliminates the jarring pop-in where the toggle briefly rendered 1x-3x before snapping 0.5x into place."
                : "Unveiled dilengkapi sistem multi-lensa perangkat keras universal. Pada ponsel Android multi-kamera (seperti Samsung Galaxy S23 FE), sistem memetakan sensor Camera2 fisik: 0.5x menggunakan lensa Ultra-Wide optik asli (camera2 2), 1x menggunakan sensor Primary Wide (camera2 0) lengkap dengan autofokus dan lampu kilat, serta 2x/3x memanfaatkan zoom perangkat keras atau telefoto (camera2 3). Pada Google Pixel dan iPhone, sistem menyatukan zoom trek dan peralihan multi-sensor secara mulus. Untuk memastikan kenyamanan visual saat berganti antara kamera depan dan belakang (khususnya di iPhone 13), Dazzwed menerapkan cache multi-lensa persisten dan sinkronisasi hardware (actualFacing). Hal ini sepenuhnya meniadakan jeda pop-in di mana tombol sempat menampilkan 1x-3x sebelum 0.5x muncul tiba-tiba."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: How does Unveiled prevent photo loss on iPhones (e.g. iPhone 13 / 15)?"
                : "T: Bagaimana Unveiled mencegah foto hilang pada pengguna iPhone (mis. iPhone 13 / 15)?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "On iOS WebKit (including iPhone 13 / 15), canvases risk hitting memory thresholds and offscreen video texture extraction can produce blank/black frames. Unveiled safeguards Safari captures by enabling preserveDrawingBuffer on the active in-DOM WebGL viewfinder, taking synchronous hardware snapshots at shutter tap, clamping render dimensions to a safe 2560px edge, using WebGL-aware pixel inspection to detect blank frames, auto-recovering from the verified review preview if needed, and storing photos via binary ArrayBuffer in IndexedDB to eliminate WebKit DataCloneError."
                : "Pada iOS WebKit (termasuk iPhone 13 / 15), kanvas resolusi tinggi rentan terkena batas memori Safari dan ekstraksi tekstur video offscreen dapat menghasilkan frame hitam. Unveiled mengamankan pengambilan foto dengan mengaktifkan preserveDrawingBuffer pada kanvas WebGL aktif di DOM, mengambil cuplikan hardware sinkron saat tombol ditekan, membatasi dimensi kanvas ke batas aman 2560px, inspeksi piksel berbasis WebGL untuk deteksi frame hitam, pemulihan otomatis dari pratinjau review, serta menyimpan foto sebagai ArrayBuffer biner di IndexedDB."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: Why do some photos have date stamps while others do not?"
                : "T: Mengapa sebagian foto memiliki cap tanggal (timestamp) dan sebagian tidak?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "This is an authentic analog film feature! Consumer point-and-shoot emulsions (Disposable 400, Digicam CCD Flash, Retro 90s Flash, Rangefinder 35, Warm Portrait 400, Tungsten 800T, Panchromatic B&W 400, Mono Street 400, Super 8mm, Vivid 100) emulate vintage compact cameras with a quartz LCD databack stamped onto the negative. Professional SLR, documentary, fine-art, and motion picture recipes (Editorial Flash, Airy Romantic 400H, Warm Vintage Heritage, Classic Chrome, Reala Ace 100, Classic Neg 400, Golden 200, Instant Square, Cinema 250D, Neutral) and untouched RAW sensor originals do not burn date stamps by design."
                : "Ini adalah fitur autentik kamera analog! Emulsi kamera saku konsumen (Disposable 400, Digicam CCD Flash, Retro 90s Flash, Rangefinder 35, Warm Portrait 400, Tungsten 800T, Panchromatic B&W 400, Mono Street 400, Super 8mm, Vivid 100) menyimulasikan cap tanggal quartz LCD khas kamera saku 90-an/2000-an. Resep SLR profesional, dokumenter, seni rupa, dan sinema (Editorial Flash, Airy Romantic 400H, Warm Vintage Heritage, Classic Chrome, Reala Ace 100, Classic Neg 400, Golden 200, Instant Square, Cinema 250D, Neutral), serta hasil tangkapan sensor RAW asli tidak menyematkan cap tanggal."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: How does the admin gallery handle fast concurrent photo browsing and image loading?"
                : "T: Bagaimana galeri admin menangani pemuatan foto cepat secara serentak?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "Dazzwed uses in-memory token deduplication and caching for Google OAuth access tokens (50-minute TTL) and event tokens (5-minute TTL). When opening a gallery with dozens of photos, all thumbnail requests share a single warm bearer token instead of firing duplicate token refreshes to Google, eliminating OAuth 429 rate limits. In addition, the gallery includes automatic transient error retries, clean unmounted progressive Lightbox rendering to eliminate low-res ghosting overlays, and full aspect-ratio viewport containment preventing 3:4 portrait or landscape photos from being vertically clipped or zoomed-in."
                : "Dazzwed menerapkan deduplikasi dan caching token Google OAuth dalam memori (TTL 50 menit) serta token acara (TTL 5 menit). Saat membuka galeri dengan puluhan foto sekaligus, seluruh permintaan thumbnail berbagi token aktif yang sama tanpa membebani Google dengan refresh token berulang, mencegah error batas frekuensi OAuth 429. Selain itu, kartu foto dilengkapi pemulihan otomatis jika terjadi gangguan jaringan sesaat, Lightbox progresif bersih tanpa efek tumpang tindih bayangan, serta penahanan rasio aspek viewport penuh yang mencegah foto potret 3:4 atau lanskap terpotong secara vertikal atau tampak ter-zoom."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: Where are the official horizontal Unveiled branding assets used?"
                : "T: Di mana aset logo horizontal resmi Unveiled digunakan?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "The official transparent lockup `/Unveiled_logo_horizontal_transparent.png` is used across dark headers (Admin Navbar, Admin Login, Root page) without redundant text, while `/Unveiled_logo_horizontal.png` with warm ivory backing is configured for OpenGraph and Twitter social share cards."
                : "Aset transparan resmi `/Unveiled_logo_horizontal_transparent.png` digunakan pada header gelap (Navbar Admin, Login Admin, Halaman Utama) tanpa teks berulang, sedangkan `/Unveiled_logo_horizontal.png` dengan latar krem gading dikonfigurasi untuk kartu pratinjau media sosial (OpenGraph & Twitter)."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h4 className="text-sm font-bold text-white">
              {lang === "en"
                ? "Q: How does Dazzwed ensure front camera selfies and rear camera photos in landscape are always saved right-side up?"
                : "T: Bagaimana Dazzwed memastikan swafoto kamera depan dan foto kamera belakang dalam mode lanskap selalu tersimpan tegak (tidak terbalik)?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "On mobile smartphones (iOS & Android), the front camera sensor is mounted facing the user, opposite the rear camera. When holding the phone in landscape, Dazzwed's WebGL shader Look Engine (`mapCropUv`) uses dedicated physical sensor coordinate transforms: front-facing selfies map the user's head directly to the top edge without vertical inversion in both Landscape Left (90°) and Landscape Right (-90°), while maintaining natural mirror symmetry and keeping rear camera captures 100% upright."
                : "Pada ponsel pintar (iOS & Android), sensor kamera depan menghadap pengguna, berlawanan dengan kamera belakang. Saat memegang ponsel secara lanskap, mesin shader WebGL Dazzwed (`mapCropUv`) menerapkan transformasi koordinat sensor fisik khusus: swafoto kamera depan memetakan kepala pengguna langsung ke tepi atas tanpa pembalikan vertikal baik di Lanskap Kiri (90°) maupun Lanskap Kanan (-90°), sambil mempertahankan simetri cermin alami dan menjaga foto kamera belakang tetap 100% tegak lurus."}
            </p>
          </div>
        </div>
      )}

      {/* Quick Action Footer */}
      <div className="pt-6 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/qr"
            className="px-4 py-2 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-all shadow-md"
          >
            {lang === "en" ? "Go to QR & Print (A4 Poster)" : "Buka QR & Cetak (Poster A4)"}
          </Link>
          <Link
            href="/admin/settings"
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-semibold hover:bg-zinc-800 transition-all"
          >
            {lang === "en" ? "Event Settings" : "Pengaturan Acara"}
          </Link>
        </div>

        <div className="text-[11px] font-mono text-zinc-500">
          Unveiled Platform • Engineered for Moments That Matter
        </div>
      </div>
    </div>
  );
}
