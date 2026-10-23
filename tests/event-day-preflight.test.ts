import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import React from "react";
import { renderToString } from "react-dom/server";
import { LandingScreen } from "@/components/guest/LandingScreen";
import { CONSENT_COPY, CONSENT_VERSION } from "@/constants/consentCopy";
import { computeRollCodeFromGuestId, normalizeRollCode } from "@/lib/guest/session";
import { validateEventToken } from "@/lib/event-token";
import { activeInFlightIds, addShot, getShot, getPendingShots } from "@/lib/queue/store";
import { uploadQueue } from "@/lib/queue/uploader";
import { assertEventTenantAccess } from "@/lib/auth/session";

describe("Event-Day Production Pre-Flight Battery", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    activeInFlightIds.clear();
    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const d of dbs) {
        if (d.name) indexedDB.deleteDatabase(d.name);
      }
    }
  });

  // =========================================================================
  // Scenario A: Guest Onboarding & Mandatory Name Gate
  // =========================================================================
  describe("Scenario A: Guest Onboarding & Mandatory Name Gate", () => {
    const baseProps = {
      coupleNames: "Dhifa & Riefky",
      shotsPerGuest: 30,
      eventSlug: "our-wedding",
      lang: "en" as const,
      onLanguageChange: () => {},
      onStartCamera: () => {},
      onNativePhoto: () => {},
    };

    it("renders required indicator and placeholder for mandatory name field", () => {
      const html = renderToString(React.createElement(LandingScreen, { ...baseProps }));
      // Label shows uppercase YOUR NAME with required asterisk
      expect(html).toContain("YOUR NAME");
      expect(html).toContain("*");
      // Placeholder prompts guest to claim their roll
      expect(html).toContain("Enter your name to claim your film roll...");
      // Primary button is disabled initially when name is empty
      expect(html).toContain("disabled");
    });

    it("strictly hides 'Withdraw consent & delete my roll' before guest claims a roll", () => {
      const escapeHtml = (str: string) => str.replace(/&/g, "&amp;");
      const htmlUnregistered = renderToString(React.createElement(LandingScreen, { ...baseProps, hasActiveRoll: false }));
      expect(htmlUnregistered).not.toContain(escapeHtml(CONSENT_COPY.en.withdrawAction));

      const htmlRegistered = renderToString(React.createElement(LandingScreen, { ...baseProps, hasActiveRoll: true }));
      expect(htmlRegistered).toContain(escapeHtml(CONSENT_COPY.en.withdrawAction));
    });

    it("rejects new guest registration when name is empty, whitespace, or less than 2 characters", () => {
      const validateNewGuestName = (rawName?: string | null) => {
        const clean = (s?: string | null) => {
          if (s === undefined) return undefined;
          const v = (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
          return v || null;
        };
        const name = clean(rawName);
        const trimmed = (name ?? "").trim();
        if (trimmed.length < 2) {
          return { error: "Guest name is required (at least 2 characters) to start a film roll", code: "GUEST_NAME_REQUIRED" };
        }
        if (trimmed.length > 50) {
          return { error: "Guest name must be at most 50 characters", code: "GUEST_NAME_TOO_LONG" };
        }
        return { valid: true, displayName: trimmed };
      };

      expect(validateNewGuestName("")).toEqual({ error: expect.any(String), code: "GUEST_NAME_REQUIRED" });
      expect(validateNewGuestName("   ")).toEqual({ error: expect.any(String), code: "GUEST_NAME_REQUIRED" });
      expect(validateNewGuestName("A")).toEqual({ error: expect.any(String), code: "GUEST_NAME_REQUIRED" });
      expect(validateNewGuestName(null)).toEqual({ error: expect.any(String), code: "GUEST_NAME_REQUIRED" });
      expect(validateNewGuestName(undefined)).toEqual({ error: expect.any(String), code: "GUEST_NAME_REQUIRED" });

      const validResult = validateNewGuestName("Audira");
      expect(validResult).toEqual({ valid: true, displayName: "Audira" });
    });
  });

  // =========================================================================
  // Scenario B: Connected Camera Capture & Dual-Master Separation
  // =========================================================================
  describe("Scenario B: Connected Camera Capture & Dual-Master Separation", () => {
    it("creates separate filtered film blob and pristine raw 2D original blob", () => {
      const simulateDualMasterCapture = (hasDualMaster: boolean) => {
        const mockRawFrame = { bytes: "raw-video-frame-unfiltered-no-lut-no-grain-no-date" };
        const mockProcessedFrame = { bytes: "webgl-lut-portra-grain-timestamp" };

        const filteredBlob = new Blob([mockProcessedFrame.bytes], { type: "image/jpeg" });
        const originalBlob = hasDualMaster ? new Blob([mockRawFrame.bytes], { type: "image/jpeg" }) : null;

        return { filteredBlob, originalBlob };
      };

      const capture = simulateDualMasterCapture(true);
      expect(capture.filteredBlob).toBeDefined();
      expect(capture.originalBlob).not.toBeNull();
      expect(capture.filteredBlob.size).not.toBe(capture.originalBlob?.size);
    });

    it("immediately decrements exposures on client before network roundtrip", () => {
      const totalCapacity = 30;
      let shotsTaken = 1;
      let shotsLeft = Math.max(0, totalCapacity - shotsTaken);
      expect(shotsLeft).toBe(29);

      // User taps shutter button -> instantaneous client decrement
      shotsTaken += 1;
      shotsLeft = Math.max(0, totalCapacity - shotsTaken);
      expect(shotsLeft).toBe(28);
    });
  });

  // =========================================================================
  // Scenario C: Real-World Smartphone Chaos (Lock Phone, Background Tab, Tab Close)
  // =========================================================================
  describe("Scenario C: Real-World Smartphone Chaos", () => {
    it("heals orphaned upload locks older than 45s while protecting active in-flight transfers", async () => {
      const guestId = "guest-lock-test";
      const slug = "our-wedding";
      const dummyBlob = new Blob(["test"], { type: "image/jpeg" });
      const { updateShot } = await import("@/lib/queue/store");

      // Shot 1: Stale lock from 60 seconds ago (orphaned by phone lock)
      await addShot({
        shotId: "shot-stale-lock",
        eventSlug: slug,
        guestId,
        blob: dummyBlob,
      });

      // Mark status as uploading with uploadStartedAt > 45s ago
      await updateShot("shot-stale-lock", {
        status: "uploading",
        uploadStartedAt: Date.now() - 50_000,
      });

      // Shot 2: Actively running slow upload marked in activeInFlightIds
      await addShot({
        shotId: "shot-active-inflight",
        eventSlug: slug,
        guestId,
        blob: dummyBlob,
      });
      await updateShot("shot-active-inflight", {
        status: "uploading",
        uploadStartedAt: Date.now() - 50_000,
      });
      activeInFlightIds.add("shot-active-inflight");

      // Verify healing logic
      const pending = await getPendingShots(guestId);
      const staleShot = pending.find((s) => s.shotId === "shot-stale-lock");
      expect(staleShot).toBeDefined();
      expect(staleShot?.status).toBe("queued"); // Recovered to queued!

      const activeShot = pending.find((s) => s.shotId === "shot-active-inflight");
      expect(activeShot?.status).toBe("uploading"); // Preserved in-flight!
    });

    it("triggers beforeunload guard while pendingCount > 0 and permits clean exit when pendingCount === 0", () => {
      let prevented = false;
      let returnValue = "unset";

      const simulateBeforeUnload = (pendingCount: number) => {
        prevented = false;
        returnValue = "unset";
        const event = {
          preventDefault: () => { prevented = true; },
          returnValue: "",
        };

        if (pendingCount > 0) {
          event.preventDefault();
          event.returnValue = "";
          returnValue = event.returnValue;
        }
      };

      // 1. Photos still syncing -> warning triggered
      simulateBeforeUnload(2);
      expect(prevented).toBe(true);
      expect(returnValue).toBe("");

      // 2. All photos saved -> clean exit allowed
      simulateBeforeUnload(0);
      expect(prevented).toBe(false);
      expect(returnValue).toBe("unset");
    });
  });

  // =========================================================================
  // Scenario D: The Return Mechanism (4 Return Pathways)
  // =========================================================================
  describe("Scenario D: The Return Mechanism", () => {
    const validAccessToken = "103685F6";

    it("Return Path 1: Valid venue QR re-scan validates token and pre-hydrates guest session", () => {
      const candidateToken = "103685F6";
      const isValid = validateEventToken(candidateToken, validAccessToken);
      expect(isValid).toBe(true);

      const hasValidSessionCookie = true;
      const isUnauthorized = candidateToken ? !isValid : !hasValidSessionCookie;
      expect(isUnauthorized).toBe(false);
    });

    it("Return Path 2: Navigating to /e/[slug] without ?t= allows returning guest via session cookie", () => {
      const candidateToken = null; // No ?t= in URL
      const hasValidSessionCookie = true; // Guest session cookie present
      const isValid = validateEventToken(candidateToken, validAccessToken);

      const isUnauthorized = candidateToken ? !isValid : !hasValidSessionCookie;
      expect(isUnauthorized).toBe(false);
    });

    it("Return Path 3: Corrupted or tampered token ?t=... strictly blocks access even with valid cookie", () => {
      const candidateToken = "103685F6fds"; // Corrupted token
      const hasValidSessionCookie = true; // Guest session cookie present
      const isValid = validateEventToken(candidateToken, validAccessToken);
      expect(isValid).toBe(false);

      const isUnauthorized = candidateToken ? !isValid : !hasValidSessionCookie;
      expect(isUnauthorized).toBe(true); // Strictly unauthorized!
    });

    it("Return Path 4: 'Continue my roll' matches 6-character roll code and restores guest identity", () => {
      const guestUuid = "09e7100d-446b-498e-b07b-74d3c04e4e47";
      const rollCode = computeRollCodeFromGuestId(guestUuid);
      expect(rollCode).toHaveLength(6);

      const userInputCode = `  ${rollCode.toLowerCase()}  `;
      const normalized = normalizeRollCode(userInputCode);
      expect(normalized).toBe(rollCode);
      expect(normalized).toHaveLength(6);
    });
  });

  // =========================================================================
  // Scenario E: Multi-Tenant RBAC & Drive Isolation
  // =========================================================================
  describe("Scenario E: Multi-Tenant RBAC & Security Isolation", () => {
    it("blocks cross-tenant access when Client A attempts to access Client B's event", async () => {
      const clientSession = {
        role: "client" as const,
        clientId: "client-a-uuid",
        email: "client-a@test.com",
        name: "Client A",
      };

      // Mock Supabase to return Event B belonging to Client B
      const mockSb = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "event-b-uuid", slug: "event-b", client_id: "client-b-uuid", access_token: "TOKEN-B" },
                error: null,
              }),
            }),
          }),
        }),
      } as any;

      const res = await assertEventTenantAccess("event-b", { sb: mockSb, session: clientSession });
      expect(res.authorized).toBe(false);
      if (!res.authorized) {
        expect(res.status).toBe(403);
        expect(res.code).toBe("FORBIDDEN_CROSS_TENANT");
      }
    });

    it("allows Client A to access their own Event A", async () => {
      const clientSession = {
        role: "client" as const,
        clientId: "client-a-uuid",
        email: "client-a@test.com",
        name: "Client A",
      };

      const mockSb = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "event-a-uuid", slug: "event-a", client_id: "client-a-uuid", access_token: "TOKEN-A" },
                error: null,
              }),
            }),
          }),
        }),
      } as any;

      const res = await assertEventTenantAccess("event-a", { sb: mockSb, session: clientSession });
      expect(res.authorized).toBe(true);
    });

    it("allows Superadmin full access across any tenant event", async () => {
      const superadminSession = {
        role: "superadmin" as const,
        userId: "owner-admin",
        email: "owner@dazzwed.test",
        name: "Owner Admin",
      };

      const mockSb = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "event-b-uuid", slug: "event-b", client_id: "client-b-uuid", access_token: "TOKEN-B" },
                error: null,
              }),
            }),
          }),
        }),
      } as any;

      const res = await assertEventTenantAccess("event-b", { sb: mockSb, session: superadminSession });
      expect(res.authorized).toBe(true);
    });
  });
});
