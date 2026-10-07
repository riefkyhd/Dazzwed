import { describe, it, expect } from "vitest";
import { calculateLayout, type ViewportLayout } from "@/lib/camera/useViewportLayout";
import type { CameraAspect } from "@/lib/imaging/geometry";

describe("Camera Viewport Layout Engine", () => {
  const viewports = [
    { name: "Android Chrome (toolbar visible)", w: 412, h: 802, safe: { top: 0, bottom: 0, left: 0, right: 0 } },
    { name: "Android Chrome (toolbar hidden)", w: 412, h: 858, safe: { top: 0, bottom: 0, left: 0, right: 0 } },
    { name: "iPhone 13/14 Pro", w: 390, h: 844, safe: { top: 47, bottom: 34, left: 0, right: 0 } },
    { name: "iPhone 15/16 Pro Max", w: 430, h: 932, safe: { top: 59, bottom: 34, left: 0, right: 0 } },
    { name: "Budget Android (compact)", w: 360, h: 640, safe: { top: 24, bottom: 0, left: 0, right: 0 } },
    { name: "iPhone SE (compact)", w: 375, h: 667, safe: { top: 20, bottom: 0, left: 0, right: 0 } },
    { name: "Galaxy S24 (20:9 tall)", w: 412, h: 915, safe: { top: 32, bottom: 16, left: 0, right: 0 } },
    { name: "iPad Portrait", w: 768, h: 1024, safe: { top: 24, bottom: 20, left: 0, right: 0 } },
    { name: "Desktop Wide", w: 1200, h: 900, safe: { top: 0, bottom: 0, left: 0, right: 0 } },
  ];

  const aspects: CameraAspect[] = ["3:4", "1:1", "16:9"];

  for (const vp of viewports) {
    for (const asp of aspects) {
      it(`computes valid non-NaN geometry and strict bounds for ${vp.name} with aspect ${asp}`, () => {
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

        // Frame aspect ratio precision checks
        const measuredRatio = layout.viewfinderRect.width / layout.viewfinderRect.height;
        if (!layout.isLandscape) {
          if (asp === "3:4") {
            expect(Math.abs(measuredRatio - 0.75)).toBeLessThan(0.006);
          } else if (asp === "1:1") {
            expect(Math.abs(measuredRatio - 1.0)).toBeLessThan(0.005);
          } else if (asp === "16:9") {
            expect(Math.abs(measuredRatio - 9 / 16)).toBeLessThan(0.01);
          }
        }

        // NO INTERSECTION: in portrait banded mode, top bar must not overlap the viewfinder
        if (!layout.isLandscape && layout.mode === "banded") {
          expect(layout.viewfinderRect.top).toBeGreaterThanOrEqual(layout.topBarHeight);
        }
      });
    }
  }

  it("assigns appropriate density level for reference viewports", () => {
    // 412x802 Android Chrome toolbar visible has ~201px bottom space => L0
    const l412x802 = calculateLayout(412, 802, "3:4", { top: 0, bottom: 0, left: 0, right: 0 });
    expect(l412x802.density).toBe("L0");

    // 412x858 Android Chrome toolbar hidden has ~257px bottom space => L0
    const l412x858 = calculateLayout(412, 858, "3:4", { top: 0, bottom: 0, left: 0, right: 0 });
    expect(l412x858.density).toBe("L0");

    // 390x844 iPhone 14 Pro has ~225px bottom space => L0
    const l390x844 = calculateLayout(390, 844, "3:4", { top: 47, bottom: 34, left: 0, right: 0 });
    expect(l390x844.density).toBe("L0");

    // 360x640 Budget Android has ~108px bottom space => L2
    const l360x640 = calculateLayout(360, 640, "3:4", { top: 0, bottom: 0, left: 0, right: 0 });
    expect(l360x640.density).toBe("L2");
  });

  it("handles landscape orientation with right-hand side rail", () => {
    const layout = calculateLayout(844, 390, "3:4", { top: 0, bottom: 0, left: 47, right: 34 });
    expect(layout.isLandscape).toBe(true);
    expect(layout.viewfinderRect.width).toBeGreaterThan(0);
    expect(layout.viewfinderRect.height).toBeGreaterThan(0);
    expect(layout.bottomBarHeight).toBeGreaterThanOrEqual(96);
    expect(layout.viewfinderRect.left + layout.viewfinderRect.width).toBeLessThanOrEqual(844 - 96 + 1);
  });

  it("chooses full-bleed mode for 16:9 aspect on modern tall smartphones", () => {
    const layout = calculateLayout(390, 844, "16:9", { top: 47, bottom: 34, left: 0, right: 0 });
    expect(layout.mode).toBe("full-bleed");
    expect(layout.viewfinderRect.height).toBeGreaterThan(680);
  });

  it("chooses banded mode for 3:4 and 1:1 when there is sufficient room", () => {
    const layout = calculateLayout(390, 844, "3:4", { top: 47, bottom: 34, left: 0, right: 0 });
    expect(layout.mode).toBe("banded");
  });
});
