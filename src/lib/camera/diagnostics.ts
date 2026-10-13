/**
 * Real-time Camera Diagnostics & Telemetry Tracker
 * Tracks:
 *  - Last 20 Lifecycle Events
 *  - Shutter Latency Marks (t0..t7, p50, p95)
 *  - Viewfinder Layout Invariants
 *  - Track & Permission Status
 */

export interface LifecycleEvent {
  timestamp: number;
  timeStr: string;
  type: string;
  detail?: string;
}

export interface ShutterMeasurement {
  id: string;
  timestamp: number;
  t0: number; // pointer event
  t1?: number; // feedback painted (rAF)
  t2?: number; // frame grabbed
  t3?: number; // look rendered
  t4?: number; // review painted
  t5?: number; // JPEG encoded
  t6?: number; // keep tapped
  t7?: number; // queued for upload
  latencyT1?: number; // t1 - t0 (budget <= 50ms)
  latencyT4?: number; // t4 - t0 (budget <= 250ms)
  latencyKeepToLive?: number;
}

export type ZoomMechanism =
  | "base-1x"
  | "camera-switch"
  | "browser-zoom-constraint"
  | "app-digital-crop";

export type OpticalVerificationStatus =
  | "CANNOT_VERIFY_FROM_BROWSER_API"
  | "DIGITAL_CROP_ONLY"
  | "SEPARATE_DEVICE_STREAM";

export interface EnumeratedVideoInput {
  index: number;
  redactedId: string;
  redactedGroupId?: string;
  label: string;
  classifiedKind: string;
  classifiedFacing: string;
  isActive: boolean;
  inPicker: boolean;
}

export interface ZoomActionLogEntry {
  timestamp: number;
  timeStr: string;
  action: "0.5x" | "1x" | "2x" | "3x" | "pinch" | "stream-init" | string;
  requestedValue: number;
  mechanism: ZoomMechanism;
  opticalVerification: OpticalVerificationStatus;
  opticalNotice: string;
  streamRetained: boolean;
  previousDeviceIdRedacted: string;
  activeDeviceIdRedacted: string;
  activeDeviceLabel: string;
  constraintApplied: string;
  constraintStatus: "success" | "error" | "not-applicable";
  constraintError?: string;
  reportedZoomAfter: number | null;
  supportedZoomRange: { min: number; max: number; step: number } | null;
  effectiveAppDigitalCrop: number;
  resolutionAfter: string;
}

export function redactDeviceId(id?: string | null): string {
  if (!id) return "none";
  if (id === "default" || id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function redactTrackSettings(
  settings: (MediaTrackSettings & { zoom?: number; exposureCompensation?: number }) | null | undefined,
  trackLabel?: string
): Record<string, unknown> | null {
  if (!settings) return null;
  const copy: Record<string, unknown> = { ...settings };
  if (typeof copy.deviceId === "string") {
    copy.deviceId = redactDeviceId(copy.deviceId);
  }
  if (typeof copy.groupId === "string") {
    copy.groupId = redactDeviceId(copy.groupId);
  }
  if (trackLabel !== undefined) {
    copy.trackLabel = trackLabel || "(unlabeled)";
  }
  return copy;
}

export function getOpticalStatusNotice(status: OpticalVerificationStatus): string {
  switch (status) {
    case "CANNOT_VERIFY_FROM_BROWSER_API":
      return "Browser API limitation: Physical lens CANNOT be determined from browser APIs. Browser zoom constraint (applyConstraints) is managed by OS/HAL; reported zoom does NOT prove physical telephoto lens switching. Confirm via physical lens occlusion test.";
    case "DIGITAL_CROP_ONLY":
      return "Confirmed App Digital Crop: Digital crop only (WebGL shader u_cropRect + 2D canvas crop on current sensor frame). No optical lens switch.";
    case "SEPARATE_DEVICE_STREAM":
      return "Confirmed Separate Device Stream: Opened separate videoinput deviceId stream via getUserMedia. Note: camera labels and deviceIds do NOT prove physical optical lens identity; confirm on device via physical lens occlusion test.";
  }
}

export interface DiagnosticsState {
  lifecycleEvents: LifecycleEvent[];
  shutterHistory: ShutterMeasurement[];
  lastMeasurement: ShutterMeasurement | null;
  invariantViolations: string[];
  videoInputs: EnumeratedVideoInput[];
  zoomHistory: ZoomActionLogEntry[];
  lastZoomAction: ZoomActionLogEntry | null;
  rvfcLatencyMs?: number | null;
}

type Listener = (state: DiagnosticsState) => void;

class CameraDiagnosticsTracker {
  private events: LifecycleEvent[];
  private shutterHistory: ShutterMeasurement[] = [];
  private currentMeasurement: ShutterMeasurement | null = null;
  private invariantViolations: string[] = [];
  private videoInputs: EnumeratedVideoInput[] = [];
  private zoomHistory: ZoomActionLogEntry[] = [];
  private lastZoomAction: ZoomActionLogEntry | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    this.events = [];
    if (typeof window !== "undefined") {
      (window as unknown as { __CAMERA_DIAGNOSTICS__: CameraDiagnosticsTracker }).__CAMERA_DIAGNOSTICS__ = this;
    }
  }

  public logEvent(type: string, detail?: string) {
    const now = performance.now();
    const event: LifecycleEvent = {
      timestamp: now,
      timeStr: new Date().toLocaleTimeString(),
      type,
      detail,
    };
    this.events.push(event);
    if (this.events.length > 40) {
      this.events.shift();
    }
    this.notify();
  }

  public setVideoInputs(inputs: EnumeratedVideoInput[]) {
    this.videoInputs = inputs.map((item) => ({ ...item }));
    this.notify();
  }

  public logZoomAction(
    entry: Omit<ZoomActionLogEntry, "timestamp" | "timeStr" | "opticalNotice"> & {
      opticalNotice?: string;
    }
  ) {
    const now = performance.now();
    const fullEntry: ZoomActionLogEntry = {
      ...entry,
      timestamp: now,
      timeStr: new Date().toLocaleTimeString(),
      opticalNotice: entry.opticalNotice ?? getOpticalStatusNotice(entry.opticalVerification),
    };

    this.lastZoomAction = fullEntry;

    // Coalesce rapid continuous pinch updates (within 400ms) if status and device are unchanged,
    // while keeping every discrete 0.5x/1x/2x/3x action and any error as separate entries.
    const prev = this.zoomHistory[this.zoomHistory.length - 1];
    if (
      entry.action === "pinch" &&
      prev &&
      prev.action === "pinch" &&
      prev.constraintStatus === entry.constraintStatus &&
      prev.activeDeviceIdRedacted === entry.activeDeviceIdRedacted &&
      entry.constraintStatus !== "error" &&
      now - prev.timestamp < 400
    ) {
      this.zoomHistory[this.zoomHistory.length - 1] = fullEntry;
    } else {
      this.zoomHistory.push(fullEntry);
      if (this.zoomHistory.length > 30) {
        this.zoomHistory.shift();
      }
    }

    const summaryDetail = `${fullEntry.action} [${fullEntry.mechanism}] req=${fullEntry.requestedValue.toFixed(2)}x rep=${
      fullEntry.reportedZoomAfter != null ? `${fullEntry.reportedZoomAfter.toFixed(2)}x` : "n/a"
    } crop=${fullEntry.effectiveAppDigitalCrop.toFixed(2)}x dev=${fullEntry.activeDeviceIdRedacted} (${fullEntry.constraintStatus}${
      fullEntry.constraintError ? `: ${fullEntry.constraintError}` : ""
    })`;
    this.logEvent("ZOOM_ACTION", summaryDetail);
  }

  public logInvariantViolation(msg: string) {
    const text = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.invariantViolations.push(text);
    if (this.invariantViolations.length > 20) {
      this.invariantViolations.shift();
    }
    this.logEvent("INVARIANT_VIOLATION", msg);
  }

  public startShutterMark(id = `shot-${Date.now()}`): ShutterMeasurement {
    const t0 = performance.now();
    performance.mark(`shutter_t0_${id}`);
    const m: ShutterMeasurement = {
      id,
      timestamp: Date.now(),
      t0,
    };
    this.currentMeasurement = m;
    this.notify();
    return m;
  }

  public recordMark(mark: "t1" | "t2" | "t3" | "t4" | "t5" | "t6" | "t7") {
    if (!this.currentMeasurement) return;
    const now = performance.now();
    const markName = `shutter_${mark}_${this.currentMeasurement.id}`;
    performance.mark(markName);

    this.currentMeasurement[mark] = now;
    if (mark === "t1" && this.currentMeasurement.t0) {
      this.currentMeasurement.latencyT1 = now - this.currentMeasurement.t0;
    }
    if (mark === "t4" && this.currentMeasurement.t0) {
      this.currentMeasurement.latencyT4 = now - this.currentMeasurement.t0;
    }

    if (mark === "t4" || mark === "t5") {
      // Record completed shot to history
      if (!this.shutterHistory.some((s) => s.id === this.currentMeasurement?.id)) {
        this.shutterHistory.push({ ...this.currentMeasurement });
      } else {
        const idx = this.shutterHistory.findIndex((s) => s.id === this.currentMeasurement?.id);
        if (idx >= 0) this.shutterHistory[idx] = { ...this.currentMeasurement };
      }
    }
    this.notify();
  }

  private currentRvfcLatencyMs: number | null = null;

  public recordRvfcLatency(durationMs: number) {
    this.currentRvfcLatencyMs = Math.round(durationMs * 10) / 10;
  }

  public recordKeepToLive(durationMs: number) {
    if (this.currentMeasurement) {
      this.currentMeasurement.latencyKeepToLive = durationMs;
      this.notify();
    }
  }

  public getShutterStats() {
    const t4Latencies = this.shutterHistory
      .map((s) => s.latencyT4)
      .filter((v): v is number => typeof v === "number");
    const t1Latencies = this.shutterHistory
      .map((s) => s.latencyT1)
      .filter((v): v is number => typeof v === "number");

    const p = (arr: number[], pct: number) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * pct)));
      return sorted[idx];
    };

    return {
      count: this.shutterHistory.length,
      t1_avg: t1Latencies.length ? t1Latencies.reduce((a, b) => a + b, 0) / t1Latencies.length : 0,
      t1_p50: p(t1Latencies, 0.5),
      t1_p95: p(t1Latencies, 0.95),
      t4_avg: t4Latencies.length ? t4Latencies.reduce((a, b) => a + b, 0) / t4Latencies.length : 0,
      t4_p50: p(t4Latencies, 0.5),
      t4_p95: p(t4Latencies, 0.95),
    };
  }

  public getState(): DiagnosticsState {
    return {
      lifecycleEvents: [...this.events],
      shutterHistory: [...this.shutterHistory],
      lastMeasurement: this.currentMeasurement ? { ...this.currentMeasurement } : null,
      invariantViolations: [...this.invariantViolations],
      videoInputs: [...this.videoInputs],
      zoomHistory: [...this.zoomHistory],
      lastZoomAction: this.lastZoomAction ? { ...this.lastZoomAction } : null,
      rvfcLatencyMs: this.currentRvfcLatencyMs,
    };
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public reset() {
    this.events = [];
    this.shutterHistory = [];
    this.currentMeasurement = null;
    this.invariantViolations = [];
    this.videoInputs = [];
    this.zoomHistory = [];
    this.lastZoomAction = null;
    this.currentRvfcLatencyMs = null;
    this.notify();
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }
}

export const diagnostics = new CameraDiagnosticsTracker();
