import { describe, it, expect } from "vitest";
import {
  computeRollCodeFromGuestId,
  normalizeRollCode,
  ROLL_CHARS,
} from "@/lib/guest/session";

describe("Film Roll Code Architecture", () => {
  it("generates exactly 6-character uppercase codes using unambiguous charset", () => {
    const id1 = "51b624e2-d226-4c83-916b-e695c5f69a84";
    const code1 = computeRollCodeFromGuestId(id1);

    expect(code1).toHaveLength(6);
    expect(code1).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    // Verify excluded ambiguous characters: 0, 1, I, O
    for (const badChar of ["0", "1", "I", "O"]) {
      expect(code1).not.toContain(badChar);
    }
  });

  it("is deterministic for the same guest UUID", () => {
    const id = "ec1088a2-ba41-42f0-abe0-ffffe2dc4ade";
    const codeA = computeRollCodeFromGuestId(id);
    const codeB = computeRollCodeFromGuestId(id);
    expect(codeA).toBe(codeB);
  });

  it("produces distinct codes across different guests with low collision probability", () => {
    const codes = new Set<string>();
    const count = 500;
    for (let i = 0; i < count; i++) {
      const code = computeRollCodeFromGuestId(crypto.randomUUID());
      codes.add(code);
    }
    // Out of 500 random UUIDs with 32^6 (~1 billion) namespace, expect > 99% unique
    expect(codes.size).toBeGreaterThan(490);
  });

  it("normalizes user inputs with dashes, spaces, and heals common mistypes", () => {
    // lowercase and dashes
    expect(normalizeRollCode("7k-9x2b")).toBe("7K9X2B");

    // '0' healed to 'O', '1' or 'I' healed to 'L'
    expect(normalizeRollCode("01-IO99")).toBe("OLLO99");

    // trims extra characters
    expect(normalizeRollCode("ABCDEFGH")).toBe("ABCDEF");
  });
});
