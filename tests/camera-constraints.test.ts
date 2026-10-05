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

  it("builds constraint ladder from high-res exact down to bare minimal fallback", () => {
    const ladder = constraintLadder({ facing: "environment" });
    expect(ladder.length).toBeGreaterThanOrEqual(3);

    // First rung requests ideal 1920x1080
    // @ts-expect-error video constraint inspect
    expect(ladder[0].video.width).toEqual({ ideal: 1920 });

    // Last rung is bare minimal fallback { video: true }
    expect(ladder[ladder.length - 1]).toEqual({ audio: false, video: true });
  });

  it("builds exact deviceId ladder when specific lens is chosen", () => {
    const ladder = constraintLadder({ deviceId: "lens-123", facing: "environment" });
    // @ts-expect-error video constraint inspect
    expect(ladder[0].video.deviceId).toEqual({ exact: "lens-123" });
  });
});
