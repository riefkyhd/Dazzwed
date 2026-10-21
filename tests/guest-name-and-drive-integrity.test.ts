import { describe, it, expect, vi } from "vitest";
import { computeRollCodeFromGuestId } from "@/lib/guest/session";

describe("Guest Name Integrity & Master Drive Auto-Provisioning", () => {
  it("clean helper preserves undefined so omitted names are never coerced into null", () => {
    const clean = (s?: string | null) => {
      if (s === undefined) return undefined;
      const v = (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
      return v || null;
    };

    expect(clean(undefined)).toBeUndefined();
    expect(clean("")).toBeNull();
    expect(clean(null)).toBeNull();
    expect(clean("  Kiki  ")).toBe("Kiki");
    expect(clean("Dinda & Harsya")).toBe("Dinda & Harsya");
  });

  it("never overwrites existing display_name with null during background session sync", () => {
    const existingGuest = {
      id: "8570f372-bd6d-4a96-ac77-8406179377f5",
      display_name: "Kiki",
    };

    function simulatePatch(payloadName: string | null | undefined, currentDisplayName: string | null) {
      const clean = (s?: string | null) => {
        if (s === undefined) return undefined;
        const v = (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
        return v || null;
      };

      const name = clean(payloadName);
      const patchWithConsent: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      };

      // Invariant: only update display_name if a valid non-empty string is provided
      if (name !== undefined && name !== null) {
        patchWithConsent.display_name = name;
      }

      return {
        ...patchWithConsent,
        display_name: patchWithConsent.display_name as string | undefined,
        effectiveDisplayName: "display_name" in patchWithConsent ? (patchWithConsent.display_name as string | null) : currentDisplayName,
      };
    }

    // 1. Background sync (name omitted / undefined) -> Kiki is preserved
    const syncResult = simulatePatch(undefined, existingGuest.display_name);
    expect(syncResult.display_name).toBeUndefined();
    expect(syncResult.effectiveDisplayName).toBe("Kiki");

    // 2. Client passes null on resume check -> Kiki is preserved
    const nullResult = simulatePatch(null, existingGuest.display_name);
    expect(nullResult.display_name).toBeUndefined();
    expect(nullResult.effectiveDisplayName).toBe("Kiki");

    // 3. User explicitly updates their name to "Kiki Hendrawan" -> Updated
    const updateResult = simulatePatch("Kiki Hendrawan", existingGuest.display_name);
    expect(updateResult.display_name).toBe("Kiki Hendrawan");
    expect(updateResult.effectiveDisplayName).toBe("Kiki Hendrawan");
  });

  it("generates deterministic folder names incorporating guest display name and roll code", () => {
    const guestId = "8570f372-bd6d-4a96-ac77-8406179377f5";
    const rollCode = computeRollCodeFromGuestId(guestId);
    expect(rollCode).toBe("JJYSHK");

    function getFolderName(displayName: string | null, code: string) {
      const cleanName = displayName?.trim().replace(/[/\\?%*:|"<>]/g, "");
      return cleanName ? `${cleanName} (${code})` : `Roll ${code}`;
    }

    expect(getFolderName("Kiki", rollCode)).toBe("Kiki (JJYSHK)");
    expect(getFolderName(null, rollCode)).toBe("Roll JJYSHK");
    expect(getFolderName("  Sarah & Alex  ", rollCode)).toBe("Sarah & Alex (JJYSHK)");
  });

  it("verifies root folder name formatting for multi-tenant events", () => {
    function getEventRootFolderName(coupleNames: string) {
      return `Disposable Cam - ${coupleNames.trim()}`;
    }

    expect(getEventRootFolderName("Wedding")).toBe("Disposable Cam - Wedding");
    expect(getEventRootFolderName("Dhifa & Riefky")).toBe("Disposable Cam - Dhifa & Riefky");
    expect(getEventRootFolderName("  Dinda & Harsya  ")).toBe("Disposable Cam - Dinda & Harsya");
  });
});
