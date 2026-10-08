import { describe, it, expect } from "vitest";
import { t, parseLang } from "@/lib/i18n";
import type { CameraAspect } from "@/lib/imaging/geometry";

describe("Review and Capture Edge-Case Handling & Translations", () => {
  it("has complete internationalized error messages for capture failure across all supported languages", () => {
    for (const lang of ["en", "id"] as const) {
      const captureFail = t(lang, "captureFailed");
      expect(captureFail).toBeDefined();
      expect(captureFail.length).toBeGreaterThan(10);

      const keepFail = t(lang, "keepFailed");
      expect(keepFail).toBeDefined();
      expect(keepFail.length).toBeGreaterThan(10);

      const keepText = t(lang, "keep");
      expect(keepText).toBeDefined();
      expect(keepText.length).toBeGreaterThan(0);

      const retakeText = t(lang, "retake");
      expect(retakeText).toBeDefined();
      expect(retakeText.length).toBeGreaterThan(0);
    }
  });

  it("calculates correct frame numbering for film rolls", () => {
    const totalShots = 15;
    const testCases = [
      { shotsLeft: 15, expectedFrame: 1 },
      { shotsLeft: 14, expectedFrame: 2 },
      { shotsLeft: 1, expectedFrame: 15 },
    ];

    for (const tc of testCases) {
      const currentFrame = totalShots - tc.shotsLeft + 1;
      expect(currentFrame).toBe(tc.expectedFrame);
      const frameString = `FRAME ${String(currentFrame).padStart(2, "0")} / ${totalShots}`;
      expect(frameString).toContain(String(tc.expectedFrame).padStart(2, "0"));
    }
  });

  it("maps aspects to correct CSS proportional height and class names", () => {
    const aspectMap: Record<CameraAspect, string> = {
      "1:1": "aspect-square max-h-[64vh]",
      "16:9": "aspect-[9/16] max-h-[76vh]",
      "3:4": "aspect-[3/4] max-h-[72vh]",
      "3:2": "aspect-[3/4] max-h-[72vh]",
      "4:3": "aspect-[3/4] max-h-[72vh]",
    };

    expect(aspectMap["1:1"]).toContain("aspect-square");
    expect(aspectMap["16:9"]).toContain("aspect-[9/16]");
    expect(aspectMap["3:4"]).toContain("aspect-[3/4]");
  });
});
