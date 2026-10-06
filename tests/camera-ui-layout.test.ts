import { describe, it, expect } from "vitest";
import { calculateLayout, type ViewportLayout } from "@/lib/camera/useViewportLayout";
import type { CameraAspect } from "@/lib/imaging/geometry";

describe("Camera Viewport Layout Engine", () => {
  const viewports = [
    { name: "iPhone SE (compact)", w: 320, h: 568, safe: { top: 20, bottom: 0, left: 0, right: 0 } },
    { name: "iPhone 8/Standard", w: 375, h: 667, safe: { top: 20, bottom: 0, left: 0, right: 0 } },
    { name: "iPhone 13/14 Pro", w: 390, h: 844, safe: { top: 47, bottom: 34, left: 0, right: 0 } },
    { name: "iPhone 15/16 Pro Max", w: 430, h: 932, safe: { top: 59, bottom: 34, left: 0, right: 0 } },
    { name: "Galaxy S24 (20:9 tall)", w: 412, h: 915, safe: { top: 32, bottom: 16, left: 0, right: 0 } },
    { name: "iPad Portrait", w: 768, h: 1024, safe: { top: 24, bottom: 20, left: 0, right: 0 } },
    { name: "Desktop Wide", w: 1200, h: 900, safe: { top: 0, bottom: 0, left: 0, right: 0 } },
  ];

  const aspects: CameraAspect[] = ["3:4", "1:1", "16:9"];

  for (const vp of viewports) {
    for (const asp of aspects) {
      it(`computes valid non-NaN geometry for ${vp.name} with aspect ${asp}`, () => {
        const layout: ViewportLayout = calculateLayout(vp.w, vp.h, asp, vp.safe);

        expect(layout.width).toBe(vp.w);
        expect(layout.height).toBe(vp.h);

        // Viewfinder bounds must be non-negative and finite
        expect(Number.isFinite(layout.viewfinderRect.width)).toBe(true);
        expect(Number.isFinite(layout.viewfinderRect.height)).toBe(true);
        expect(Number.isFinite(layout.viewfinderRect.top)).toBe(true);
        expect(Number.isFinite(layout.viewfinderRect.left)).toBe(true);

        expect(layout.viewfinderRect.width).toBeGreaterThan(0);
        expect(layout.viewfinderRect.height).toBeGreaterThan(0);
        expect(layout.viewfinderRect.top).toBeGreaterThanOrEqual(0);
        expect(layout.viewfinderRect.left).toBeGreaterThanOrEqual(0);

        // Viewfinder must fit inside total viewport
        expect(layout.viewfinderRect.left + layout.viewfinderRect.width).toBeLessThanOrEqual(vp.w + 1);
        expect(layout.viewfinderRect.top + layout.viewfinderRect.height).toBeLessThanOrEqual(vp.h + 1);

        // Control bands must reserve required minimums
        if (!layout.isLandscape) {
          expect(layout.topBarHeight).toBeGreaterThanOrEqual(50);
          expect(layout.bottomBarHeight).toBeGreaterThanOrEqual(140);
        } else {
          expect(layout.bottomBarHeight).toBeGreaterThanOrEqual(90);
        }
      });
    }
  }

  it("handles landscape orientation with right-hand side rail", () => {
    const layout = calculateLayout(844, 390, "3:4", { top: 0, bottom: 0, left: 47, right: 34 });
    expect(layout.isLandscape).toBe(true);
    expect(layout.viewfinderRect.width).toBeGreaterThan(0);
    expect(layout.viewfinderRect.height).toBeGreaterThan(0);
    // Rail width is assigned to bottomBarHeight in landscape
    expect(layout.bottomBarHeight).toBe(100);
    expect(layout.viewfinderRect.left + layout.viewfinderRect.width).toBeLessThanOrEqual(844 - 100 + 1);
  });

  it("chooses full-bleed mode for 16:9 aspect on modern tall smartphones", () => {
    // iPhone 14 Pro aspect 390x844 with aspect 16:9 (390 * 16/9 = 693.3px)
    const layout = calculateLayout(390, 844, "16:9", { top: 47, bottom: 34, left: 0, right: 0 });
    expect(layout.mode).toBe("full-bleed");
    expect(layout.viewfinderRect.height).toBeGreaterThan(680);
  });

  it("chooses banded mode for 3:4 and 1:1 when there is sufficient room", () => {
    const layout = calculateLayout(390, 844, "3:4", { top: 47, bottom: 34, left: 0, right: 0 });
    expect(layout.mode).toBe("banded");
  });
});
