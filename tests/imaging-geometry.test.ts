import { describe, expect, it } from "vitest";
import { fitLongestEdge, cropForZoom, MAX_EDGE } from "@/lib/imaging/geometry";

describe("imaging geometry", () => {
  it("scales down large 4K portrait orientation to max edge 1920", () => {
    const res = fitLongestEdge(2160, 3840, MAX_EDGE);
    expect(res.height).toBe(1920);
    expect(res.width).toBe(1080);
  });

  it("scales down large 12MP photo (4032x3024) to max edge 1920", () => {
    const res = fitLongestEdge(4032, 3024, MAX_EDGE);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1440);
  });

  it("never upscales smaller photos", () => {
    const res = fitLongestEdge(800, 600, MAX_EDGE);
    expect(res.width).toBe(800);
    expect(res.height).toBe(600);
  });

  it("computes center crop for 1x and 2x digital zoom correctly", () => {
    const crop1x = cropForZoom(1920, 1080, 1);
    expect(crop1x).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });

    const crop2x = cropForZoom(1920, 1080, 2);
    expect(crop2x.sw).toBe(960);
    expect(crop2x.sh).toBe(540);
    expect(crop2x.sx).toBe(480);
    expect(crop2x.sy).toBe(270);
  });
});
