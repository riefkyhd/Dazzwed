import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/rate-limit";
import { timingSafeEqual } from "node:crypto";

describe("Phase 6: Rate Limiting & Network Utilities", () => {
  it("extracts real client IP from x-forwarded-for header with multiple hops", () => {
    const req = new Request("https://example.com/api/photos", {
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.195");
  });

  it("extracts real client IP from x-real-ip header if x-forwarded-for is missing", () => {
    const req = new Request("https://example.com/api/photos", {
      headers: {
        "x-real-ip": "198.51.100.42",
      },
    });
    expect(getClientIp(req)).toBe("198.51.100.42");
  });

  it("defaults to 127.0.0.1 if no forwarding headers are present", () => {
    const req = new Request("https://example.com/api/photos");
    expect(getClientIp(req)).toBe("127.0.0.1");
  });
});

describe("Phase 6: Keepalive Cron Authorization", () => {
  const secret = "wedding_cron_secret_32_characters_long!";

  function verifyCronAuth(authHeader: string | null): boolean {
    const expected = Buffer.from(`Bearer ${secret}`);
    const given = Buffer.from(authHeader ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  it("authorizes valid Bearer CRON_SECRET", () => {
    expect(verifyCronAuth(`Bearer ${secret}`)).toBe(true);
  });

  it("rejects unauthorized, wrong secret, or tampered tokens", () => {
    expect(verifyCronAuth(null)).toBe(false);
    expect(verifyCronAuth("")).toBe(false);
    expect(verifyCronAuth("Bearer wrong_secret")).toBe(false);
    expect(verifyCronAuth(`Basic ${secret}`)).toBe(false);
  });
});
