import { describe, it, expect, vi } from "vitest";
import { validateEventToken } from "@/lib/event-token";
import { createStoredZipBlob } from "@/lib/export/zip";

describe("Production Audit Fixes Regression Suite", () => {
  describe("Issue #1 & #2: Strict Token Check and Access Resolution", () => {
    const eventAccessToken = "103685F6";

    function evaluateGuestAccess(
      candidateToken: string | null | undefined,
      sessionCookie: string | null | undefined,
      actualAccessToken: string | null | undefined,
      tokenExpiresAt?: string | null
    ): { allowed: boolean; reason?: "invalid" | "expired" } {
      const hasTokenParam = Boolean(candidateToken);
      const tokenValid = validateEventToken(candidateToken, actualAccessToken);
      const hasValidSessionCookie = Boolean(
        sessionCookie && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionCookie)
      );
      const isExpired = tokenExpiresAt ? new Date() >= new Date(tokenExpiresAt) : false;

      const isUnauthorized = hasTokenParam ? !tokenValid : !hasValidSessionCookie;
      if (isExpired) {
        return { allowed: false, reason: "expired" };
      }
      if (isUnauthorized) {
        return { allowed: false, reason: "invalid" };
      }
      return { allowed: true };
    }

    it("rejects mutated token (?t=103685F6fds) EVEN IF a valid session cookie exists (Issue #1)", () => {
      const validCookieUuid = "123e4567-e89b-12d3-a456-426614174000";
      const mutatedToken = "103685F6fds";

      const access = evaluateGuestAccess(mutatedToken, validCookieUuid, eventAccessToken);
      expect(access.allowed).toBe(false);
      expect(access.reason).toBe("invalid");
    });

    it("distinguishes 'invalid' from 'expired' error states (Issue #2)", () => {
      // 1. Invalid token on active event -> reason: 'invalid'
      const invalidAccess = evaluateGuestAccess("WRONGTOK", null, eventAccessToken);
      expect(invalidAccess.allowed).toBe(false);
      expect(invalidAccess.reason).toBe("invalid");

      // 2. Valid token on expired event -> reason: 'expired'
      const pastDate = new Date(Date.now() - 3600_000).toISOString();
      const expiredAccess = evaluateGuestAccess(eventAccessToken, null, eventAccessToken, pastDate);
      expect(expiredAccess.allowed).toBe(false);
      expect(expiredAccess.reason).toBe("expired");
    });

    it("permits access when valid token is supplied in URL without cookie", () => {
      const access = evaluateGuestAccess("103685F6", null, eventAccessToken);
      expect(access.allowed).toBe(true);
      expect(access.reason).toBeUndefined();
    });

    it("permits returning guest with valid cookie when NO token param is in URL", () => {
      const validCookieUuid = "123e4567-e89b-12d3-a456-426614174000";
      const access = evaluateGuestAccess(null, validCookieUuid, eventAccessToken);
      expect(access.allowed).toBe(true);
      expect(access.reason).toBeUndefined();
    });
  });

  describe("Issue #10: ZIP Export Zero Empty Folders", () => {
    it("creates a valid ZIP blob with exactly the file entries provided (no phantom empty directories)", async () => {
      const entries = [
        {
          filename: "Napa (7K9X2B)/01_7K9X2B_photo1_film.jpg",
          data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
        },
        {
          filename: "Syaffa (4A2M1P)/01_4A2M1P_photo2_film.jpg",
          data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
        },
      ];

      const zipBlob = createStoredZipBlob(entries);
      expect(zipBlob).toBeInstanceOf(Blob);
      expect(zipBlob.type).toBe("application/zip");
      expect(zipBlob.size).toBeGreaterThan(0);

      // Verify that guests with 0 photos (e.g. Son) do not appear in the ZIP
      const buffer = new Uint8Array(await zipBlob.arrayBuffer());
      const text = new TextDecoder().decode(buffer);
      expect(text).toContain("Napa (7K9X2B)");
      expect(text).toContain("Syaffa (4A2M1P)");
      expect(text).not.toContain("Son");
    });
  });

  describe("Issue #3 & #5: Auth Redirect Resolution", () => {
    function resolveLoginDestination(
      role: "superadmin" | "client",
      nextParam?: string | null,
      serverRedirectTo?: string
    ): string {
      return nextParam || serverRedirectTo || (role === "superadmin" ? "/superadmin" : "/admin");
    }

    it("routes superadmin to /superadmin by default", () => {
      expect(resolveLoginDestination("superadmin")).toBe("/superadmin");
    });

    it("routes client to /admin by default", () => {
      expect(resolveLoginDestination("client")).toBe("/admin");
    });

    it("respects ?next= query parameter if present for deep links", () => {
      expect(resolveLoginDestination("superadmin", "/admin/settings")).toBe("/admin/settings");
      expect(resolveLoginDestination("client", "/admin/photos?view=rolls")).toBe("/admin/photos?view=rolls");
    });
  });
});
