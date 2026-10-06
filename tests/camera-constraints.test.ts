import { describe, expect, it } from "vitest";
import {
  classifyError,
  constraintLadder,
} from "@/lib/camera/constraints";

describe("camera constraints & error classification", () => {
  it("classifies standard browser DOMExceptions", () => {
    expect(classifyError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyError({ name: "SecurityError" })).toBe("denied");
    expect(classifyError({ name: "NotFoundError" })).toBe("not-found");
    expect(classifyError({ name: "NotReadableError" })).toBe("in-use");
    expect(classifyError({ name: "OverconstrainedError" })).toBe("unknown");
  });

  it("builds constraint ladder from high-res 4:3 down to bare minimal fallback", () => {
    const ladder = constraintLadder({ facing: "environment" });
    expect(ladder.length).toBeGreaterThanOrEqual(18);

    // First rung requests ideal 4032x3024 (12MP 4:3) with aspect 4/3
    // @ts-expect-error video constraint inspect
    expect(ladder[0].video.width).toEqual({ ideal: 4032 });
    // @ts-expect-error video constraint inspect
    expect(ladder[0].video.height).toEqual({ ideal: 3024 });
    // @ts-expect-error video constraint inspect
    expect(ladder[0].video.aspectRatio).toEqual({ ideal: 4 / 3 });

    // Last rung is bare minimal fallback { video: true }
    expect(ladder[ladder.length - 1]).toEqual({ audio: false, video: true });
  });

  it("builds exact deviceId ladder when specific lens is chosen", () => {
    const ladder = constraintLadder({ deviceId: "lens-123", facing: "environment" });
    // @ts-expect-error video constraint inspect
    expect(ladder[0].video.deviceId).toEqual({ exact: "lens-123" });
  });

  it("builds user/front camera ladder without falling back to bare video: true", () => {
    const ladder = constraintLadder({ facing: "user" });
    expect(ladder.length).toBeGreaterThanOrEqual(3);
    // Rung 0 requests exact user facing
    // @ts-expect-error video constraint inspect
    expect(ladder[0].video.facingMode).toEqual({ exact: "user" });
    // Must NOT end with bare video: true (which would open the rear camera on mobile)
    expect(ladder[ladder.length - 1]).not.toEqual({ audio: false, video: true });
  });
});
