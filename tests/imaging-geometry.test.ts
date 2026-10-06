import { describe, expect, it } from "vitest";
import { fitLongestEdge, cropForAspectAndZoom, MAX_EDGE } from "@/lib/imaging/geometry";

describe("imaging geometry", () => {
  it("keeps or scales down large 4K portrait orientation to max edge 4096", () => {
    const res = fitLongestEdge(2160, 3840, MAX_EDGE);
    expect(res.height).toBe(3840);
    expect(res.width).toBe(2160);
  });

  it("scales down large 12MP photo (4032x3024) within max edge 4096", () => {
    const res = fitLongestEdge(4032, 3024, MAX_EDGE);
    expect(res.width).toBe(4032);
    expect(res.height).toBe(3024);
  });

  it("never upscales smaller photos", () => {
    const res = fitLongestEdge(800, 600, MAX_EDGE);
    expect(res.width).toBe(800);
    expect(res.height).toBe(600);
  });

  it("computes center crop for 1x and 2x digital zoom on 3:4 portrait sensor", () => {
    const crop1x = cropForAspectAndZoom(1080, 1440, "3:4", 1);
    expect(crop1x).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1440 });

    const crop2x = cropForAspectAndZoom(1080, 1440, "3:4", 2);
    expect(crop2x.sw).toBe(540);
    expect(crop2x.sh).toBe(720);
    expect(crop2x.sx).toBe(270);
    expect(crop2x.sy).toBe(360);
  });

  describe("base 4:3 sensor crop model", () => {
    // 12MP 4:3 sensor in portrait orientation (3024 x 4032)
    const w = 3024;
    const h = 4032;

    it("3:4 displays the complete 100% sensor frame", () => {
      const crop = cropForAspectAndZoom(w, h, "3:4", 1);
      expect(crop).toEqual({ sx: 0, sy: 0, sw: 3024, sh: 4032 });
    });

    it("9:16 keeps full height, crops width tighter (sides cropped)", () => {
      const crop = cropForAspectAndZoom(w, h, "16:9", 1);
      expect(crop.sh).toBe(4032);
      expect(crop.sw).toBe(Math.round((4032 * 9) / 16)); // 2268
      expect(crop.sw).toBeLessThan(3024);
      expect(crop.sx).toBe(Math.round((3024 - 2268) / 2)); // 378
      expect(crop.sy).toBe(0);
    });

    it("1:1 keeps full width, crops height tighter (top/bottom cropped)", () => {
      const crop = cropForAspectAndZoom(w, h, "1:1", 1);
      expect(crop.sw).toBe(3024);
      expect(crop.sh).toBe(3024);
      expect(crop.sh).toBeLessThan(4032);
      expect(crop.sx).toBe(0);
      expect(crop.sy).toBe(Math.round((4032 - 3024) / 2)); // 504
    });

    it("strictly ensures 9:16 and 1:1 are subsets of 3:4 (never expands or reveals outside 3:4)", () => {
      const c34 = cropForAspectAndZoom(w, h, "3:4", 1);
      const c916 = cropForAspectAndZoom(w, h, "16:9", 1);
      const c11 = cropForAspectAndZoom(w, h, "1:1", 1);

      // Area of 3:4 > 9:16 and 3:4 > 1:1
      expect(c34.sw * c34.sh).toBeGreaterThan(c916.sw * c916.sh);
      expect(c34.sw * c34.sh).toBeGreaterThan(c11.sw * c11.sh);

      // 9:16 is contained inside 3:4 bounds
      expect(c916.sx).toBeGreaterThanOrEqual(c34.sx);
      expect(c916.sy).toBeGreaterThanOrEqual(c34.sy);
      expect(c916.sx + c916.sw).toBeLessThanOrEqual(c34.sx + c34.sw);
      expect(c916.sy + c916.sh).toBeLessThanOrEqual(c34.sy + c34.sh);

      // 1:1 is contained inside 3:4 bounds
      expect(c11.sx).toBeGreaterThanOrEqual(c34.sx);
      expect(c11.sy).toBeGreaterThanOrEqual(c34.sy);
      expect(c11.sx + c11.sw).toBeLessThanOrEqual(c34.sx + c34.sw);
      expect(c11.sy + c11.sh).toBeLessThanOrEqual(c34.sy + c34.sh);
    });

    it("adapts correctly to landscape 4:3 sensor (4032 x 3024)", () => {
      const lw = 4032;
      const lh = 3024;
      const c43 = cropForAspectAndZoom(lw, lh, "4:3", 1);
      expect(c43).toEqual({ sx: 0, sy: 0, sw: 4032, sh: 3024 });

      const c169 = cropForAspectAndZoom(lw, lh, "16:9", 1);
      expect(c169.sw).toBe(4032);
      expect(c169.sh).toBe(Math.round((4032 * 9) / 16)); // 2268
      expect(c169.sh).toBeLessThan(3024);
      expect(c169.sy).toBe(Math.round((3024 - 2268) / 2));
    });

    it("gracefully extracts 4:3 base frame if driver only returns 16:9 stream (1080x1920)", () => {
      const streamW = 1080;
      const streamH = 1920;
      // In 16:9 portrait, base 3:4 frame crops height to 1440
      const c34 = cropForAspectAndZoom(streamW, streamH, "3:4", 1);
      expect(c34.sw).toBe(1080);
      expect(c34.sh).toBe(1440);
      expect(c34.sy).toBe(240); // (1920 - 1440) / 2

      // 9:16 inside that base frame has narrower width
      const c916 = cropForAspectAndZoom(streamW, streamH, "16:9", 1);
      expect(c916.sh).toBe(1440);
      expect(c916.sw).toBe(Math.round((1440 * 9) / 16)); // 810
      expect(c916.sx).toBe(Math.round((1080 - 810) / 2)); // 135
    });
  });
});

