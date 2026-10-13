import { describe, it, expect, beforeEach } from "vitest";
import {
  diagnostics,
  redactDeviceId,
  redactTrackSettings,
  getOpticalStatusNotice,
} from "../src/lib/camera/diagnostics";

describe("Zoom & Lens Diagnostics (Priority 1)", () => {
  beforeEach(() => {
    diagnostics.reset();
  });

  it("redacts long deviceId and groupId values while preserving short or empty placeholders", () => {
    expect(redactDeviceId(undefined)).toBe("none");
    expect(redactDeviceId("")).toBe("none");
    expect(redactDeviceId("default")).toBe("default");
    expect(redactDeviceId("abcd1234efgh5678ijkl9012")).toBe("abcd…9012");

    const redacted = redactTrackSettings(
      {
        deviceId: "9f8e7d6c5b4a3210fedcba9876543210",
        groupId: "11223344556677889900aabbccddeeff",
        width: 2560,
        height: 1920,
        facingMode: "environment",
      },
      "Back Dual Wide Camera"
    );

    expect(redacted).not.toBeNull();
    expect(redacted?.deviceId).toBe("9f8e…3210");
    expect(redacted?.groupId).toBe("1122…eeff");
    expect(redacted?.trackLabel).toBe("Back Dual Wide Camera");
    expect(redacted?.width).toBe(2560);
    expect(redacted?.height).toBe(1920);
  });

  it("explicitly states when physical lens switching cannot be determined from browser APIs", () => {
    const notice = getOpticalStatusNotice("CANNOT_VERIFY_FROM_BROWSER_API");
    expect(notice).toContain("does NOT prove physical telephoto lens switching");
    expect(notice).toContain("Browser API limitation");

    const cropNotice = getOpticalStatusNotice("DIGITAL_CROP_ONLY");
    expect(cropNotice).toContain("Confirmed App Digital Crop");

    const switchNotice = getOpticalStatusNotice("SEPARATE_DEVICE_STREAM");
    expect(switchNotice).toContain("Confirmed Separate Device Stream");
  });

  it("stores enumerated video inputs with redacted IDs and active status", () => {
    diagnostics.setVideoInputs([
      {
        index: 0,
        redactedId: "aaaa…1111",
        redactedGroupId: "gggg…0000",
        label: "Back Camera",
        classifiedKind: "wide",
        classifiedFacing: "environment",
        isActive: true,
        inPicker: true,
      },
      {
        index: 1,
        redactedId: "bbbb…2222",
        redactedGroupId: "gggg…0000",
        label: "Back Ultra Wide Camera",
        classifiedKind: "ultra",
        classifiedFacing: "environment",
        isActive: false,
        inPicker: true,
      },
    ]);

    const state = diagnostics.getState();
    expect(state.videoInputs).toHaveLength(2);
    expect(state.videoInputs[0].isActive).toBe(true);
    expect(state.videoInputs[1].classifiedKind).toBe("ultra");
  });

  it("logs discrete 0.5x, 1x, 2x, 3x actions and constraint errors while coalescing rapid continuous pinch events", () => {
    // 1. 0.5x camera switch
    diagnostics.logZoomAction({
      action: "0.5x",
      requestedValue: 0.5,
      mechanism: "camera-switch",
      opticalVerification: "SEPARATE_DEVICE_STREAM",
      streamRetained: false,
      previousDeviceIdRedacted: "aaaa…1111",
      activeDeviceIdRedacted: "bbbb…2222",
      activeDeviceLabel: "Back Ultra Wide Camera",
      constraintApplied: 'getUserMedia({ video: { deviceId: { exact: "bbbb…2222" } } })',
      constraintStatus: "not-applicable",
      reportedZoomAfter: 1,
      supportedZoomRange: null,
      effectiveAppDigitalCrop: 1,
      resolutionAfter: "1920x1440",
    });

    // 2. 2x browser zoom constraint
    diagnostics.logZoomAction({
      action: "2x",
      requestedValue: 2,
      mechanism: "browser-zoom-constraint",
      opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
      streamRetained: true,
      previousDeviceIdRedacted: "aaaa…1111",
      activeDeviceIdRedacted: "aaaa…1111",
      activeDeviceLabel: "Back Camera",
      constraintApplied: "applyConstraints({ advanced: [{ zoom: 2 }] })",
      constraintStatus: "success",
      reportedZoomAfter: 2,
      supportedZoomRange: { min: 1, max: 5, step: 0.1 },
      effectiveAppDigitalCrop: 1,
      resolutionAfter: "2560x1920",
    });

    // 3. Rapid pinch events (<400ms apart) should coalesce into a single entry with latest value
    diagnostics.logZoomAction({
      action: "pinch",
      requestedValue: 2.2,
      mechanism: "browser-zoom-constraint",
      opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
      streamRetained: true,
      previousDeviceIdRedacted: "aaaa…1111",
      activeDeviceIdRedacted: "aaaa…1111",
      activeDeviceLabel: "Back Camera",
      constraintApplied: "applyConstraints({ advanced: [{ zoom: 2.2 }] })",
      constraintStatus: "success",
      reportedZoomAfter: 2.2,
      supportedZoomRange: { min: 1, max: 5, step: 0.1 },
      effectiveAppDigitalCrop: 1,
      resolutionAfter: "2560x1920",
    });

    diagnostics.logZoomAction({
      action: "pinch",
      requestedValue: 2.65,
      mechanism: "browser-zoom-constraint",
      opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
      streamRetained: true,
      previousDeviceIdRedacted: "aaaa…1111",
      activeDeviceIdRedacted: "aaaa…1111",
      activeDeviceLabel: "Back Camera",
      constraintApplied: "applyConstraints({ advanced: [{ zoom: 2.65 }] })",
      constraintStatus: "success",
      reportedZoomAfter: 2.65,
      supportedZoomRange: { min: 1, max: 5, step: 0.1 },
      effectiveAppDigitalCrop: 1,
      resolutionAfter: "2560x1920",
    });

    // 4. 3x constraint failure records exact error
    diagnostics.logZoomAction({
      action: "3x",
      requestedValue: 3,
      mechanism: "browser-zoom-constraint",
      opticalVerification: "CANNOT_VERIFY_FROM_BROWSER_API",
      streamRetained: true,
      previousDeviceIdRedacted: "aaaa…1111",
      activeDeviceIdRedacted: "aaaa…1111",
      activeDeviceLabel: "Back Camera",
      constraintApplied: "applyConstraints({ advanced: [{ zoom: 3 }] })",
      constraintStatus: "error",
      constraintError: "OverconstrainedError: zoom out of range",
      reportedZoomAfter: 2.65,
      supportedZoomRange: { min: 1, max: 2.7, step: 0.1 },
      effectiveAppDigitalCrop: 1,
      resolutionAfter: "2560x1920",
    });

    const state = diagnostics.getState();
    expect(state.zoomHistory).toHaveLength(4);
    expect(state.zoomHistory[0].action).toBe("0.5x");
    expect(state.zoomHistory[1].action).toBe("2x");
    expect(state.zoomHistory[2].action).toBe("pinch");
    expect(state.zoomHistory[2].requestedValue).toBe(2.65);
    expect(state.zoomHistory[3].action).toBe("3x");
    expect(state.zoomHistory[3].constraintStatus).toBe("error");
    expect(state.zoomHistory[3].constraintError).toBe("OverconstrainedError: zoom out of range");
  });
});
