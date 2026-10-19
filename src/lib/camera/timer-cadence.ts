/**
 * Google Pixel 10 Self-Timer Cadence Scheduler
 *
 * Implements a clean, distraction-free countdown cadence:
 *
 * - Seconds 10 down to 4 (Sustained 1 beat/sec):
 *   At +0ms: Updates countdown on shutter button, fires 880Hz audio tick + gentle haptic.
 *
 * - Seconds 3 and 2 (Accelerated double-time urgency: 2 beats/sec):
 *   Beat 1 at +0ms: Updates countdown on shutter button, fires 1100Hz audio tick + haptic.
 *   Beat 2 at +420ms: Fires 1100Hz audio tick + haptic.
 *
 * - Final Second 1:
 *   At +0ms: Updates countdown to 1 on shutter button, fires crisp audio tick + haptic.
 *   Provides full stillness and ambient lighting stability before 0s capture.
 *
 * - Shutter Capture:
 *   At t = totalSeconds * 1000ms: Resets countdown to 0 and fires onCapture().
 *
 * - Cancellation:
 *   Immediately clears all scheduled timeouts and resets countdown to 0.
 *
 * Hardware Torch Note:
 * Hardware LED blipping during the countdown is intentionally disabled to avoid
 * 100% current glare and residual flash bleed (see docs/TIMER_FLASH_NOTES.md).
 * The hardware torch is reserved exclusively for actual photo capture at 0s.
 */

export interface TimerSchedulerOptions {
  totalSeconds: number; // 3, 5, or 10
  onCountdownUpdate: (remaining: number) => void;
  onCapture: () => void;
  onTickAudio?: (type: "single" | "double" | "fast") => void;
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
        // --- Sustained Beat: 1 beat per second ---
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(sec);
          onTickAudio?.("single");
          onHaptic?.([15]);
        }, secondOffsetMs);
      } else if (sec === 3 || sec === 2) {
        // --- Double-Time Fast Cadence: 2 beats per second ---
        // Sub-beat 1 (+0ms)
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(sec);
          onTickAudio?.("double");
          onHaptic?.([15]);
        }, secondOffsetMs);

        // Sub-beat 2 (+420ms)
        schedule(() => {
          if (!running) return;
          onTickAudio?.("double");
          onHaptic?.([15]);
        }, secondOffsetMs + 420);
      } else if (sec === 1) {
        // --- Final Second: 1s digit update with crisp final tick ---
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(1);
          onTickAudio?.("fast");
          onHaptic?.([20]);
        }, secondOffsetMs);
      }
    }

    // --- Final Shutter Capture Trigger at 0s ---
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
