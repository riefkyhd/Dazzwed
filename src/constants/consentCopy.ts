export const CONSENT_VERSION = "2026-10-v1";

export interface ConsentCopy {
  summary: string;
  checkboxAlbum: string;
  checkboxTelemetry: string;
  detailsTitle: string;
  detailsIntro: string;
  controllerTitle: string;
  controllerBody: string;
  purposeTitle: string;
  purposeBody: string;
  typesTitle: string;
  typesBody: string;
  retentionTitle: string;
  retentionBody: string;
  rightsTitle: string;
  rightsBody: string;
}

export const CONSENT_COPY: Record<"en" | "id", ConsentCopy> = {
  en: {
    summary:
      "Welcome! This digital disposable camera lets you take photos to celebrate the wedding. Photos you choose to keep are saved directly to the couple's private wedding album.",
    checkboxAlbum:
      "I agree to take and share photos for the couple's wedding album, and I confirm I am at least 18 years old (or have parent/guardian consent).",
    checkboxTelemetry:
      "Help improve the camera by sharing anonymous error and performance diagnostics (optional).",
    detailsTitle: "Read Full Privacy Notice (Indonesia UU PDP)",
    detailsIntro:
      "In accordance with Indonesia Law No. 27 of 2022 on Personal Data Protection (UU PDP), here is how your data is handled:",
    controllerTitle: "1. Data Controller",
    controllerBody:
      "The wedding hosts (the couple) and the Unveiled application operator act as joint controllers for the purpose of creating the private wedding commemorative album.",
    purposeTitle: "2. Purpose of Collection",
    purposeBody:
      "To provide an authentic disposable camera experience, process film-simulated wedding photos, and compile an online photo album accessible by the couple.",
    typesTitle: "3. Personal Data Collected",
    typesBody:
      "• Captured wedding photos you choose to keep.\n• Optional guest display name.\n• 6-character roll restoration code.\n• Anonymous technical error diagnostics (only if opted in). We do NOT store your IP address or track you across other websites.",
    retentionTitle: "4. Storage & Retention",
    retentionBody:
      "Photos and albums are stored in Google Drive and Supabase. Anonymous diagnostic logs are automatically deleted after 30 days. You may delete your roll at any time.",
    rightsTitle: "5. Your Rights & Erasure",
    rightsBody:
      "You have the right to withdraw consent and delete your film roll at any time using the 'Delete My Roll' option in camera settings, which immediately erases all your photos from the album.",
  },
  id: {
    summary:
      "Selamat datang! Kamera saku digital ini untuk mengabadikan momen pernikahan. Foto yang kamu simpan akan masuk langsung ke album pribadi kedua mempelai.",
    checkboxAlbum:
      "Saya setuju untuk mengambil dan membagikan foto untuk album pernikahan mempelai, serta menyatakan berusia minimal 18 tahun (atau didampingi orang tua/wali).",
    checkboxTelemetry:
      "Bantu tingkatkan kualitas kamera dengan mengirimkan laporan kesalahan & performa anonim (opsional).",
    detailsTitle: "Baca Pemberitahuan Privasi Lengkap (UU PDP)",
    detailsIntro:
      "Sesuai dengan Undang-Undang Republik Indonesia No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP), berikut informasi mengenai pemrosesan data kamu:",
    controllerTitle: "1. Pengendali Data Pribadi",
    controllerBody:
      "Mempelai yang menyelenggarakan acara bersama pengelola aplikasi Unveiled bertindak sebagai pengendali data untuk tujuan pembuatan album kenangan pernikahan.",
    purposeTitle: "2. Tujuan Pemrosesan",
    purposeBody:
      "Menyediakan pengalaman kamera saku analog, memproses foto simulasi roll film, dan menyusun album foto digital yang hanya dapat diakses oleh kedua mempelai.",
    typesTitle: "3. Data yang Diproses",
    typesBody:
      "• Foto pernikahan yang kamu pilih untuk disimpan.\n• Nama panggilan/tampilan tamu (opsional).\n• Kode roll film 6 karakter untuk pemulihan sesi.\n• Diagnostik teknis anonim (hanya jika disetujui). Kami TIDAK menyimpan alamat IP kamu dan tidak melacak kamu di situs web lain.",
    retentionTitle: "4. Masa Retensi & Penyimpanan",
    retentionBody:
      "Foto disimpan di Google Drive dan Supabase. Data diagnostik otomatis dihapus setelah 30 hari. Kamu dapat menghapus seluruh roll foto kamu kapan saja.",
    rightsTitle: "5. Hak & Penghapusan Data",
    rightsBody:
      "Kamu berhak menarik persetujuan dan menghapus seluruh roll foto kapan saja melalui menu 'Hapus Roll Saya' di pengaturan kamera untuk menghapus permanen seluruh foto dari album.",
  },
};
