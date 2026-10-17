import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTimerScheduler } from "@/lib/camera/timer-cadence";

describe("Vintage Self-Timer Cadence Engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes the exact 10s countdown cadence with single, double, and hold blips", () => {
    const countdownUpdates: number[] = [];
    const cueEvents: { time: number; active: boolean }[] = [];
    const torchPulses: { time: number; durationMs: number }[] = [];
    const torchHolds: { time: number; on: boolean }[] = [];
    let captureFiredAt: number | null = null;

    const scheduler = createTimerScheduler({
      totalSeconds: 10,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onCueChange: (active) => cueEvents.push({ time: Date.now(), active }),
      onTorchPulse: (durationMs) => torchPulses.push({ time: Date.now(), durationMs }),
      onTorchHold: (on) => torchHolds.push({ time: Date.now(), on }),
      onCapture: () => {
        captureFiredAt = Date.now();
      },
    });

    scheduler.start();
    expect(scheduler.isActive()).toBe(true);

    // Initial state at t = 0ms (sec = 10)
    expect(countdownUpdates).toEqual([10]);
    expect(torchPulses).toEqual([{ time: 0, durationMs: 140 }]);
    expect(cueEvents).toEqual([{ time: 0, active: true }]);

    // Advance 140ms -> cue turns off
    vi.advanceTimersByTime(140);
    expect(cueEvents).toEqual([
      { time: 0, active: true },
      { time: 140, active: false },
    ]);

    // Advance to 1000ms (sec = 9)
    vi.advanceTimersByTime(860);
    expect(countdownUpdates).toContain(9);
    expect(torchPulses).toHaveLength(2);
    expect(torchPulses[1]).toEqual({ time: 1000, durationMs: 140 });

    // Advance through sec 8, 7, 6, 5, 4 (up to 7000ms = sec 3)
    vi.advanceTimersByTime(6000);
    expect(countdownUpdates).toContain(4);
    expect(countdownUpdates).toContain(3);

    // At t = 7000ms (sec = 3): Sub-blip 1
    const blipsAtSec3 = torchPulses.filter((p) => p.time >= 7000 && p.time < 8000);
    expect(blipsAtSec3).toHaveLength(1);
    expect(blipsAtSec3[0]).toEqual({ time: 7000, durationMs: 130 });

    // Sub-blip 1 ends at 7130ms
    vi.advanceTimersByTime(130);
    expect(cueEvents[cueEvents.length - 1]).toEqual({ time: 7130, active: false });

    // Sub-blip 2 fires at 7450ms
    vi.advanceTimersByTime(320);
    const blipsAtSec3All = torchPulses.filter((p) => p.time >= 7000 && p.time < 8000);
    expect(blipsAtSec3All).toHaveLength(2);
    expect(blipsAtSec3All[1]).toEqual({ time: 7450, durationMs: 130 });

    // Sub-blip 2 ends at 7580ms
    vi.advanceTimersByTime(130);
    expect(cueEvents[cueEvents.length - 1]).toEqual({ time: 7580, active: false });

    // Advance to t = 9000ms (sec = 1: Long Hold)
    vi.advanceTimersByTime(1420); // 7580 + 1420 = 9000
    expect(countdownUpdates).toContain(1);
    expect(torchHolds).toContainEqual({ time: 9000, on: true });

    // At t = 9600ms (600ms hold ends -> 400ms pause begins)
    vi.advanceTimersByTime(600);
    expect(torchHolds).toContainEqual({ time: 9600, on: false });
    expect(cueEvents[cueEvents.length - 1]).toEqual({ time: 9600, active: false });
    expect(captureFiredAt).toBeNull(); // No capture during 400ms pause

    // At t = 10000ms -> Capture fires!
    vi.advanceTimersByTime(400);
    expect(captureFiredAt).toBe(10000);
    expect(countdownUpdates[countdownUpdates.length - 1]).toBe(0);
    expect(scheduler.isActive()).toBe(false);
  });

  it("executes the 3s accelerated cadence cleanly", () => {
    const countdownUpdates: number[] = [];
    const torchPulses: { time: number; durationMs: number }[] = [];
    let captured = false;

    const scheduler = createTimerScheduler({
      totalSeconds: 3,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onCueChange: () => {},
      onTorchPulse: (durationMs) => torchPulses.push({ time: Date.now(), durationMs }),
      onTorchHold: () => {},
      onCapture: () => {
        captured = true;
      },
    });

    scheduler.start();

    // Starts directly at sec = 3 with double blip
    expect(countdownUpdates[0]).toBe(3);
    expect(torchPulses).toEqual([{ time: 0, durationMs: 130 }]);

    // Advance to completion (3000ms)
    vi.advanceTimersByTime(3000);
    expect(captured).toBe(true);
    expect(countdownUpdates).toEqual([3, 2, 1, 0]);
  });

  it("cleans up immediately when cancelled mid-countdown", () => {
    let captured = false;
    let cueActive = false;
    let torchOn = false;
    let lastCountdown = 10;

    const scheduler = createTimerScheduler({
      totalSeconds: 10,
      onCountdownUpdate: (rem) => {
        lastCountdown = rem;
      },
      onCueChange: (active) => {
        cueActive = active;
      },
      onTorchPulse: () => {
        torchOn = true;
      },
      onTorchHold: (on) => {
        torchOn = on;
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
    expect(cueActive).toBe(false);
    expect(torchOn).toBe(false);
    expect(lastCountdown).toBe(0);

    // Advance time past 10000ms to ensure no orphaned timeouts trigger
    vi.advanceTimersByTime(10000);
    expect(captured).toBe(false);
  });

  it("safely executes countdown with audio ticks and haptics when torch callbacks are omitted", () => {
    const audioTicks: string[] = [];
    const haptics: number[][] = [];
    let captured = false;
    let finalCaptureTime: number | null = null;

    const scheduler = createTimerScheduler({
      totalSeconds: 3,
      onCountdownUpdate: () => {},
      onCueChange: () => {},
      // Torch omitted to protect camera sensor auto-exposure from flashing
      onCapture: () => {
        captured = true;
        finalCaptureTime = Date.now();
      },
      onTickAudio: (type) => audioTicks.push(type),
      onHaptic: (pattern) => haptics.push(pattern),
    });

    scheduler.start();
    expect(scheduler.isActive()).toBe(true);

    // Initial tick at t=0
    expect(audioTicks).toEqual(["double"]);
    expect(haptics).toHaveLength(1);

    // Advance 3000ms
    vi.advanceTimersByTime(3000);
    expect(captured).toBe(true);
    expect(finalCaptureTime).toBe(3000);
    expect(audioTicks).toContain("hold");
    expect(scheduler.isActive()).toBe(false);
  });
});
