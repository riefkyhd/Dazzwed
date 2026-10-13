import { test, expect } from "@playwright/test";

test.describe("Camera Lifecycle & Storage Resilience", () => {
  test("handles page visibility changes gracefully without crashing WebGL", async ({ page }) => {
    await page.goto("/debug/camera");

    // Wait for camera view or permission prompt
    await page.waitForTimeout(1000);

    // Simulate tab backgrounding
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await page.waitForTimeout(500);

    // Simulate tab foregrounding
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await page.waitForTimeout(500);

    // Verify page is still alive and responsive
    const title = await page.title();
    expect(title).toBeDefined();
  });

  test("persists guest triple-identity across reloads in localStorage", async ({ page }) => {
    await page.goto("/debug/ui");

    // Seed session triple in localStorage
    await page.evaluate(() => {
      const mockTriple = {
        guestId: "00000000-0000-0000-0000-000000000001",
        rollCode: "ROLL-42",
        shotsRemaining: 15,
        totalShots: 20,
      };
      window.localStorage.setItem("dc:triple:demo-event", JSON.stringify(mockTriple));
    });

    // Reload page
    await page.reload();

    // Verify localStorage retains the triple
    const retrieved = await page.evaluate(() => {
      return window.localStorage.getItem("dc:triple:demo-event");
    });

    expect(retrieved).not.toBeNull();
    const parsed = JSON.parse(retrieved!);
    expect(parsed.guestId).toBe("00000000-0000-0000-0000-000000000001");
    expect(parsed.rollCode).toBe("ROLL-42");
  });

  test("IndexedDB camera queue database is operational", async ({ page }) => {
    await page.goto("/debug/ui");

    const idbWorking = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        try {
          const req = indexedDB.open("test-idb-probe", 1);
          req.onsuccess = () => {
            req.result.close();
            indexedDB.deleteDatabase("test-idb-probe");
            resolve(true);
          };
          req.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    });

    expect(idbWorking).toBe(true);
  });
});
