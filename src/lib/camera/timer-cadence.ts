/**
 * Vintage Point-and-Shoot Camera Self-Timer Cadence Scheduler
 *
 * Implements the authentic cadence of classic 1990s 35mm compact cameras
 * (Olympus Stylus / Yashica T4 / Canon Sure Shot):
 *
 * - Seconds 10 down to 4 (1 blip/sec):
 *   At +0ms: 1 short blip (140ms ON, then OFF) + audio tick + haptic.
 *
 * - Seconds 3 and 2 (Accelerated double-time blips, 2 blips/sec):
 *   Blip 1: +0ms ON -> +130ms OFF.
 *   Gap:    320ms gap (lets hardware LED driver settle).
 *   Blip 2: +450ms ON -> +580ms OFF.
 *
 * - Final Second 1 (Long hold + Auto-Exposure pause):
 *   Long Hold: +0ms ON -> +600ms steady hold ("Hold your smile!").
 *   Pause:     +600ms OFF -> +1000ms (400ms complete stop).
 *              Signals imminent snap and allows the camera sensor / AE
 *              to recover from the LED pulse before capture.
 *
 * - Capture:
 *   At t = totalSeconds * 1000ms: fires shutter capture.
 *
 * - Cancellation:
 *   Immediately clears all timeouts, turns off torch, turns off visual cue,
 *   and resets countdown to 0.
 */

export interface TimerSchedulerOptions {
  totalSeconds: number; // 3 or 10
  onCountdownUpdate: (remaining: number) => void;
  onCueChange: (active: boolean) => void;
  onTorchPulse: (durationMs: number) => void;
  onTorchHold: (on: boolean) => void;
  onCapture: () => void;
  onTickAudio?: (type: "single" | "double" | "hold") => void;
  onHaptic?: (pattern: number[]) => void;
}

export interface TimerScheduler {
  start: () => void;
  cancel: () => void;
  isActive: () => boolean;
}

export function createTimerScheduler(options: TimerSchedulerOptions): TimerScheduler {
  const {
    totalSeconds,
    onCountdownUpdate,
    onCueChange,
    onTorchPulse,
    onTorchHold,
    onCapture,
    onTickAudio,
    onHaptic,
  } = options;

  let timeouts: ReturnType<typeof setTimeout>[] = [];
  let running = false;

  const schedule = (fn: () => void, delayMs: number) => {
    if (delayMs === 0) {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }
    const id = setTimeout(fn, delayMs);
    timeouts.push(id);
    return id;
  };

  const cancel = () => {
    timeouts.forEach((id) => clearTimeout(id));
    timeouts = [];
    if (running) {
      running = false;
      onCueChange(false);
      onTorchHold(false);
      onCountdownUpdate(0);
    }
  };

  const start = () => {
    cancel();
    if (totalSeconds <= 0) {
      onCapture();
      return;
    }

    running = true;

    // Schedule second-by-second cadence
    for (let sec = totalSeconds; sec >= 1; sec--) {
      const secondOffsetMs = (totalSeconds - sec) * 1000;

      if (sec >= 4) {
        // --- Single Blip: 1 blip per second (140ms on, 860ms off) ---
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(sec);
          onCueChange(true);
          onTorchPulse(140);
          onTickAudio?.("single");
          onHaptic?.([15]);
        }, secondOffsetMs);

        schedule(() => {
          if (!running) return;
          onCueChange(false);
        }, secondOffsetMs + 140);
      } else if (sec === 3 || sec === 2) {
        // --- Double-Time Blips: 2 blips per second ---
        // Sub-blip 1 (+0ms to +130ms)
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(sec);
          onCueChange(true);
          onTorchPulse(130);
          onTickAudio?.("double");
          onHaptic?.([15]);
        }, secondOffsetMs);

        schedule(() => {
          if (!running) return;
          onCueChange(false);
        }, secondOffsetMs + 130);

        // Sub-blip 2 (+450ms to +580ms)
        schedule(() => {
          if (!running) return;
          onCueChange(true);
          onTorchPulse(130);
          onTickAudio?.("double");
          onHaptic?.([15]);
        }, secondOffsetMs + 450);

        schedule(() => {
          if (!running) return;
          onCueChange(false);
        }, secondOffsetMs + 580);
      } else if (sec === 1) {
        // --- Final Second: Long 600ms hold + 400ms exposure recovery pause ---
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(1);
          onCueChange(true);
          onTorchHold(true);
          onTickAudio?.("hold");
          onHaptic?.([30]);
        }, secondOffsetMs);

        schedule(() => {
          if (!running) return;
          onCueChange(false);
          onTorchHold(false);
        }, secondOffsetMs + 600);
      }
    }

    // --- Final Shutter Capture Trigger ---
    schedule(() => {
      if (!running) return;
      running = false;
      onCountdownUpdate(0);
      onCapture();
    }, totalSeconds * 1000);
  };

  return {
    start,
    cancel,
    isActive: () => running,
  };
}
