import type { Lang } from "@/lib/i18n";

export interface Session {
  guestId: string;
  name: string | null;
  lang: Lang;
}

const key = (slug: string) => `dc:session:${slug}`;
const nativeKey = (slug: string) => `dc:native:${slug}`;

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode / blocked storage
  }
}

export function loadSession(slug: string): Session | null {
  try {
    const raw = ls()?.getItem(key(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return typeof s.guestId === "string" ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(slug: string, s: Session): void {
  try {
    ls()?.setItem(key(slug), JSON.stringify(s));
  } catch {
    /* storage full/blocked: server cookie still identifies the guest */
  }
}

/** Set BEFORE opening the OS camera: the tab may be killed while the camera app is open. */
export function markNativePending(slug: string): void {
  try {
    ls()?.setItem(nativeKey(slug), String(Date.now()));
  } catch {
    /* ignore */
  }
}
export function clearNativePending(slug: string): void {
  try {
    ls()?.removeItem(nativeKey(slug));
  } catch {
    /* ignore */
  }
}
export function wasNativePending(slug: string): boolean {
  try {
    return !!ls()?.getItem(nativeKey(slug));
  } catch {
    return false;
  }
}
