import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTimerScheduler } from "@/lib/camera/timer-cadence";

describe("Google Pixel 10 Self-Timer Cadence Engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes the exact 10s countdown cadence with sustained beats, double fast blips, and zero-blip final second", () => {
    const countdownUpdates: number[] = [];
    const cueEvents: { time: number; active: boolean }[] = [];
    const torchModes: { time: number; mode: "sustained" | "fast" }[] = [];
    const torchKills: number[] = [];
    let captureFiredAt: number | null = null;

    const scheduler = createTimerScheduler({
      totalSeconds: 10,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onCueChange: (active) => cueEvents.push({ time: Date.now(), active }),
      onTorchMode: (mode) => torchModes.push({ time: Date.now(), mode }),
      onTorchKill: () => torchKills.push(Date.now()),
      onCapture: () => {
        captureFiredAt = Date.now();
      },
    });

    scheduler.start();
    expect(scheduler.isActive()).toBe(true);

    // Initial state at t = 0ms (sec = 10)
    expect(countdownUpdates).toEqual([10]);
    expect(torchModes).toEqual([{ time: 0, mode: "sustained" }]);
    expect(cueEvents).toEqual([{ time: 0, active: true }]);

    // Advance 450ms -> sustained cue turns off
    vi.advanceTimersByTime(450);
    expect(cueEvents).toEqual([
      { time: 0, active: true },
      { time: 450, active: false },
    ]);

    // Advance to 1000ms (sec = 9)
    vi.advanceTimersByTime(550);
    expect(countdownUpdates).toContain(9);
    expect(torchModes).toHaveLength(2);
    expect(torchModes[1]).toEqual({ time: 1000, mode: "sustained" });

    // Advance through sec 8, 7, 6, 5, 4 (up to 7000ms = sec 3)
    vi.advanceTimersByTime(6000);
    expect(countdownUpdates).toContain(4);
    expect(countdownUpdates).toContain(3);

    // At t = 7000ms (sec = 3): Fast Sub-blip 1
    const blipsAtSec3 = torchModes.filter((p) => p.time >= 7000 && p.time < 8000);
    expect(blipsAtSec3).toHaveLength(1);
    expect(blipsAtSec3[0]).toEqual({ time: 7000, mode: "fast" });

    // Sub-blip 1 ends at 7120ms
    vi.advanceTimersByTime(120);
    expect(cueEvents[cueEvents.length - 1]).toEqual({ time: 7120, active: false });

    // Sub-blip 2 fires at 7420ms
    vi.advanceTimersByTime(300);
    const blipsAtSec3All = torchModes.filter((p) => p.time >= 7000 && p.time < 8000);
    expect(blipsAtSec3All).toHaveLength(2);
    expect(blipsAtSec3All[1]).toEqual({ time: 7420, mode: "fast" });

    // Sub-blip 2 ends at 7540ms
    vi.advanceTimersByTime(120);
    expect(cueEvents[cueEvents.length - 1]).toEqual({ time: 7540, active: false });

    // Advance through sec 2 up to t = 8550ms: Hard torch lockout fires!
    vi.advanceTimersByTime(1010); // 7540 + 1010 = 8550ms (sec 2 offset 8000 + 550)
    expect(countdownUpdates).toContain(2);
    expect(torchKills).toContain(8550);

    // Advance to t = 9000ms (sec = 1: Absolute Stillness)
    vi.advanceTimersByTime(450); // 8550 + 450 = 9000ms
    expect(countdownUpdates).toContain(1);

    // Verify ZERO torch calls occurred during sec = 1 (from 9000ms to 10000ms)
    vi.advanceTimersByTime(999);
    const torchCallsInFinalSec = torchModes.filter((p) => p.time >= 9000);
    expect(torchCallsInFinalSec).toHaveLength(0);
    expect(captureFiredAt).toBeNull();

    // At t = 10000ms -> Shutter capture fires!
    vi.advanceTimersByTime(1);
    expect(captureFiredAt).toBe(10000);
    expect(countdownUpdates[countdownUpdates.length - 1]).toBe(0);
    expect(scheduler.isActive()).toBe(false);
  });

  it("executes the new 5s countdown cadence cleanly with sustained beats and double blips", () => {
    const countdownUpdates: number[] = [];
    const torchModes: { time: number; mode: "sustained" | "fast" }[] = [];
    const torchKills: number[] = [];
    let captureFiredAt: number | null = null;

    const scheduler = createTimerScheduler({
      totalSeconds: 5,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onCueChange: () => {},
      onTorchMode: (mode) => torchModes.push({ time: Date.now(), mode }),
      onTorchKill: () => torchKills.push(Date.now()),
      onCapture: () => {
        captureFiredAt = Date.now();
      },
    });

    scheduler.start();

    // Sec = 5 (t = 0ms): sustained
    expect(countdownUpdates).toEqual([5]);
    expect(torchModes).toEqual([{ time: 0, mode: "sustained" }]);

    // Advance to sec = 4 (t = 1000ms): sustained
    vi.advanceTimersByTime(1000);
    expect(countdownUpdates).toEqual([5, 4]);
    expect(torchModes[1]).toEqual({ time: 1000, mode: "sustained" });

    // Advance to sec = 3 (t = 2000ms): fast blips at 2000 and 2420
    vi.advanceTimersByTime(1000);
    expect(countdownUpdates).toEqual([5, 4, 3]);
    expect(torchModes[2]).toEqual({ time: 2000, mode: "fast" });

    vi.advanceTimersByTime(420);
    expect(torchModes[3]).toEqual({ time: 2420, mode: "fast" });

    // Advance to sec = 2 (t = 3000ms): fast blips at 3000 and 3420 + kill at 3550ms
    vi.advanceTimersByTime(580); // 2420 + 580 = 3000ms
    expect(countdownUpdates).toEqual([5, 4, 3, 2]);
    expect(torchModes[4]).toEqual({ time: 3000, mode: "fast" });

    vi.advanceTimersByTime(550); // 3000 + 550 = 3550ms
    expect(torchKills).toContain(3550);

    // Advance to sec = 1 (t = 4000ms): stillness (0 blips)
    vi.advanceTimersByTime(450); // 3550 + 450 = 4000ms
    expect(countdownUpdates).toEqual([5, 4, 3, 2, 1]);
    const finalSecTorch = torchModes.filter((p) => p.time >= 4000);
    expect(finalSecTorch).toHaveLength(0);

    // Advance to capture (t = 5000ms)
    vi.advanceTimersByTime(1000);
    expect(captureFiredAt).toBe(5000);
    expect(countdownUpdates).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("executes the 3s accelerated cadence cleanly with double blips and stillness on 1s", () => {
    const countdownUpdates: number[] = [];
    const torchModes: { time: number; mode: "sustained" | "fast" }[] = [];
    const torchKills: number[] = [];
    let captured = false;

    const scheduler = createTimerScheduler({
      totalSeconds: 3,
      onCountdownUpdate: (rem) => countdownUpdates.push(rem),
      onCueChange: () => {},
      onTorchMode: (mode) => torchModes.push({ time: Date.now(), mode }),
      onTorchKill: () => torchKills.push(Date.now()),
      onCapture: () => {
        captured = true;
      },
    });

    scheduler.start();

    // Starts directly at sec = 3 with double fast blip
    expect(countdownUpdates[0]).toBe(3);
    expect(torchModes).toEqual([{ time: 0, mode: "fast" }]);

    // Advance to completion (3000ms)
    vi.advanceTimersByTime(3000);
    expect(captured).toBe(true);
    expect(countdownUpdates).toEqual([3, 2, 1, 0]);
    expect(torchKills).toContain(1550); // t = 1000 + 550
  });

  it("cleans up immediately and kills torch when cancelled mid-countdown", () => {
    let captured = false;
    let cueActive = false;
    let killed = false;
    let lastCountdown = 10;

    const scheduler = createTimerScheduler({
      totalSeconds: 10,
      onCountdownUpdate: (rem) => {
        lastCountdown = rem;
      },
      onCueChange: (active) => {
        cueActive = active;
      },
      onTorchKill: () => {
        killed = true;
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
    expect(killed).toBe(true);
    expect(lastCountdown).toBe(0);

    // Advance time past 10000ms to ensure no orphaned timeouts trigger
    vi.advanceTimersByTime(10000);
    expect(captured).toBe(false);
  });

  it("guarantees 1,450ms of continuous hardware stillness before 0s capture", () => {
    const torchActivity: number[] = [];
    let capturedAt: number | null = null;

    const scheduler = createTimerScheduler({
      totalSeconds: 3,
      onCountdownUpdate: () => {},
      onCueChange: () => {},
      onTorchMode: () => torchActivity.push(Date.now()),
      onCapture: () => {
        capturedAt = Date.now();
      },
    });

    scheduler.start();
    vi.advanceTimersByTime(3000);

    expect(capturedAt).toBe(3000);
    const lastTorchTime = Math.max(...torchActivity);
    // Last fast blip on second 2 occurs at t = 1420ms
    expect(lastTorchTime).toBe(1420);
    // Total uninterrupted recovery time before 3000ms capture:
    const recoveryMs = 3000 - lastTorchTime;
    expect(recoveryMs).toBeGreaterThanOrEqual(1450);
  });
});
