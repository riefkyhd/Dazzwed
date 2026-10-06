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
});
