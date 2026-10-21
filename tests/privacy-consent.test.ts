import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, CONSENT_COPY } from "@/constants/consentCopy";
import { hashClientIp } from "@/lib/rate-limit";

describe("Privacy & Consent Compliance (Indonesia UU PDP)", () => {
  it("defines CONSENT_VERSION 2026-10-v1 and bilingual copy", () => {
    expect(CONSENT_VERSION).toBe("2026-10-v1");
    expect(CONSENT_COPY.en).toBeDefined();
    expect(CONSENT_COPY.id).toBeDefined();

    expect(CONSENT_COPY.en.checkboxAlbum).toContain("I agree to share my photos with the couple");
    expect(CONSENT_COPY.id.checkboxAlbum).toContain("Saya setuju membagikan foto ke mempelai");

    expect(CONSENT_COPY.en.detailsTitle).toContain("UU PDP");
    expect(CONSENT_COPY.id.detailsTitle).toContain("UU PDP");
  });

  it("hashes client IPs with HMAC-SHA256 digest to prevent raw IP storage", () => {
    const ip1 = "192.168.1.100";
    const ip2 = "2001:db8::1";

    const hash1 = hashClientIp(ip1);
    const hash2 = hashClientIp(ip2);

    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
    expect(hash1).not.toBe(ip1);
    expect(hash2).not.toBe(ip2);
    // 32-character hex string for compact key
    expect(hash1).toMatch(/^[a-f0-9]{32}$/);
    expect(hash2).toMatch(/^[a-f0-9]{32}$/);

    // Deterministic for same IP
    expect(hashClientIp(ip1)).toBe(hash1);
    // Distinct for different IPs
    expect(hash1).not.toBe(hash2);
  });

  it("manages client local consent lifecycle correctly in browser storage", async () => {
    // Mock browser localStorage
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: mockStorage },
      writable: true,
      configurable: true,
    });

    const { getLocalConsent, hasValidConsent, saveLocalConsent, clearLocalConsent } = await import(
      "@/lib/guest/consent"
    );

    // Initial: no consent
    expect(getLocalConsent()).toBeNull();
    expect(hasValidConsent()).toBe(false);

    // Grant consent
    const saved = saveLocalConsent({ album: true, telemetry: true });
    expect(saved.version).toBe(CONSENT_VERSION);
    expect(saved.album).toBe(true);
    expect(saved.telemetry).toBe(true);
    expect(hasValidConsent()).toBe(true);

    // Verify stored
    const retrieved = getLocalConsent();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.version).toBe(CONSENT_VERSION);
    expect(retrieved?.album).toBe(true);
    expect(retrieved?.telemetry).toBe(true);

    // Clear consent
    clearLocalConsent();
    expect(getLocalConsent()).toBeNull();
    expect(hasValidConsent()).toBe(false);
  });

  it("conditionally renders 'Withdraw consent & delete my roll' on LandingScreen only when hasActiveRoll is true", async () => {
    // Next.js Image component needs document and window.location if window is mocked
    if (typeof (globalThis as any).window !== "undefined" && !(globalThis as any).window.location) {
      (globalThis as any).window.location = { href: "http://localhost:3000" };
    }
    if (typeof (globalThis as any).document === "undefined") {
      (globalThis as any).document = {
        documentElement: { dataset: {} },
        querySelector: () => null,
        createElement: () => ({ setAttribute: () => {}, getAttribute: () => null }),
      };
    } else if (!(globalThis as any).document.documentElement) {
      (globalThis as any).document.documentElement = { dataset: {} };
    }
    const { renderToString } = await import("react-dom/server");
    const React = await import("react");
    const { LandingScreen } = await import("@/components/guest/LandingScreen");

    const baseProps = {
      coupleNames: "Romeo & Juliet",
      shotsPerGuest: 15,
      eventSlug: "romeo-juliet",
      lang: "en" as const,
      onLanguageChange: () => {},
      onStartCamera: () => {},
      onNativePhoto: () => {},
    };

    const escapeHtml = (str: string) => str.replace(/&/g, "&amp;");

    // When hasActiveRoll is false or undefined (first-time visitor)
    const htmlUnregistered = renderToString(React.createElement(LandingScreen, { ...baseProps }));
    expect(htmlUnregistered).toContain(escapeHtml(CONSENT_COPY.en.rightsTitle));
    expect(htmlUnregistered).not.toContain(escapeHtml(CONSENT_COPY.en.withdrawAction));

    const htmlExplicitFalse = renderToString(React.createElement(LandingScreen, { ...baseProps, hasActiveRoll: false }));
    expect(htmlExplicitFalse).toContain(escapeHtml(CONSENT_COPY.en.rightsTitle));
    expect(htmlExplicitFalse).not.toContain(escapeHtml(CONSENT_COPY.en.withdrawAction));

    // When hasActiveRoll is true (returning guest with active roll)
    const htmlActive = renderToString(React.createElement(LandingScreen, { ...baseProps, hasActiveRoll: true }));
    expect(htmlActive).toContain(escapeHtml(CONSENT_COPY.en.rightsTitle));
    expect(htmlActive).toContain(escapeHtml(CONSENT_COPY.en.withdrawAction));
  });

  it("inspects remote guests table structure", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rusmfbednwwdzfavsjhf.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (key) {
      const sb = createClient(url, key);
      const res = await sb.from("guests").select("*").limit(1);
      console.log("Remote guests row columns:", res.data ? Object.keys(res.data[0] || {}) : res.error);
    }
  });
});
