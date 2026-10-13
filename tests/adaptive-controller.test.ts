import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AdaptivePerformanceController,
  resolveInitialPerfMode,
  resolveInitialTier,
  savePerfPreferences,
  TIER_CONFIGS,
  QualityTier,
} from "../src/lib/camera/adaptive-controller";

describe("AdaptivePerformanceController & Tier Ladder", () => {
  beforeEach(() => {
    // Reset window.location and localStorage
    const mockStorage: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      },
    });

    vi.stubGlobal("window", {
      location: { search: "" },
      localStorage: globalThis.localStorage,
    });
  });

  describe("Tier Config Specifications", () => {
    it("defines Tiers A-D according to MASTER_PROMPT specification", () => {
      expect(TIER_CONFIGS.A).toMatchObject({
        tier: "A",
        previewLongEdge: 1280,
        animatedGrain: true,
        grainTickHz: 24,
        bloomResolutionFactor: 1.0,
      });

      expect(TIER_CONFIGS.B).toMatchObject({
        tier: "B",
        previewLongEdge: 960,
        animatedGrain: true,
        grainTickHz: 24,
        bloomResolutionFactor: 1.0,
      });

      expect(TIER_CONFIGS.C).toMatchObject({
        tier: "C",
        previewLongEdge: 720,
        animatedGrain: false,
        grainTickHz: 0,
        bloomResolutionFactor: 0.5,
      });

      expect(TIER_CONFIGS.D).toMatchObject({
        tier: "D",
        previewLongEdge: 640,
        animatedGrain: false,
        grainTickHz: 0,
        bloomResolutionFactor: 0.0,
      });
    });
  });

  describe("Initial Resolution & URL overrides", () => {
    it("resolves default mode to 'auto' and default tier to 'A'", () => {
      expect(resolveInitialPerfMode()).toBe("auto");
      expect(resolveInitialTier("auto")).toBe("A");
    });

    it("respects quality and smooth mode overrides", () => {
      expect(resolveInitialTier("quality")).toBe("A");
      expect(resolveInitialTier("smooth")).toBe("C");
    });

    it("respects ?perf= query parameter", () => {
      window.location.search = "?perf=quality";
      expect(resolveInitialPerfMode()).toBe("quality");

      window.location.search = "?perf=smooth";
      expect(resolveInitialPerfMode()).toBe("smooth");
    });

    it("respects ?tier= query parameter", () => {
      window.location.search = "?tier=B";
      expect(resolveInitialTier("auto")).toBe("B");

      window.location.search = "?tier=D";
      expect(resolveInitialTier("auto")).toBe("D");
    });

    it("falls back to localStorage if URL parameter is absent", () => {
      localStorage.setItem("dc:perf_mode", "smooth");
      localStorage.setItem("dc:perf_tier", "C");

      expect(resolveInitialPerfMode()).toBe("smooth");
      expect(resolveInitialTier("auto")).toBe("C");
    });

    it("persists preferences with savePerfPreferences", () => {
      savePerfPreferences("quality", "A");
      expect(localStorage.getItem("dc:perf_mode")).toBe("quality");
      expect(localStorage.getItem("dc:perf_tier")).toBe("A");
    });
  });

  describe("Hysteresis & Adaptive Loop", () => {
    it("initializes with requested mode and tier", () => {
      const controller = new AdaptivePerformanceController("auto", "A");
      expect(controller.getMode()).toBe("auto");
      expect(controller.getTier()).toBe("A");
      expect(controller.getConfig().previewLongEdge).toBe(1280);
    });

    it("does not downgrade on brief frame-time spike (< 2000ms sustain)", () => {
      const controller = new AdaptivePerformanceController("auto", "A");
      const baseNow = 10000;

      // Spike to 50ms (20 fps) for 1000ms
      for (let t = 0; t <= 1000; t += 50) {
        controller.recordFrame(50, baseNow + t);
      }

      // Should still be Tier A because sustain requirement is >= 2000ms
      expect(controller.getTier()).toBe("A");
    });

    it("downgrades after sustained p95 frame time > 41.6ms for >= 2000ms", () => {
      let changedTier: QualityTier | null = null;
      const controller = new AdaptivePerformanceController("auto", "A", (t) => {
        changedTier = t;
      });

      const baseNow = 10000;

      // Sustained 50ms frames for 2100ms
      for (let t = 0; t <= 2100; t += 50) {
        controller.recordFrame(50, baseNow + t);
      }

      expect(controller.getTier()).toBe("B");
      expect(changedTier).toBe("B");
    });

    it("progressively steps down to D under continued load", () => {
      const controller = new AdaptivePerformanceController("auto", "A");
      let now = 10000;

      // First downgrade A -> B (2100ms sustained)
      for (let t = 0; t <= 2100; t += 50) {
        controller.recordFrame(50, now + t);
      }
      expect(controller.getTier()).toBe("B");
      now += 2200;

      // Second downgrade B -> C (2100ms sustained)
      for (let t = 0; t <= 2100; t += 50) {
        controller.recordFrame(50, now + t);
      }
      expect(controller.getTier()).toBe("C");
      now += 2200;

      // Third downgrade C -> D (2100ms sustained)
      for (let t = 0; t <= 2100; t += 50) {
        controller.recordFrame(50, now + t);
      }
      expect(controller.getTier()).toBe("D");
    });

    it("upgrades tier only after sustained headroom for >= 10000ms", () => {
      const controller = new AdaptivePerformanceController("auto", "C");
      const now = 10000;

      // Run 20ms frames (50 fps) for 5000ms -> should NOT upgrade yet
      for (let t = 0; t <= 5000; t += 20) {
        controller.recordFrame(20, now + t);
      }
      expect(controller.getTier()).toBe("C");

      // Continue for another 5500ms (total > 10000ms)
      for (let t = 5020; t <= 10200; t += 20) {
        controller.recordFrame(20, now + t);
      }
      expect(controller.getTier()).toBe("B");
    });

    it("FREEZES tier changes while isCapturing is true", () => {
      const controller = new AdaptivePerformanceController("auto", "A");
      const baseNow = 10000;

      // Sustained slow frames but during capture
      for (let t = 0; t <= 3000; t += 50) {
        controller.recordFrame(50, baseNow + t, /* isCapturing */ true, /* isGesturing */ false);
      }

      // Tier must remain A
      expect(controller.getTier()).toBe("A");
    });

    it("FREEZES tier changes while isGesturing is true (pinch/zoom/exposure)", () => {
      const controller = new AdaptivePerformanceController("auto", "A");
      const baseNow = 10000;

      // Sustained slow frames but during user gesture
      for (let t = 0; t <= 3000; t += 50) {
        controller.recordFrame(50, baseNow + t, /* isCapturing */ false, /* isGesturing */ true);
      }

      // Tier must remain A
      expect(controller.getTier()).toBe("A");
    });

    it("locks tier when user selects explicit PerformanceMode quality or smooth", () => {
      const controller = new AdaptivePerformanceController("auto", "B");
      controller.setMode("quality");
      expect(controller.getTier()).toBe("A");

      // Under severe load, quality mode stays locked at A
      const baseNow = 10000;
      for (let t = 0; t <= 3000; t += 60) {
        controller.recordFrame(60, baseNow + t);
      }
      expect(controller.getTier()).toBe("A");

      controller.setMode("smooth");
      expect(controller.getTier()).toBe("C");
    });
  });
});
