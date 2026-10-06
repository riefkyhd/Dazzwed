export type Lang = "en" | "id";

const en = {
  appName: "Disposable Cam",
  welcomeTo: "Welcome to the wedding of",
  howItWorks: "How it works",
  step1: "You get {n} shots. Make them count.",
  step2: "No previews, no retakes, just like a real disposable camera.",
  step3: "The couple develops the roll after the party.",
  privacy: "Photos are visible only to the couple.",
  yourName: "Your name (optional)",
  yourNamePlaceholder: "e.g. Aunt Rina",
  startCamera: "Start camera",
  useNativeCamera: "Use my phone's camera app",
  language: "Language",
  shotsLeft: "{n} left",
  shotsLeftOne: "1 left",
  flip: "Flip camera",
  lens: "Lens",
  zoom: "Zoom",
  digital: "digital",
  torch: "Flash",
  shutter: "Take photo",
  pending: "{n} saving…",
  synced: "All saved",
  thanksTitle: "That's a wrap!",
  thanksBody: "You've used all your shots. Thank you for being part of our day.",
  thanksNote: "The couple will see your photos after the event.",
  thanksSaving: "Still saving a few photos. Please keep this page open until it says all saved.",
  closedTitle: "Not open right now",
  closedBeforeBody: "The camera opens on {date}.",
  closedAfterBody: "The camera has closed. Thank you for celebrating with us!",
  closedManualBody: "The camera is currently switched off.",
  errDeniedTitle: "Camera access is blocked",
  errDeniedBody: "Allow camera access in your browser settings, or use your phone's camera app instead.",
  errUnsupportedBody: "This browser can't open the in-app camera. You can still take photos with your phone's camera app.",
  errInAppHint: "Tip: open this link in Safari or Chrome for the full camera experience.",
  errGeneric: "We couldn't start the camera. Try again, or use your phone's camera app.",
  errInsecure: "The camera needs a secure (https) connection.",
  retry: "Try again",
  restarting: "Restarting camera…",
  limitReached: "You've used all your shots.",
  processing: "Developing…",
  storageError: "Couldn't save the photo on this device. Free up some space and try again.",
  close: "Close",
  keep: "Keep Photo",
  retake: "Retake",
  // debug
  debugTitle: "Camera debug",
} as const;

export type Key = keyof typeof en;
export type Dict = Record<Key, string>;

const id: Dict = {
  appName: "Disposable Cam",
  welcomeTo: "Selamat datang di pernikahan",
  howItWorks: "Cara kerjanya",
  step1: "Kamu punya {n} jepretan. Gunakan sebaik mungkin.",
  step2: "Tanpa pratinjau, tanpa ulang, seperti kamera sekali pakai sungguhan.",
  step3: "Pasangan akan \"mencuci\" rol fotonya setelah pesta.",
  privacy: "Foto hanya bisa dilihat oleh pasangan pengantin.",
  yourName: "Namamu (opsional)",
  yourNamePlaceholder: "mis. Tante Rina",
  startCamera: "Mulai kamera",
  useNativeCamera: "Pakai aplikasi kamera ponsel",
  language: "Bahasa",
  shotsLeft: "Sisa {n}",
  shotsLeftOne: "Sisa 1",
  flip: "Balik kamera",
  lens: "Lensa",
  zoom: "Zoom",
  digital: "digital",
  torch: "Lampu kilat",
  shutter: "Ambil foto",
  pending: "{n} sedang disimpan…",
  synced: "Semua tersimpan",
  thanksTitle: "Selesai!",
  thanksBody: "Semua jepretanmu sudah terpakai. Terima kasih sudah menjadi bagian dari hari kami.",
  thanksNote: "Pasangan akan melihat fotomu setelah acara.",
  thanksSaving: "Masih menyimpan beberapa foto. Biarkan halaman ini terbuka sampai tertulis semua tersimpan.",
  closedTitle: "Belum dibuka",
  closedBeforeBody: "Kamera dibuka pada {date}.",
  closedAfterBody: "Kamera sudah ditutup. Terima kasih sudah merayakan bersama kami!",
  closedManualBody: "Kamera sedang dimatikan.",
  errDeniedTitle: "Akses kamera diblokir",
  errDeniedBody: "Izinkan akses kamera di pengaturan browser, atau pakai aplikasi kamera ponselmu.",
  errUnsupportedBody: "Browser ini tidak bisa membuka kamera di dalam aplikasi. Kamu tetap bisa memotret lewat aplikasi kamera ponsel.",
  errInAppHint: "Tips: buka tautan ini di Safari atau Chrome untuk pengalaman kamera penuh.",
  errGeneric: "Kamera tidak bisa dimulai. Coba lagi, atau pakai aplikasi kamera ponsel.",
  errInsecure: "Kamera membutuhkan koneksi aman (https).",
  retry: "Coba lagi",
  restarting: "Memulai ulang kamera…",
  limitReached: "Semua jepretanmu sudah terpakai.",
  processing: "Mencuci foto…",
  storageError: "Foto tidak bisa disimpan di perangkat ini. Kosongkan ruang penyimpanan lalu coba lagi.",
  close: "Tutup",
  keep: "Simpan Foto",
  retake: "Foto Ulang",
  debugTitle: "Debug kamera",
};

export const dictionaries: Record<Lang, Dict> = { en, id };

export function t(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s: string = dictionaries[lang][key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function parseLang(v: unknown): Lang {
  return v === "id" ? "id" : "en";
}
