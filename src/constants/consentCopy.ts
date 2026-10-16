export const CONSENT_VERSION = "2026-10-v1";

export interface ConsentCopy {
  summary: string;
  editorialSubtitle: string;
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
  withdrawAction: string;
  withdrawConfirm: string;
  withdrawSuccess: string;
}

export const CONSENT_COPY: Record<"en" | "id", ConsentCopy> = {
  en: {
    summary:
      "Snap moments for the couple's private wedding album.",
    editorialSubtitle:
      "Snap moments for the couple's private wedding album.",
    checkboxAlbum:
      "I agree to share my photos with the couple and confirm I am 18+ (or have parent/guardian permission).",
    checkboxTelemetry:
      "Share anonymous error logs to help keep the camera smooth (optional)",
    detailsTitle: "Privacy & data notice (Indonesia UU PDP)",
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
      "• Captured wedding photos you choose to keep.\n• Optional guest display name.\n• 6-character roll restoration code.\n• Anonymous technical error diagnostics (only if opted in).\n• Anonymous aggregate film recipe preference counts (zero individual tracking). We do NOT store your IP address or track you across other websites.",
    retentionTitle: "4. Storage & Retention",
    retentionBody:
      "Photos and albums are stored in Google Drive and Supabase. Anonymous diagnostic logs are automatically deleted after 30 days. You may delete your roll at any time.",
    rightsTitle: "5. Your Rights & Erasure",
    rightsBody:
      "You have the right to withdraw consent and delete your film roll at any time, which permanently erases all your photos from Google Drive, the server, and this device.",
    withdrawAction: "Withdraw consent & delete my roll",
    withdrawConfirm: "Are you sure? This permanently erases all photos from your roll in Google Drive, the database, and this device.",
    withdrawSuccess: "Your roll and photos have been permanently deleted.",
  },
  id: {
    summary:
      "Abadikan momen untuk album pernikahan pribadi mempelai.",
    editorialSubtitle:
      "Abadikan momen untuk album pernikahan pribadi mempelai.",
    checkboxAlbum:
      "Saya setuju membagikan foto ke mempelai & menyatakan berusia 18+ (atau seizin orang tua/wali).",
    checkboxTelemetry:
      "Kirim laporan galat anonim untuk menjaga kamera tetap lancar (opsional)",
    detailsTitle: "Pemberitahuan privasi & data (UU PDP)",
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
      "• Foto pernikahan yang kamu pilih untuk disimpan.\n• Nama panggilan/tampilan tamu (opsional).\n• Kode roll film 6 karakter untuk pemulihan sesi.\n• Diagnostik teknis anonim (hanya jika disetujui).\n• Statistik agregat anonim preferensi resep film (tanpa pelacakan individu). Kami TIDAK menyimpan alamat IP kamu dan tidak melacak kamu di situs web lain.",
    retentionTitle: "4. Masa Retensi & Penyimpanan",
    retentionBody:
      "Foto disimpan di Google Drive dan Supabase. Data diagnostik otomatis dihapus setelah 30 hari. Kamu dapat menghapus seluruh roll foto kamu kapan saja.",
    rightsTitle: "5. Hak & Penghapusan Data",
    rightsBody:
      "Kamu berhak menarik persetujuan dan menghapus seluruh roll foto kapan saja, yang akan menghapus permanen seluruh foto kamu dari Google Drive, server, dan perangkat ini.",
    withdrawAction: "Tarik persetujuan & hapus roll saya",
    withdrawConfirm: "Apakah kamu yakin? Ini akan menghapus permanen seluruh foto dari roll kamu di Google Drive, database, dan perangkat ini.",
    withdrawSuccess: "Roll dan foto kamu telah dihapus permanen.",
  },
};
