import crypto from "crypto";

/**
 * Characters used for event access tokens.
 * Omits easily confused characters (0, O, 1, I).
 */
const TOKEN_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generate a cryptographically secure 8-character token.
 * Example: '7K9X2M4P'
 */
export function generateEventToken(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TOKEN_CHARSET[bytes[i] % TOKEN_CHARSET.length];
  }
  return result;
}

/**
 * Constant-time comparison between user-supplied candidate token and actual event token.
 * Prevents timing attacks.
 */
export function validateEventToken(
  candidate?: string | null,
  actual?: string | null
): boolean {
  if (!candidate || !actual) return false;
  const cleanCandidate = candidate.trim().toUpperCase();
  const cleanActual = actual.trim().toUpperCase();

  const bufA = Buffer.from(cleanCandidate, "utf8");
  const bufB = Buffer.from(cleanActual, "utf8");

  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface ExpirationNotice {
  isExpired: boolean;
  formattedDate: string;
  relativeRemaining: string;
}

/**
 * Formats expiration timestamp into localized date & relative remaining time.
 */
export function formatExpirationNotice(
  expiresAt: string | null | undefined,
  lang: "en" | "id",
  now: Date = new Date()
): ExpirationNotice {
  if (!expiresAt) {
    return {
      isExpired: false,
      formattedDate: lang === "id" ? "Tidak ada batas waktu" : "No expiration set",
      relativeRemaining: lang === "id" ? "aktif" : "active",
    };
  }

  const expDate = new Date(expiresAt);
  const diffMs = expDate.getTime() - now.getTime();
  const isExpired = diffMs <= 0;

  const locale = lang === "id" ? "id-ID" : "en-US";
  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: lang !== "id",
  }).format(expDate);

  if (isExpired) {
    return {
      isExpired: true,
      formattedDate,
      relativeRemaining: lang === "id" ? "telah kedaluwarsa" : "expired",
    };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  let relativeRemaining = "";
  if (lang === "id") {
    if (diffDays >= 1) {
      relativeRemaining = remainingHours > 0 ? `${diffDays} hari ${remainingHours} jam` : `${diffDays} hari`;
    } else if (diffHours >= 1) {
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      relativeRemaining = diffMins > 0 ? `${diffHours} jam ${diffMins} menit` : `${diffHours} jam`;
    } else {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      relativeRemaining = `${diffMins} menit`;
    }
  } else {
    if (diffDays >= 1) {
      const dayStr = diffDays === 1 ? "1 day" : `${diffDays} days`;
      relativeRemaining = remainingHours > 0 ? `${dayStr} ${remainingHours}h` : dayStr;
    } else if (diffHours >= 1) {
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      relativeRemaining = diffMins > 0 ? `${diffHours}h ${diffMins}m` : `${diffHours} hours`;
    } else {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      relativeRemaining = diffMins === 1 ? "1 minute" : `${diffMins} minutes`;
    }
  }

  return {
    isExpired: false,
    formattedDate,
    relativeRemaining,
  };
}

/**
 * Editorial, minimal luxury format for the Landing Screen:
 * e.g. "Roll open until Sunday, Oct 18" (or "Closes in 6 hours" if < 24h)
 * or "Kamera dibuka hingga Minggu, 18 Okt" (or "Ditutup dalam 6 jam" if < 24h)
 */
export function formatEditorialExpiry(
  expiresAt: string | null | undefined,
  lang: "en" | "id",
  now: Date = new Date()
): string | null {
  if (!expiresAt) return null;
  const expDate = new Date(expiresAt);
  const diffMs = expDate.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    if (lang === "id") {
      return diffHours > 0 ? `Ditutup dalam ${diffHours} jam` : "Ditutup dalam waktu kurang dari 1 jam";
    }
    return diffHours > 0 ? `Closes in ${diffHours} hour${diffHours > 1 ? "s" : ""}` : "Closes in less than 1 hour";
  }

  const locale = lang === "id" ? "id-ID" : "en-US";
  const dateStr = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(expDate);

  return lang === "id"
    ? `Kamera dibuka hingga ${dateStr}`
    : `Roll open until ${dateStr}`;
}
