import { describe, expect, it, vi } from "vitest";
import {
  classifyFacing,
  classifyKind,
  parseExplicitZoom,
  backLenses,
  pickerLenses,
  pickDefaultLens,
  resolveZoomPreset,
  getEffectiveDisplayZoom,
  type DeviceLike,
} from "@/lib/camera/lenses";
import { clampZoomToRange, applyNativeZoom } from "@/lib/camera/caps";

describe("camera lens heuristics & zoom preset resolution", () => {
  it("classifies facing correctly across iOS, Android, and ambiguous labels", () => {
    expect(classifyFacing("Back Camera")).toBe("back");
    expect(classifyFacing("camera2 0, facing back")).toBe("back");
    expect(classifyFacing("camera 0, facing back")).toBe("back");
    expect(classifyFacing("Front Camera")).toBe("front");
    expect(classifyFacing("camera2 1, facing front")).toBe("front");
    expect(classifyFacing("External USB Cam")).toBe("unknown");
    expect(classifyFacing("")).toBe("unknown");
  });

  it("classifies lens kind from common labels", () => {
    expect(classifyKind("Back Camera")).toBe("main");
    expect(classifyKind("Back Ultra Wide Camera")).toBe("ultrawide");
    expect(classifyKind("Back Telephoto Camera")).toBe("tele");
    expect(classifyKind("Back Dual Camera")).toBe("virtual");
    expect(classifyKind("Back Triple Camera")).toBe("virtual");
    expect(classifyKind("camera2 0, facing back")).toBe("main");
    expect(classifyKind("camera2 2, facing back")).toBe("ultrawide");
    expect(classifyKind("camera2 3, facing back")).toBe("tele");
    expect(classifyKind("camera 0, facing back")).toBe("main");
    expect(classifyKind("camera 2, facing back")).toBe("ultrawide");
    expect(classifyKind("camera 3, facing back")).toBe("tele");
    expect(classifyKind("")).toBe("unknown");
  });

  it("parses explicit zoom multipliers conservatively without assuming generic telephoto magnification", () => {
    expect(parseExplicitZoom("Back Camera", "main")).toBe(1);
    expect(parseExplicitZoom("Back Ultra Wide Camera", "ultrawide")).toBe(0.5);
    // Generic "Back Telephoto Camera" could be 2x, 3x, or 5x on iPhones/Androids -> must be undefined
    expect(parseExplicitZoom("Back Telephoto Camera", "tele")).toBeUndefined();
    // Explicit magnification in label is parsed
    expect(parseExplicitZoom("Back Telephoto 2x Camera", "tele")).toBe(2);
    expect(parseExplicitZoom("Back Telephoto 3x Camera", "tele")).toBe(3);
    expect(parseExplicitZoom("Telephoto 5x", "tele")).toBe(5);
  });

  const iphoneDevices: DeviceLike[] = [
    { deviceId: "front-1", kind: "videoinput", label: "Front Camera" },
    { deviceId: "back-main", kind: "videoinput", label: "Back Camera" },
    { deviceId: "back-uw", kind: "videoinput", label: "Back Ultra Wide Camera" },
    { deviceId: "back-tele", kind: "videoinput", label: "Back Telephoto Camera" },
    { deviceId: "back-dual", kind: "videoinput", label: "Back Dual Camera" },
  ];

  it("filters back lenses and drops virtual camera if a real main/base lens exists", () => {
    const backs = backLenses(iphoneDevices);
    expect(backs.map((b) => b.deviceId)).toEqual(["back-main", "back-uw", "back-tele"]);
  });

  it("retains virtual camera if no real main/unknown base lens exists alongside ultrawide", () => {
    const virtualPlusUw: DeviceLike[] = [
      { deviceId: "back-uw", kind: "videoinput", label: "Back Ultra Wide Camera" },
      { deviceId: "back-dual", kind: "videoinput", label: "Back Dual Wide Camera" },
    ];
    const backs = backLenses(virtualPlusUw);
    expect(backs.map((b) => b.deviceId)).toEqual(["back-uw", "back-dual"]);
    expect(pickDefaultLens(virtualPlusUw)).toBe("back-dual");
  });

  it("orders picker lenses logically (ultrawide -> main -> tele)", () => {
    const picker = pickerLenses(iphoneDevices);
    expect(picker.map((p) => p.kind)).toEqual(["ultrawide", "main", "tele"]);
  });

  it("selects standard/main back camera for default and excludes ultra-wide", () => {
    const def = pickDefaultLens(iphoneDevices);
    expect(def).toBe("back-main");
  });

  it("falls back gracefully when only generic Android or empty labels exist", () => {
    const androidDevices: DeviceLike[] = [
      { deviceId: "cam-front", kind: "videoinput", label: "camera 1, facing front" },
      { deviceId: "cam-back-0", kind: "videoinput", label: "camera 0, facing back" },
    ];
    expect(pickDefaultLens(androidDevices)).toBe("cam-back-0");

    const unlabeledDevices: DeviceLike[] = [
      { deviceId: "cam-0", kind: "videoinput", label: "" },
    ];
    expect(pickDefaultLens(unlabeledDevices)).toBeUndefined();
    expect(backLenses(unlabeledDevices)).toHaveLength(0);
  });

  it("accurately classifies Samsung Galaxy S23 FE multi-lens cameras and picks primary 1x lens as default", () => {
    const s23Devices: DeviceLike[] = [
      { deviceId: "s23-ultra", kind: "videoinput", label: "camera2 2, facing back" }, // 0.5x Ultra-Wide
      { deviceId: "s23-main", kind: "videoinput", label: "camera2 0, facing back" },  // 1x Primary Wide
      { deviceId: "s23-tele", kind: "videoinput", label: "camera2 3, facing back" },  // 3x Optical Telephoto
      { deviceId: "s23-front", kind: "videoinput", label: "camera2 1, facing front" }, // Front Selfie
    ];

    const backs = backLenses(s23Devices);
    expect(backs).toHaveLength(3);

    // Default lens MUST be the primary wide (1x) lens, NEVER the ultra-wide lens
    expect(pickDefaultLens(s23Devices)).toBe("s23-main");

    // Picker must order: ultrawide (0.5x) -> main (1x) -> tele (3x)
    const picker = pickerLenses(s23Devices);
    expect(picker.map((p) => p.deviceId)).toEqual(["s23-ultra", "s23-main", "s23-tele"]);
    expect(picker.map((p) => p.kind)).toEqual(["ultrawide", "main", "tele"]);
    expect(picker.map((p) => p.explicitZoom)).toEqual([0.5, 1, 3]);

    // 0.5x preset switches stream to s23-ultra
    const plan05 = resolveZoomPreset({
      preset: 0.5,
      lenses: picker,
      activeId: "s23-main",
      zoomRange: { min: 1, max: 8, step: 0.1 },
    });
    expect(plan05.requiresStreamSwitch).toBe(true);
    expect(plan05.targetDeviceId).toBe("s23-ultra");
    expect(plan05.mechanism).toBe("camera-switch");

    // 1x preset switches stream back to s23-main when on s23-ultra
    const plan1x = resolveZoomPreset({
      preset: 1,
      lenses: picker,
      activeId: "s23-ultra",
      zoomRange: { min: 1, max: 8, step: 0.1 },
    });
    expect(plan1x.requiresStreamSwitch).toBe(true);
    expect(plan1x.targetDeviceId).toBe("s23-main");
    expect(plan1x.mechanism).toBe("camera-switch");

    // 2x preset uses hardware zoom constraint on s23-main
    const plan2x = resolveZoomPreset({
      preset: 2,
      lenses: picker,
      activeId: "s23-main",
      zoomRange: { min: 1, max: 8, step: 0.1 },
    });
    expect(plan2x.requiresStreamSwitch).toBe(false);
    expect(plan2x.targetNativeZoom).toBe(2);
    expect(plan2x.mechanism).toBe("browser-zoom-constraint");

    // 3x preset switches to optical telephoto s23-tele
    const plan3x = resolveZoomPreset({
      preset: 3,
      lenses: picker,
      activeId: "s23-main",
      zoomRange: { min: 1, max: 8, step: 0.1 },
    });
    expect(plan3x.requiresStreamSwitch).toBe(true);
    expect(plan3x.targetDeviceId).toBe("s23-tele");
    expect(plan3x.mechanism).toBe("camera-switch");
  });

  describe("resolveZoomPreset (0.5x, 1x, 2x, 3x selection strategy)", () => {
    const iOSLenses = pickerLenses(iphoneDevices);

    it("does NOT switch to generic 'Back Telephoto Camera' on 2x (fixes 2x selecting 3x/5x native tele lens)", () => {
      // With browser zoom capability [1, 5]
      const withNativeZoom = resolveZoomPreset({
        preset: 2,
        lenses: iOSLenses,
        activeId: "back-main",
        zoomRange: { min: 1, max: 5, step: 0.1 },
      });
      expect(withNativeZoom.mechanism).toBe("browser-zoom-constraint");
      expect(withNativeZoom.requiresStreamSwitch).toBe(false);
      expect(withNativeZoom.targetDeviceId).toBe("back-main");
      expect(withNativeZoom.targetNativeZoom).toBe(2);
      expect(withNativeZoom.targetDigitalZoom).toBe(1);

      // Without browser zoom capability (e.g. iOS Safari single stream without zoom cap)
      const withDigitalFallback = resolveZoomPreset({
        preset: 2,
        lenses: iOSLenses,
        activeId: "back-main",
        zoomRange: null,
      });
      expect(withDigitalFallback.mechanism).toBe("app-digital-crop");
      expect(withDigitalFallback.requiresStreamSwitch).toBe(false);
      expect(withDigitalFallback.targetDeviceId).toBe("back-main");
      expect(withDigitalFallback.targetDigitalZoom).toBe(2);
    });

    it("switches to explicit 2x or 3x telephoto camera ONLY when label explicitly identifies magnification", () => {
      const explicitTeleDevices: DeviceLike[] = [
        { deviceId: "back-main", kind: "videoinput", label: "Back Camera" },
        { deviceId: "back-tele-2x", kind: "videoinput", label: "Back Telephoto 2x Camera" },
        { deviceId: "back-tele-3x", kind: "videoinput", label: "Back Telephoto 3x Camera" },
      ];
      const lenses = pickerLenses(explicitTeleDevices);

      const res2x = resolveZoomPreset({
        preset: 2,
        lenses,
        activeId: "back-main",
        zoomRange: { min: 1, max: 10, step: 0.1 },
      });
      expect(res2x.mechanism).toBe("camera-switch");
      expect(res2x.targetDeviceId).toBe("back-tele-2x");

      const res3x = resolveZoomPreset({
        preset: 3,
        lenses,
        activeId: "back-main",
        zoomRange: { min: 1, max: 10, step: 0.1 },
      });
      expect(res3x.mechanism).toBe("camera-switch");
      expect(res3x.targetDeviceId).toBe("back-tele-3x");
    });

    it("follows a consistent strategy for 3x: explicit 3x lens -> browser zoom constraint -> digital crop", () => {
      // Pixel 10 scenario: single back camera with zoomRange [1, 20]
      const pixel10Lenses = pickerLenses([
        { deviceId: "cam-back-0", kind: "videoinput", label: "camera 0, facing back" },
      ]);
      const pixel3x = resolveZoomPreset({
        preset: 3,
        lenses: pixel10Lenses,
        activeId: "cam-back-0",
        zoomRange: { min: 1, max: 20, step: 0.1 },
      });
      expect(pixel3x.mechanism).toBe("browser-zoom-constraint");
      expect(pixel3x.targetNativeZoom).toBe(3);
      expect(pixel3x.targetDigitalZoom).toBe(1);

      // Device where zoomRange max is < 3 (e.g. max 2) -> falls back to app digital crop
      const limitedRange3x = resolveZoomPreset({
        preset: 3,
        lenses: pixel10Lenses,
        activeId: "cam-back-0",
        zoomRange: { min: 1, max: 2, step: 0.1 },
      });
      expect(limitedRange3x.mechanism).toBe("app-digital-crop");
      expect(limitedRange3x.targetNativeZoom).toBe(1);
      expect(limitedRange3x.targetDigitalZoom).toBe(3);
    });

    it("switches back from 0.5x ultrawide to 1x main camera when user selects 1x, 2x, or 3x", () => {
      const to1x = resolveZoomPreset({
        preset: 1,
        lenses: iOSLenses,
        activeId: "back-uw",
        zoomRange: null,
      });
      expect(to1x.mechanism).toBe("camera-switch");
      expect(to1x.targetDeviceId).toBe("back-main");

      const to2x = resolveZoomPreset({
        preset: 2,
        lenses: iOSLenses,
        activeId: "back-uw",
        zoomRange: { min: 1, max: 5, step: 0.1 },
      });
      expect(to2x.mechanism).toBe("camera-switch");
      expect(to2x.targetDeviceId).toBe("back-main");
      expect(to2x.targetNativeZoom).toBe(2);

      const to3x = resolveZoomPreset({
        preset: 3,
        lenses: iOSLenses,
        activeId: "back-uw",
        zoomRange: null,
      });
      expect(to3x.mechanism).toBe("camera-switch");
      expect(to3x.targetDeviceId).toBe("back-main");
      expect(to3x.targetDigitalZoom).toBe(3);
    });

    it("resolves 0.5x via dedicated ultrawide lens first, or browser zoom constraint if min <= 0.5", () => {
      const uwSwitch = resolveZoomPreset({
        preset: 0.5,
        lenses: iOSLenses,
        activeId: "back-main",
        zoomRange: null,
      });
      expect(uwSwitch.mechanism).toBe("camera-switch");
      expect(uwSwitch.targetDeviceId).toBe("back-uw");

      const singleLens = pickerLenses([
        { deviceId: "cam-back-0", kind: "videoinput", label: "camera 0, facing back" },
      ]);
      const nativeHalfZoom = resolveZoomPreset({
        preset: 0.5,
        lenses: singleLens,
        activeId: "cam-back-0",
        zoomRange: { min: 0.5, max: 10, step: 0.1 },
      });
      expect(nativeHalfZoom.mechanism).toBe("browser-zoom-constraint");
      expect(nativeHalfZoom.targetNativeZoom).toBe(0.5);
    });
  });

  describe("zoom range clamping & effective display zoom", () => {
    it("clamps requested zoom to capability range or digital bounds", () => {
      const range = { min: 1, max: 8, step: 0.1 };
      expect(clampZoomToRange(0.5, range)).toBe(1);
      expect(clampZoomToRange(2.5, range)).toBe(2.5);
      expect(clampZoomToRange(15, range)).toBe(8);
      expect(clampZoomToRange(Number.NaN, range)).toBe(1);

      // Digital fallback bounds [1, 10]
      expect(clampZoomToRange(0.3, null)).toBe(1);
      expect(clampZoomToRange(3, null)).toBe(3);
      expect(clampZoomToRange(25, null)).toBe(10);
    });

    it("applyNativeZoom clamps value to track capability range before calling applyConstraints", async () => {
      const applyConstraints = vi.fn().mockResolvedValue(undefined);
      const mockTrack = {
        getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 0.1 } }),
        applyConstraints,
      } as unknown as MediaStreamTrack;

      const applied = await applyNativeZoom(mockTrack, 6);
      expect(applied).toBe(4);
      expect(applyConstraints).toHaveBeenCalledWith({
        advanced: [{ zoom: 4 }],
      });
    });

    it("computes effective display zoom accurately across lenses, native zoom, and digital crop", () => {
      const iOSLenses = pickerLenses(iphoneDevices);
      expect(
        getEffectiveDisplayZoom({
          activeId: "back-uw",
          lenses: iOSLenses,
          zoom: 1,
          digitalZoom: 1,
          zoomRange: null,
        })
      ).toBe(0.5);

      expect(
        getEffectiveDisplayZoom({
          activeId: "back-main",
          lenses: iOSLenses,
          zoom: 2,
          digitalZoom: 1,
          zoomRange: { min: 1, max: 10, step: 0.1 },
        })
      ).toBe(2);

      expect(
        getEffectiveDisplayZoom({
          activeId: "back-main",
          lenses: iOSLenses,
          zoom: 1,
          digitalZoom: 3,
          zoomRange: { min: 1, max: 2, step: 0.1 },
        })
      ).toBe(3);
    });
  });
});
