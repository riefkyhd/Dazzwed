import { describe, it, expect, vi } from "vitest";
import { pulseTorch } from "@/lib/camera/caps";

type TorchConstraint = MediaTrackConstraints & { advanced?: Array<{ torch?: boolean }> };

describe("Flash & Torch Pulse Resilience", () => {
  it("guarantees turning torch ON before capture and turning it OFF immediately afterwards", async () => {
    const appliedConstraints: TorchConstraint[] = [];
    const mockTrack = {
      applyConstraints: vi.fn(async (c: TorchConstraint) => {
        appliedConstraints.push(c);
      }),
    } as unknown as MediaStreamTrack;

    let capturedWhileTorchOn = false;

    const result = await pulseTorch(
      mockTrack,
      async () => {
        // Assert torch constraint was on when captureAction ran
        const lastConstraint = appliedConstraints[appliedConstraints.length - 1];
        if (lastConstraint?.advanced?.[0]?.torch === true) {
          capturedWhileTorchOn = true;
        }
        return "photo-blob";
      },
      { maxStabilizeMs: 10 }
    );

    expect(result).toBe("photo-blob");
    expect(capturedWhileTorchOn).toBe(true);

    // Final constraint MUST turn torch off
    const finalConstraint = appliedConstraints[appliedConstraints.length - 1];
    expect(finalConstraint?.advanced?.[0]?.torch).toBe(false);
  });

  it("strictly turns torch OFF even if captureAction throws an unhandled exception", async () => {
    const appliedConstraints: TorchConstraint[] = [];
    const mockTrack = {
      applyConstraints: vi.fn(async (c: TorchConstraint) => {
        appliedConstraints.push(c);
      }),
    } as unknown as MediaStreamTrack;

    await expect(
      pulseTorch(
        mockTrack,
        async () => {
          throw new Error("Sensor read error during capture");
        },
        { maxStabilizeMs: 10 }
      )
    ).rejects.toThrow("Sensor read error during capture");

    // Even on error, final call turned torch off
    const finalConstraint = appliedConstraints[appliedConstraints.length - 1];
    expect(finalConstraint?.advanced?.[0]?.torch).toBe(false);
  });

  it("gracefully proceeds to capture even if torch activation fails (e.g. low battery / hardware busy)", async () => {
    const mockTrack = {
      applyConstraints: vi.fn(async () => {
        throw new Error("OverconstrainedError: torch unavailable");
      }),
    } as unknown as MediaStreamTrack;

    const result = await pulseTorch(
      mockTrack,
      async () => "captured-without-torch",
      { maxStabilizeMs: 10 }
    );

    expect(result).toBe("captured-without-torch");
  });

  it("executes rapid sequential captures without artificial 600ms cooldown blocking", async () => {
    const appliedConstraints: TorchConstraint[] = [];
    const mockTrack = {
      applyConstraints: vi.fn(async (c: TorchConstraint) => {
        appliedConstraints.push(c);
      }),
    } as unknown as MediaStreamTrack;

    const tStart = Date.now();
    await pulseTorch(mockTrack, async () => "shot1", { maxStabilizeMs: 20 });
    await pulseTorch(mockTrack, async () => "shot2", { maxStabilizeMs: 20 });
    const elapsed = Date.now() - tStart;

    // Both shots completed rapidly without waiting for any 600ms cooldown
    expect(elapsed).toBeLessThan(300);
    // Verified 2 ON constraints and 2 OFF constraints
    const onCalls = appliedConstraints.filter((c) => c.advanced?.[0]?.torch === true);
    const offCalls = appliedConstraints.filter((c) => c.advanced?.[0]?.torch === false);
    expect(onCalls).toHaveLength(2);
    expect(offCalls).toHaveLength(2);
  });

  it("combines torch and exposureCompensation atomically into a single constraint set via applyFlashConstraints", async () => {
    const { applyFlashConstraints } = await import("@/lib/camera/caps");
    const calls: any[] = [];
    const mockTrack = {
      getCapabilities: () => ({
        torch: true,
        exposureCompensation: { min: -2, max: 2, step: 0.1 },
      }),
      applyConstraints: vi.fn(async (constraints: any) => {
        calls.push(constraints);
      }),
    } as unknown as MediaStreamTrack;

    await applyFlashConstraints(mockTrack, { torch: true, exposureBiasEV: -0.5 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      advanced: [{ torch: true, exposureCompensation: -0.5 }],
    });

    await applyFlashConstraints(mockTrack, { torch: false, exposureBiasEV: 0 });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({
      advanced: [{ torch: false, exposureCompensation: 0 }],
    });
  });

  it("gracefully falls back to torch only if combined constraint is rejected by HAL driver", async () => {
    const { applyFlashConstraints } = await import("@/lib/camera/caps");
    let callCount = 0;
    const calls: any[] = [];
    const mockTrack = {
      getCapabilities: () => ({
        torch: true,
        exposureCompensation: { min: -2, max: 2, step: 0.1 },
      }),
      applyConstraints: vi.fn(async (constraints: any) => {
        callCount++;
        calls.push(constraints);
        if (callCount === 1) {
          throw new Error("OverconstrainedError: exposureCompensation unsupported simultaneously with torch");
        }
      }),
    } as unknown as MediaStreamTrack;

    await applyFlashConstraints(mockTrack, { torch: true, exposureBiasEV: -0.5 });

    // Should have attempted combined, caught error, and fell back to torch-only
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      advanced: [{ torch: true, exposureCompensation: -0.5 }],
    });
    expect(calls[1]).toEqual({
      advanced: [{ torch: true }],
    });
  });

  it("supports configurable resolution downsampling in measureSceneLuminance", async () => {
    const { measureSceneLuminance } = await import("@/lib/camera/caps");
    // Create mock video element with no frames ready
    const mockVideo = { readyState: 0 } as HTMLVideoElement;
    expect(measureSceneLuminance(mockVideo, 16)).toBe(0.5);
  });
});
