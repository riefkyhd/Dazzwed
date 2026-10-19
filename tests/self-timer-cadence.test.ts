import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTimerScheduler } from "@/lib/camera/timer-cadence";

describe("Google Pixel 10 Self-Timer Cadence Engine (Streamlined)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes the exact 10s countdown cadence with sustained beats, double fast beats, and capture at 0s", () => {
    const countdownUpdates: number[] = [];
    const audioEvents: { time: number; type: string }[] = [];
    const hapticEvents: { time: number; pattern: number[] }[] = [];
    let captureFiredAt: number | null = null;

    const scheduler = createTimerScheduler({
      totalSeconds: 10,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onTickAudio: (type) => audioEvents.push({ time: Date.now(), type }),
      onHaptic: (pattern) => hapticEvents.push({ time: Date.now(), pattern }),
      onCapture: () => {
        captureFiredAt = Date.now();
      },
    });

    scheduler.start();
    expect(scheduler.isActive()).toBe(true);

    // Initial state at t = 0ms (sec = 10)
    expect(countdownUpdates).toEqual([10]);
    expect(audioEvents).toEqual([{ time: 0, type: "single" }]);
    expect(hapticEvents).toEqual([{ time: 0, pattern: [15] }]);

    // Advance to 1000ms (sec = 9)
    vi.advanceTimersByTime(1000);
    expect(countdownUpdates).toContain(9);
    expect(audioEvents[1]).toEqual({ time: 1000, type: "single" });

    // Advance through sec 8, 7, 6, 5, 4 (up to 7000ms = sec 3)
    vi.advanceTimersByTime(6000);
    expect(countdownUpdates).toContain(4);
    expect(countdownUpdates).toContain(3);

    // At t = 7000ms (sec = 3): Fast Sub-beat 1
    const audioAtSec3 = audioEvents.filter((p) => p.time >= 7000 && p.time < 8000);
    expect(audioAtSec3).toHaveLength(1);
    expect(audioAtSec3[0]).toEqual({ time: 7000, type: "double" });

    // Sub-beat 2 fires at +420ms (t = 7420ms)
    vi.advanceTimersByTime(420);
    const audioAtSec3Both = audioEvents.filter((p) => p.time >= 7000 && p.time < 8000);
    expect(audioAtSec3Both).toHaveLength(2);
    expect(audioAtSec3Both[1]).toEqual({ time: 7420, type: "double" });

    // Advance to t = 9000ms (sec = 1: Final second)
    vi.advanceTimersByTime(1580); // 7420 + 1580 = 9000ms
    expect(countdownUpdates).toContain(1);
    const audioAtSec1 = audioEvents.filter((p) => p.time >= 9000 && p.time < 10000);
    expect(audioAtSec1).toHaveLength(1);
    expect(audioAtSec1[0]).toEqual({ time: 9000, type: "fast" });

    // Before 10000ms, capture has not fired
    vi.advanceTimersByTime(999);
    expect(captureFiredAt).toBeNull();

    // At t = 10000ms -> Shutter capture fires!
    vi.advanceTimersByTime(1);
    expect(captureFiredAt).toBe(10000);
    expect(countdownUpdates[countdownUpdates.length - 1]).toBe(0);
    expect(scheduler.isActive()).toBe(false);
  });

  it("executes the 5s countdown cadence cleanly with sustained beats, double beats, and capture", () => {
    const countdownUpdates: number[] = [];
    const audioEvents: { time: number; type: string }[] = [];
    let captureFiredAt: number | null = null;

    const scheduler = createTimerScheduler({
      totalSeconds: 5,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onTickAudio: (type) => audioEvents.push({ time: Date.now(), type }),
      onCapture: () => {
        captureFiredAt = Date.now();
      },
    });

    scheduler.start();

    // Sec = 5 (t = 0ms): sustained
    expect(countdownUpdates).toEqual([5]);
    expect(audioEvents).toEqual([{ time: 0, type: "single" }]);

    // Advance to sec = 4 (t = 1000ms): sustained
    vi.advanceTimersByTime(1000);
    expect(countdownUpdates).toEqual([5, 4]);
    expect(audioEvents[1]).toEqual({ time: 1000, type: "single" });

    // Advance to sec = 3 (t = 2000ms): fast double beats at 2000 and 2420
    vi.advanceTimersByTime(1000);
    expect(countdownUpdates).toEqual([5, 4, 3]);
    expect(audioEvents[2]).toEqual({ time: 2000, type: "double" });

    vi.advanceTimersByTime(420);
    expect(audioEvents[3]).toEqual({ time: 2420, type: "double" });

    // Advance to sec = 2 (t = 3000ms): fast double beats at 3000 and 3420
    vi.advanceTimersByTime(580); // 2420 + 580 = 3000ms
    expect(countdownUpdates).toEqual([5, 4, 3, 2]);
    expect(audioEvents[4]).toEqual({ time: 3000, type: "double" });

    vi.advanceTimersByTime(420);
    expect(audioEvents[5]).toEqual({ time: 3420, type: "double" });

    // Advance to sec = 1 (t = 4000ms): final second
    vi.advanceTimersByTime(580); // 3420 + 580 = 4000ms
    expect(countdownUpdates).toEqual([5, 4, 3, 2, 1]);
    expect(audioEvents[6]).toEqual({ time: 4000, type: "fast" });

    // Advance to capture (t = 5000ms)
    vi.advanceTimersByTime(1000);
    expect(captureFiredAt).toBe(5000);
    expect(countdownUpdates).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("executes the 3s accelerated cadence cleanly with double beats and final 1s tick", () => {
    const countdownUpdates: number[] = [];
    const audioEvents: { time: number; type: string }[] = [];
    let captured = false;

    const scheduler = createTimerScheduler({
      totalSeconds: 3,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onTickAudio: (type) => audioEvents.push({ time: Date.now(), type }),
      onCapture: () => {
        captured = true;
      },
    });

    scheduler.start();

    // Starts directly at sec = 3 with double beat
    expect(countdownUpdates[0]).toBe(3);
    expect(audioEvents[0]).toEqual({ time: 0, type: "double" });

    // Advance to completion (3000ms)
    vi.advanceTimersByTime(3000);
    expect(captured).toBe(true);
    expect(countdownUpdates).toEqual([3, 2, 1, 0]);
  });

  it("cleans up immediately and aborts capture when cancelled mid-countdown", () => {
    let captured = false;
    let lastCountdown = 10;

    const scheduler = createTimerScheduler({
      totalSeconds: 10,
      onCountdownUpdate: (rem) => {
        lastCountdown = rem;
      },
      onCapture: () => {
        captured = true;
      },
    });

    scheduler.start();
    expect(scheduler.isActive()).toBe(true);

    // Let it tick to 2500ms
    vi.advanceTimersByTime(2500);
    expect(lastCountdown).toBe(8);

    // User taps Shutter button to cancel
    scheduler.cancel();
    expect(scheduler.isActive()).toBe(false);
    expect(lastCountdown).toBe(0);

    // Advance time past 10000ms to ensure no orphaned timeouts trigger
    vi.advanceTimersByTime(10000);
    expect(captured).toBe(false);
  });
});
