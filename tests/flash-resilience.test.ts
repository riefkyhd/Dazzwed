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
});
