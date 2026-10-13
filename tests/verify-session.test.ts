import { describe, it, expect } from "vitest";
import {
  guestCookieName,
  readGuestCookie,
  verifyGuestSession,
} from "../src/lib/api/verify-session";

describe("Guest Session Cookie Verification (B4)", () => {
  const validUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const otherUuid = "c9bf9e57-1685-4c89-bafb-ff5af830be8a";
  const slug = "our-wedding";

  it("computes the correct cookie name format", () => {
    expect(guestCookieName("our-wedding")).toBe("dc_g_our-wedding");
    expect(guestCookieName("alice-bob")).toBe("dc_g_alice-bob");
  });

  it("reads and parses valid UUID from cookie header", () => {
    const req = new Request("https://dazzwed.vercel.app/api/photos/init", {
      headers: {
        cookie: `foo=bar; dc_g_our-wedding=${validUuid}; theme=dark`,
      },
    });

    expect(readGuestCookie(req, slug)).toBe(validUuid);
  });

  it("returns null when cookie is absent or malformed", () => {
    const reqNoCookie = new Request("https://dazzwed.vercel.app/api/photos/init");
    expect(readGuestCookie(reqNoCookie, slug)).toBeNull();

    const reqWrongSlug = new Request("https://dazzwed.vercel.app/api/photos/init", {
      headers: { cookie: `dc_g_other-event=${validUuid}` },
    });
    expect(readGuestCookie(reqWrongSlug, slug)).toBeNull();

    const reqInvalidUuid = new Request("https://dazzwed.vercel.app/api/photos/init", {
      headers: { cookie: `dc_g_our-wedding=not-a-valid-uuid` },
    });
    expect(readGuestCookie(reqInvalidUuid, slug)).toBeNull();
  });

  it("verifies session cookie against body guestId correctly", () => {
    const req = new Request("https://dazzwed.vercel.app/api/photos/init", {
      headers: {
        cookie: `dc_g_our-wedding=${validUuid}`,
      },
    });

    // Matching guestId succeeds
    expect(verifyGuestSession(req, slug, validUuid)).toBe(validUuid);

    // Mismatched guestId is rejected with null
    expect(verifyGuestSession(req, slug, otherUuid)).toBeNull();

    // Absent cookie is rejected with null
    const reqEmpty = new Request("https://dazzwed.vercel.app/api/photos/init");
    expect(verifyGuestSession(reqEmpty, slug, validUuid)).toBeNull();
  });
});
