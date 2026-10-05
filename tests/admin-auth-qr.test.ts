import { describe, it, expect, vi } from "vitest";
import { generateQrSvg, generateQrPngDataUrl } from "@/lib/qr";
import { isEmailAdmin } from "@/lib/supabase/auth";

vi.mock("@/env", () => ({
  serverEnv: () => ({
    ADMIN_EMAILS: ["riefkyhd.dev@gmail.com", "wedding-couple@example.com"],
  }),
}));

describe("Phase 5: Admin QR Generation", () => {
  it("generates an SVG string representation with xml/svg tags", async () => {
    const svg = await generateQrSvg("https://example.com/e/our-wedding");
    expect(svg).toBeTypeOf("string");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox");
  });

  it("generates a high-res PNG Data URL for download", async () => {
    const dataUrl = await generateQrPngDataUrl("https://example.com/e/our-wedding", 512);
    expect(dataUrl).toBeTypeOf("string");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});

describe("Phase 5: Admin Auth & Allowlist Enforcement", () => {
  it("allows allowlisted email addresses regardless of case or whitespace", () => {
    expect(isEmailAdmin("riefkyhd.dev@gmail.com")).toBe(true);
    expect(isEmailAdmin("  RIEFKYHD.DEV@GMAIL.COM  ")).toBe(true);
    expect(isEmailAdmin("wedding-couple@example.com")).toBe(true);
  });

  it("rejects non-allowlisted, empty, or malicious emails", () => {
    expect(isEmailAdmin("intruder@example.com")).toBe(false);
    expect(isEmailAdmin("riefkyhd.dev@evil.com")).toBe(false);
    expect(isEmailAdmin("")).toBe(false);
    expect(isEmailAdmin(null)).toBe(false);
    expect(isEmailAdmin(undefined)).toBe(false);
  });
});
