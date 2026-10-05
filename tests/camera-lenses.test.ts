import { describe, expect, it } from "vitest";
import {
  classifyFacing,
  classifyKind,
  backLenses,
  pickerLenses,
  pickDefaultLens,
  type DeviceLike,
} from "@/lib/camera/lenses";

describe("camera lens heuristics", () => {
  it("classifies facing correctly", () => {
    expect(classifyFacing("Back Camera")).toBe("back");
    expect(classifyFacing("camera2 0, facing back")).toBe("back");
    expect(classifyFacing("Front Camera")).toBe("front");
    expect(classifyFacing("camera2 1, facing front")).toBe("front");
    expect(classifyFacing("External USB Cam")).toBe("unknown");
  });

  it("classifies lens kind from common labels", () => {
    expect(classifyKind("Back Camera")).toBe("main");
    expect(classifyKind("Back Ultra Wide Camera")).toBe("ultrawide");
    expect(classifyKind("Back Telephoto Camera")).toBe("tele");
    expect(classifyKind("Back Dual Camera")).toBe("virtual");
    expect(classifyKind("Back Triple Camera")).toBe("virtual");
    expect(classifyKind("camera2 0, facing back")).toBe("unknown");
  });

  const iphoneDevices: DeviceLike[] = [
    { deviceId: "front-1", kind: "videoinput", label: "Front Camera" },
    { deviceId: "back-main", kind: "videoinput", label: "Back Camera" },
    { deviceId: "back-uw", kind: "videoinput", label: "Back Ultra Wide Camera" },
    { deviceId: "back-tele", kind: "videoinput", label: "Back Telephoto Camera" },
    { deviceId: "back-dual", kind: "videoinput", label: "Back Dual Camera" },
  ];

  it("filters back lenses and drops virtual camera if real lenses exist", () => {
    const backs = backLenses(iphoneDevices);
    expect(backs.map((b) => b.deviceId)).toEqual(["back-main", "back-uw", "back-tele"]);
  });

  it("orders picker lenses logically (ultrawide -> main -> tele)", () => {
    const picker = pickerLenses(iphoneDevices);
    expect(picker.map((p) => p.kind)).toEqual(["ultrawide", "main", "tele"]);
  });

  it("selects standard/main back camera for default and excludes ultra-wide", () => {
    const def = pickDefaultLens(iphoneDevices);
    expect(def).toBe("back-main");
  });

  it("falls back gracefully when only generic labels exist", () => {
    const androidDevices: DeviceLike[] = [
      { deviceId: "cam-front", kind: "videoinput", label: "facing front" },
      { deviceId: "cam-back-0", kind: "videoinput", label: "facing back" },
    ];
    const def = pickDefaultLens(androidDevices);
    expect(def).toBe("cam-back-0");
  });

  it("picker returns empty or hides when only 1 back lens is found", () => {
    const single: DeviceLike[] = [
      { deviceId: "cam-back", kind: "videoinput", label: "Back Camera" },
      { deviceId: "cam-front", kind: "videoinput", label: "Front Camera" },
    ];
    const lenses = pickerLenses(single);
    expect(lenses.length).toBe(1);
  });
});
