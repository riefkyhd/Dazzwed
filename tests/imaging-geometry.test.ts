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
});

