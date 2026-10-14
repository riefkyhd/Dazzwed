"use client";

import { CONSENT_VERSION } from "@/constants/consentCopy";

export interface StoredConsent {
  version: string;
  consentedAt: string;
  album: boolean;
  telemetry: boolean;
}

const CONSENT_STORAGE_KEY = "dc_consent";

/**
 * Reads local consent without mutating storage.
 * Safe to call before consent is given (returns null if empty or unparseable).
 */
export function getLocalConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.version === "string" &&
      typeof parsed.album === "boolean"
    ) {
      return {
        version: parsed.version,
        consentedAt: typeof parsed.consentedAt === "string" ? parsed.consentedAt : new Date().toISOString(),
        album: parsed.album,
        telemetry: Boolean(parsed.telemetry),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether valid consent matching current CONSENT_VERSION has been granted on this device.
 */
export function hasValidConsent(): boolean {
  const c = getLocalConsent();
  return Boolean(c && c.version === CONSENT_VERSION && c.album === true);
}

/**
 * Writes the guest's explicit consent to localStorage upon form submission.
 */
export function saveLocalConsent(params: { album: boolean; telemetry: boolean }): StoredConsent {
  const consent: StoredConsent = {
    version: CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
    album: params.album,
    telemetry: params.telemetry,
  };
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    }
  } catch {
    /* ignore storage quota or private window errors */
  }
  return consent;
}

/**
 * Clears local consent (used during "Clear Data" or "Delete My Roll").
 */
export function clearLocalConsent(): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}
