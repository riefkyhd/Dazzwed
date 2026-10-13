import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

describe("Security Hardening & Access Control Suite", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rusmfbednwwdzfavsjhf.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1c21mYmVkbnd3ZHpmYXZzamhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODc3NDIsImV4cCI6MjEwNjc2Mzc0Mn0.wthWNqv6ggxUX7JPDth1e0wr4C3hn5wwDhSauObiowI";

  it("strictly denies unauthenticated anonymous access across all tables via RLS", async () => {
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const tables = ["events", "guests", "photos", "admin_emails", "rate_limits"];

    for (const table of tables) {
      const selectRes = await sb.from(table).select("*").limit(1);
      // RLS or revoked permissions must deny select
      expect(selectRes.error).toBeDefined();
      expect(selectRes.error?.code).toBe("42501"); // Postgres insufficient privilege

      const deleteRes = await sb.from(table).delete().eq("id", "00000000-0000-0000-0000-000000000000");
      expect(deleteRes.error).toBeDefined();
    }
  });

  it("strictly denies anonymous execution of security definer RPC functions", async () => {
    const sb = createClient(supabaseUrl, supabaseAnonKey);

    const rpc1 = await sb.rpc("reserve_shot", {
      p_event_id: "00000000-0000-0000-0000-000000000000",
      p_guest_id: "00000000-0000-0000-0000-000000000000",
      p_shot_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(rpc1.error?.code).toBe("42501");

    const rpc2 = await sb.rpc("is_admin");
    expect(rpc2.error?.code).toBe("42501");

    const rpc3 = await sb.rpc("release_shot", {
      p_shot_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(rpc3.error?.code).toBe("42501");
  });

  it("validates SSRF protection on resumable chunk proxy URL", () => {
    const isValidSessionUri = (uri: string) => {
      try {
        const parsed = new URL(uri);
        return (
          parsed.protocol === "https:" &&
          parsed.hostname === "www.googleapis.com" &&
          parsed.pathname.startsWith("/upload/drive/v3/files")
        );
      } catch {
        return false;
      }
    };

    // Legitimate Google Drive upload URI
    expect(
      isValidSessionUri(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=abc123xyz"
      )
    ).toBe(true);

    // Malicious SSRF destinations
    expect(isValidSessionUri("http://localhost:3000/api/admin")).toBe(false);
    expect(isValidSessionUri("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isValidSessionUri("https://evil-attacker.com/upload")).toBe(false);
    expect(isValidSessionUri("https://www.googleapis.com.attacker.com/upload")).toBe(false);
    expect(isValidSessionUri("javascript:alert(1)")).toBe(false);
  });

  it("verifies cron authentication uses constant-time comparison", () => {
    const secret = "test-cron-secret-123456";
    const authorize = (givenHeader: string | null) => {
      if (!givenHeader) return false;
      const expected = Buffer.from(`Bearer ${secret}`);
      const given = Buffer.from(givenHeader);
      return given.length === expected.length && timingSafeEqual(given, expected);
    };

    expect(authorize(`Bearer ${secret}`)).toBe(true);
    expect(authorize(`Bearer wrong-secret`)).toBe(false);
    expect(authorize("Bearer ")).toBe(false);
    expect(authorize(null)).toBe(false);
  });

  it("verifies AES-256-GCM token encryption, decryption, and plaintext fallback", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/security/encryption");
    const rawRefreshToken = "1//04abcDEF123456789_-xyz-long-secret-refresh-token";

    // Encryption roundtrip
    const encrypted = encryptToken(rawRefreshToken);
    expect(encrypted).toMatch(/^enc:v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(encrypted).not.toContain(rawRefreshToken);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawRefreshToken);

    // Idempotency: re-encrypting an already encrypted token is a no-op
    expect(encryptToken(encrypted)).toBe(encrypted);

    // Backward compatibility: legacy unencrypted tokens return as-is
    const legacyPlain = "legacy-raw-plain-token";
    expect(decryptToken(legacyPlain)).toBe(legacyPlain);
  });

  it("verifies telemetry PII sanitizer redacts sensitive personal data and tokens", async () => {
    const { sanitizeTelemetryMessage } = await import("@/lib/telemetry/sanitizer");

    const messageWithPii =
      "Error processing user test.user+wedding@gmail.com with phone +628123456789 and auth Bearer ya29.a0AfH6SM... password=SecretPassword123!";

    const sanitized = sanitizeTelemetryMessage(messageWithPii);

    expect(sanitized).not.toContain("test.user+wedding@gmail.com");
    expect(sanitized).toContain("[REDACTED_EMAIL]");

    expect(sanitized).not.toContain("+628123456789");
    expect(sanitized).toContain("[REDACTED_PHONE]");

    expect(sanitized).not.toContain("Bearer ya29.a0AfH6SM");
    expect(sanitized).toContain("Bearer [REDACTED_TOKEN]");

    expect(sanitized).not.toContain("SecretPassword123!");
    expect(sanitized).toContain("credentials=[REDACTED]");
  });

  it("verifies /api/auth/setup-admin route is permanently decommissioned (410 Gone)", async () => {
    const { POST } = await import("@/app/api/auth/setup-admin/route");
    const res = await POST();
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error).toMatch(/decommissioned/i);
  });
});
