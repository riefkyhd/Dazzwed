import { test, expect } from "@playwright/test";

test.describe("Camera Viewport & Layout Matrix", () => {
  const PRESET_NAMES = [
    { name: "iPhone SE (compact 320x568)", idx: 0, expectedMode: "portrait" },
    { name: "iPhone 8/Standard (375x667)", idx: 1, expectedMode: "portrait" },
    { name: "iPhone 13/14 Pro (390x844)", idx: 2, expectedMode: "portrait" },
    { name: "iPhone 15/16 Pro Max (430x932)", idx: 3, expectedMode: "portrait" },
    { name: "Galaxy S24 (20:9 412x915)", idx: 4, expectedMode: "portrait" },
    { name: "Landscape Phone (844x390)", idx: 5, expectedMode: "landscape" },
    { name: "Tablet Portrait (768x1024)", idx: 6, expectedMode: "portrait" },
  ];

  for (const preset of PRESET_NAMES) {
    test(`renders camera layout correctly for ${preset.name}`, async ({ page }) => {
      await page.goto("/debug/ui");

      // Select preset from Device dropdown
      const deviceSelect = page.locator("select").first();
      await deviceSelect.selectOption(String(preset.idx));
      await page.waitForTimeout(100);

      // Verify simulated viewfinder frame is rendered
      const frame = page.locator(".bg-zinc-900.border.border-amber-500\\/30").first();
      await expect(frame).toBeVisible();

      const box = await frame.boundingBox();
      expect(box).not.toBeNull();
      if (box && box.width > 0 && box.height > 0) {
        if (preset.expectedMode === "portrait") {
          const ratio = box.width / box.height;
          // In 3:4 full portrait mode, aspect ratio is 0.75 ± 0.05
          expect(ratio).toBeGreaterThanOrEqual(0.70);
          expect(ratio).toBeLessThanOrEqual(0.80);
        }
      }

      // Verify shutter button is present
      const shutter = page.locator("button[aria-label*='photo' i], button[aria-label*='foto' i]").first();
      await expect(shutter).toBeVisible();
    });
  }

  test("supports aspect ratio switching: 3:4, 1:1, 16:9", async ({ page }) => {
    await page.goto("/debug/ui");

    const aspectSelect = page.locator("select").nth(1);

    // Switch to 1:1
    await aspectSelect.selectOption("1:1");
    await page.waitForTimeout(100);
    const frame1 = page.locator(".bg-zinc-900.border.border-amber-500\\/30").first();
    const box1 = await frame1.boundingBox();
    if (box1) {
      const ratio = box1.width / box1.height;
      expect(Math.abs(ratio - 1.0)).toBeLessThan(0.05);
    }

    // Switch to 16:9
    await aspectSelect.selectOption("16:9");
    await page.waitForTimeout(100);
    const frame2 = page.locator(".bg-zinc-900.border.border-amber-500\\/30").first();
    const box2 = await frame2.boundingBox();
    if (box2) {
      const ratio = box2.width / box2.height;
      expect(Math.abs(ratio - 9 / 16)).toBeLessThan(0.05);
    }

    // Switch back to 3:4
    await aspectSelect.selectOption("3:4");
    await page.waitForTimeout(100);
    const frame3 = page.locator(".bg-zinc-900.border.border-amber-500\\/30").first();
    const box3 = await frame3.boundingBox();
    if (box3) {
      const ratio = box3.width / box3.height;
      expect(Math.abs(ratio - 0.75)).toBeLessThan(0.05);
    }
  });

  test("supports English and Indonesian (i18n)", async ({ page }) => {
    await page.goto("/debug/ui");

    // Lang select is 3rd select
    const langSelect = page.locator("select").nth(2);

    // Indonesian
    await langSelect.selectOption("id");
    await page.waitForTimeout(100);
    const counterId = page.locator("text=Sisa 12");
    await expect(counterId).toBeVisible();

    // English
    await langSelect.selectOption("en");
    await page.waitForTimeout(100);
    const counterEn = page.locator("text=12 left");
    await expect(counterEn).toBeVisible();
  });
});
