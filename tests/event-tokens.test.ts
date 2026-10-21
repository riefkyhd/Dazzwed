import { describe, it, expect } from "vitest";
import {
  generateEventToken,
  validateEventToken,
  formatExpirationNotice,
  formatEditorialExpiry,
} from "@/lib/event-token";

describe("Event Token Utilities", () => {
  describe("generateEventToken", () => {
    it("generates an 8-character string by default", () => {
      const token = generateEventToken();
      expect(token).toHaveLength(8);
      expect(typeof token).toBe("string");
    });

    it("only uses unambiguous uppercase alphanumeric characters", () => {
      const unambiguousRegex = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/;
      for (let i = 0; i < 50; i++) {
        const token = generateEventToken();
        expect(token).toMatch(unambiguousRegex);
        expect(token).not.toMatch(/[01OI]/);
      }
    });

    it("generates distinct tokens across consecutive invocations", () => {
      const set = new Set<string>();
      for (let i = 0; i < 100; i++) {
        set.add(generateEventToken());
      }
      expect(set.size).toBe(100);
    });
  });

  describe("validateEventToken", () => {
    const validActual = "7K9X2M4P";

    it("validates exact match", () => {
      expect(validateEventToken("7K9X2M4P", validActual)).toBe(true);
    });

    it("validates case-insensitively", () => {
      expect(validateEventToken("7k9x2m4p", validActual)).toBe(true);
    });

    it("validates with surrounding whitespace", () => {
      expect(validateEventToken("  7K9X2M4P  ", validActual)).toBe(true);
    });

    it("rejects token mismatch", () => {
      expect(validateEventToken("8K9X2M4P", validActual)).toBe(false);
      expect(validateEventToken("ABCDEFGH", validActual)).toBe(false);
    });

    it("rejects invalid lengths without crashing timingSafeEqual", () => {
      expect(validateEventToken("7K9X", validActual)).toBe(false);
      expect(validateEventToken("7K9X2M4P123", validActual)).toBe(false);
      expect(validateEventToken("", validActual)).toBe(false);
    });

    it("rejects null or undefined inputs safely", () => {
      expect(validateEventToken(null, validActual)).toBe(false);
      expect(validateEventToken(undefined, validActual)).toBe(false);
      expect(validateEventToken("7K9X2M4P", null)).toBe(false);
      expect(validateEventToken(null, null)).toBe(false);
    });
  });

  describe("formatExpirationNotice", () => {
    const fixedNow = new Date("2026-10-15T10:00:00.000Z");

    it("formats future expiration correctly in English", () => {
      // 2 days and 3 hours from fixedNow
      const expiresAt = new Date(fixedNow.getTime() + (2 * 24 + 3) * 3600 * 1000).toISOString();
      const notice = formatExpirationNotice(expiresAt, "en", fixedNow);
      expect(notice.isExpired).toBe(false);
      expect(notice.relativeRemaining).toBe("2 days 3h");
      expect(notice.formattedDate).toBeDefined();
    });

    it("formats future expiration correctly in Indonesian", () => {
      const expiresAt = new Date(fixedNow.getTime() + (2 * 24 + 3) * 3600 * 1000).toISOString();
      const notice = formatExpirationNotice(expiresAt, "id", fixedNow);
      expect(notice.isExpired).toBe(false);
      expect(notice.relativeRemaining).toBe("2 hari 3 jam");
    });

    it("formats hours and minutes correctly when less than 24 hours remain", () => {
      // 4 hours and 30 minutes
      const expiresAt = new Date(fixedNow.getTime() + (4 * 3600 + 30 * 60) * 1000).toISOString();
      const enNotice = formatExpirationNotice(expiresAt, "en", fixedNow);
      expect(enNotice.isExpired).toBe(false);
      expect(enNotice.relativeRemaining).toBe("4h 30m");

      const idNotice = formatExpirationNotice(expiresAt, "id", fixedNow);
      expect(idNotice.isExpired).toBe(false);
      expect(idNotice.relativeRemaining).toBe("4 jam 30 menit");
    });

    it("flags past expiration as isExpired = true", () => {
      const past = new Date(fixedNow.getTime() - 3600 * 1000).toISOString();
      const noticeEn = formatExpirationNotice(past, "en", fixedNow);
      expect(noticeEn.isExpired).toBe(true);
      expect(noticeEn.relativeRemaining).toBe("expired");

      const noticeId = formatExpirationNotice(past, "id", fixedNow);
      expect(noticeId.isExpired).toBe(true);
      expect(noticeId.relativeRemaining).toBe("telah kedaluwarsa");
    });

    it("handles null or undefined expiration gracefully", () => {
      const noticeEn = formatExpirationNotice(null, "en", fixedNow);
      expect(noticeEn.isExpired).toBe(false);
      expect(noticeEn.relativeRemaining).toBe("active");

      const noticeId = formatExpirationNotice(undefined, "id", fixedNow);
      expect(noticeId.isExpired).toBe(false);
      expect(noticeId.relativeRemaining).toBe("aktif");
    });
  });

  describe("formatEditorialExpiry", () => {
    const fixedNow = new Date("2026-10-15T10:00:00.000Z");

    it("formats multi-day future expiration as 'This link is valid until...' in English", () => {
      // 3 days later
      const future = new Date(fixedNow.getTime() + 3 * 24 * 3600 * 1000).toISOString();
      const str = formatEditorialExpiry(future, "en", fixedNow);
      expect(str).toMatch(/^This link is valid until /);
      expect(str).toContain("Oct 18");
    });

    it("formats multi-day future expiration as 'Tautan ini berlaku hingga...' in Indonesian", () => {
      const future = new Date(fixedNow.getTime() + 3 * 24 * 3600 * 1000).toISOString();
      const str = formatEditorialExpiry(future, "id", fixedNow);
      expect(str).toMatch(/^Tautan ini berlaku hingga /);
      expect(str).toContain("18 Okt");
    });

    it("formats less than 24 hours remaining as 'This link expires in...' in English", () => {
      const future = new Date(fixedNow.getTime() + 5 * 3600 * 1000).toISOString();
      const str = formatEditorialExpiry(future, "en", fixedNow);
      expect(str).toBe("This link expires in 5 hours");
    });

    it("formats less than 24 hours remaining as 'Tautan ini berakhir dalam...' in Indonesian", () => {
      const future = new Date(fixedNow.getTime() + 5 * 3600 * 1000).toISOString();
      const str = formatEditorialExpiry(future, "id", fixedNow);
      expect(str).toBe("Tautan ini berakhir dalam 5 jam");
    });

    it("returns null for expired or null expiration dates", () => {
      const past = new Date(fixedNow.getTime() - 1000).toISOString();
      expect(formatEditorialExpiry(past, "en", fixedNow)).toBeNull();
      expect(formatEditorialExpiry(null, "en", fixedNow)).toBeNull();
      expect(formatEditorialExpiry(undefined, "en", fixedNow)).toBeNull();
    });
  });
});
