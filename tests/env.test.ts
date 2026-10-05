import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(30),
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(30),
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  ADMIN_EMAILS: "A@x.com, b@x.com",
  CRON_SECRET: "c".repeat(16),
};

describe("env", () => {
  it("parses a valid env and lowercases admin emails", () => {
    const env = parseServerEnv(valid);
    expect(env.ADMIN_EMAILS).toEqual(["a@x.com", "b@x.com"]);
    expect(env.TURNSTILE_ENABLED).toBe(false);
    expect(env.GOOGLE_REFRESH_TOKEN).toBeUndefined();
  });

  it("treats empty strings as unset", () => {
    expect(parseServerEnv({ ...valid, GOOGLE_REFRESH_TOKEN: "", TURNSTILE_SECRET_KEY: "" })).toBeTruthy();
  });

  it("throws a readable message listing every problem", () => {
    expect(() => parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "nope", CRON_SECRET: "short" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL[\s\S]*CRON_SECRET/,
    );
  });

  it("requires admin emails", () => {
    expect(() => parseServerEnv({ ...valid, ADMIN_EMAILS: undefined })).toThrow(/ADMIN_EMAILS/);
  });

  it("requires turnstile keys when enabled", () => {
    expect(() => parseServerEnv({ ...valid, TURNSTILE_ENABLED: "true" })).toThrow(/TURNSTILE_SECRET_KEY/);
    expect(parseServerEnv({
      ...valid, TURNSTILE_ENABLED: "true", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k",
    }).TURNSTILE_ENABLED).toBe(true);
  });
});
