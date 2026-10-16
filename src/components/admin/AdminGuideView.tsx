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
              v2.4
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
                    ? "Visit `/admin/qr` to print or export the complete A4 signage poster. Click 'Print A4 Poster' for direct 1-page printing with zero dark margins, or click 'Download Poster (PNG)' / 'Download Poster (SVG)' for high-resolution photo-studio files."
                    : "Buka `/admin/qr` untuk mencetak atau mengunduh poster signage A4 lengkap. Klik 'Print A4 Poster' untuk cetak langsung 1 halaman tanpa margin gelap, atau klik 'Download Poster (PNG)' / 'Download Poster (SVG)' untuk file beresolusi tinggi siap cetak."}
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
                  ? "Configures how many exposures each guest can take (typically 15). Once a guest takes their final shot, they are smoothly transitioned to the Thank You screen."
                  : "Menentukan jumlah jepretan yang didapat setiap tamu (standar 15). Setelah jepretan terakhir, tamu diarahkan ke layar ucapan terima kasih."}
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
                ? "Q: Where are the official horizontal Unveiled branding assets used?"
                : "T: Di mana aset logo horizontal resmi Unveiled digunakan?"}
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === "en"
                ? "The official transparent lockup `/Unveiled_logo_horizontal_transparent.png` is used across dark headers (Admin Navbar, Admin Login, Root page) without redundant text, while `/Unveiled_logo_horizontal.png` with warm ivory backing is configured for OpenGraph and Twitter social share cards."
                : "Aset transparan resmi `/Unveiled_logo_horizontal_transparent.png` digunakan pada header gelap (Navbar Admin, Login Admin, Halaman Utama) tanpa teks berulang, sedangkan `/Unveiled_logo_horizontal.png` dengan latar krem gading dikonfigurasi untuk kartu pratinjau media sosial (OpenGraph & Twitter)."}
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
