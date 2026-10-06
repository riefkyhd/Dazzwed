import { describe, it, expect } from "vitest";
import {
  clampEV,
  calculateTrackHeight,
  evToSunOffset,
  pointerDeltaToEV,
  calculateFocusAnchor,
  EV_MIN,
  EV_MAX,
  EV_DEFAULT,
} from "@/lib/camera/exposure-slider";

describe("Exposure Slider Math & Mapping", () => {
  describe("clampEV", () => {
    it("handles standard in-range values without distortion", () => {
      expect(clampEV(0)).toBe(0);
      expect(clampEV(1.2)).toBe(1.2);
      expect(clampEV(-1.5)).toBe(-1.5);
    });

    it("clamps out-of-range positive values to +2.0", () => {
      expect(clampEV(2.5)).toBe(EV_MAX);
      expect(clampEV(100)).toBe(EV_MAX);
      expect(clampEV(Infinity)).toBe(EV_MAX);
    });

    it("clamps out-of-range negative values to -2.0", () => {
      expect(clampEV(-2.1)).toBe(EV_MIN);
      expect(clampEV(-50)).toBe(EV_MIN);
      expect(clampEV(-Infinity)).toBe(EV_MIN);
    });

    it("safely recovers from NaN and non-numbers to default 0.0", () => {
      expect(clampEV(NaN)).toBe(EV_DEFAULT);
      // @ts-expect-error test invalid input runtime
      expect(clampEV(null)).toBe(EV_DEFAULT);
      // @ts-expect-error test invalid input runtime
      expect(clampEV(undefined)).toBe(EV_DEFAULT);
    });
  });

  describe("calculateTrackHeight", () => {
    it("clamps height between 96px and 140px", () => {
      // Small screen: 400px * 0.16 = 64px -> clamped to 96px
      expect(calculateTrackHeight(400)).toBe(96);

      // Mid screen: 700px * 0.16 = 112px
      expect(calculateTrackHeight(700)).toBe(112);

      // Large screen: 1200px * 0.16 = 192px -> clamped to 140px
      expect(calculateTrackHeight(1200)).toBe(140);
    });
  });

  describe("evToSunOffset", () => {
    const trackHeight = 100; // halfTrack = 50

    it("positions at center (offset 0) at 0 EV", () => {
      expect(evToSunOffset(0, trackHeight)).toBe(0);
    });

    it("positions at top (-halfTrack) at +2.0 EV", () => {
      expect(evToSunOffset(2.0, trackHeight)).toBe(-50);
    });

    it("positions at bottom (+halfTrack) at -2.0 EV", () => {
      expect(evToSunOffset(-2.0, trackHeight)).toBe(50);
    });

    it("never allows sun offset to exceed halfTrack bounds even with extreme input", () => {
      const topExtreme = evToSunOffset(999, trackHeight);
      const btmExtreme = evToSunOffset(-999, trackHeight);
      expect(topExtreme).toBe(-50);
      expect(btmExtreme).toBe(50);
    });
  });

  describe("pointerDeltaToEV", () => {
    const trackHeight = 100;

    it("dragging upward increases EV", () => {
      // deltaY = -50 (upward half-track) -> +1.0 EV
      const ev = pointerDeltaToEV(0, -50, trackHeight);
      expect(ev).toBe(1.0);
    });

    it("dragging downward decreases EV", () => {
      // deltaY = +50 (downward half-track) -> -1.0 EV
      const ev = pointerDeltaToEV(0, 50, trackHeight);
      expect(ev).toBe(-1.0);
    });

    it("clamps to -2.0 and +2.0 when dragged across full screen", () => {
      // Dragging down 500px from 0 EV
      expect(pointerDeltaToEV(0, 500, trackHeight)).toBe(-2.0);
      // Dragging up 500px from 0 EV
      expect(pointerDeltaToEV(0, -500, trackHeight)).toBe(2.0);
    });
  });

  describe("calculateFocusAnchor", () => {
    const vfWidth = 360;
    const vfHeight = 640;

    it("places track on right when tapped in center", () => {
      const anchor = calculateFocusAnchor(180, 320, vfWidth, vfHeight);
      expect(anchor.trackSide).toBe("right");
      expect(anchor.ringX).toBe(180);
      expect(anchor.ringY).toBe(320);
    });

    it("flips track to left when tapped close to right edge", () => {
      // Near right margin: tap at 340px
      const anchor = calculateFocusAnchor(340, 320, vfWidth, vfHeight);
      expect(anchor.trackSide).toBe("left");
      // Clamped inside safe boundary
      expect(anchor.ringX).toBeLessThanOrEqual(vfWidth - 12 - 32);
    });

    it("clamps ring Y so track never clips top or bottom", () => {
      // Tap very close to top (Y = 10)
      const topAnchor = calculateFocusAnchor(180, 10, vfWidth, vfHeight);
      const halfTrack = topAnchor.trackHeight / 2;
      expect(topAnchor.ringY - halfTrack).toBeGreaterThanOrEqual(12);

      // Tap very close to bottom (Y = 635)
      const btmAnchor = calculateFocusAnchor(180, 635, vfWidth, vfHeight);
      expect(btmAnchor.ringY + halfTrack).toBeLessThanOrEqual(vfHeight - 12);
    });
  });
});
