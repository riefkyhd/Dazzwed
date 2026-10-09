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

export interface DiagnosticsState {
  lifecycleEvents: LifecycleEvent[];
  shutterHistory: ShutterMeasurement[];
  lastMeasurement: ShutterMeasurement | null;
  invariantViolations: string[];
}

type Listener = (state: DiagnosticsState) => void;

class CameraDiagnosticsTracker {
  private events: LifecycleEvent[] = [];
  private shutterHistory: ShutterMeasurement[] = [];
  private currentMeasurement: ShutterMeasurement | null = null;
  private invariantViolations: string[] = [];
  private listeners = new Set<Listener>();

  constructor() {
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
    if (this.events.length > 30) {
      this.events.shift();
    }
    this.notify();
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

  public recordMark(mark: "t1" | "t2" | "t3" | "t4" | "t5" | "t6" | "t7", id?: string) {
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
    };
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }
}

export const diagnostics = new CameraDiagnosticsTracker();
