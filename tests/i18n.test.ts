import { describe, expect, it } from "vitest";
import { t, parseLang, dictionaries } from "@/lib/i18n";

describe("i18n system", () => {
  it("defaults to en and parses lang safely", () => {
    expect(parseLang("id")).toBe("id");
    expect(parseLang("en")).toBe("en");
    expect(parseLang("es")).toBe("en");
    expect(parseLang(null)).toBe("en");
  });

  it("translates all keys in English and Indonesian dictionaries with equal coverage", () => {
    const enKeys = Object.keys(dictionaries.en);
    const idKeys = Object.keys(dictionaries.id);
    expect(enKeys.sort()).toEqual(idKeys.sort());
  });

  it("interpolates template variables correctly", () => {
    const str = t("en", "shotsLeft", { n: 12 });
    expect(str).toBe("12 left");

    const strId = t("id", "shotsLeft", { n: 12 });
    expect(strId).toBe("Sisa 12");
  });
});
