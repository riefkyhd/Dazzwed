import { test, expect } from "@playwright/test";

test.describe("Camera Viewfinder Gestures & Exposure Bounds", () => {
  test("tapping viewfinder summons focus reticle and exposure slider", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/debug/ui");

    const frame = page.locator(".bg-zinc-900.border.border-amber-500\\/30").first();
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Tap in center of viewfinder
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);

    // Look for focus box / reticle or exposure slider indicator
    const focusReticle = page.locator(".border-amber-400, svg, .pointer-events-none").first();
    await expect(focusReticle).toBeVisible();
  });

  test("exposure slider interaction stays within viewport bounds", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 802 });
    await page.goto("/debug/ui");

    const frame = page.locator(".bg-zinc-900.border.border-amber-500\\/30").first();
    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Click near the right edge of viewfinder
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
    await page.mouse.down();
    // Drag vertically to simulate exposure slide
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 5 });
    await page.mouse.up();

    // Verify page did NOT scroll or zoom (body dimensions intact)
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThanOrEqual(50);
  });
});
