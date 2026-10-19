/**
 * Google Pixel 10 Self-Timer Cadence Scheduler
 *
 * Implements the authentic, eye-safe countdown cadence:
 *
 * - Seconds 10 down to 4 (Sustained 1 beat/sec: 1.. 2..):
 *   At +0ms: Set viewfinder cue active (450ms warm amber glow) +
 *            hardware torch micro-pulse (45ms-55ms) + audio tick (880Hz) + haptic.
 *   At +450ms: Set viewfinder cue inactive (550ms off gap).
 *
 * - Seconds 3 and 2 (Accelerated double-time blips: 2 blips/sec):
 *   Blip 1: +0ms ON -> +120ms OFF (fast 50ms torch blip).
 *   Gap:    300ms gap.
 *   Blip 2: +420ms ON -> +540ms OFF (fast 50ms torch blip).
 *   Hard Kill: At +550ms into second 2 (1,450ms before shutter capture at 0s),
 *              fires onTorchKill() to guarantee complete hardware torch lockout.
 *
 * - Final Second 1 (Absolute Stillness & Auto-Exposure Recovery):
 *   No blipping at all. Cue stays inactive, torch stays strictly locked OFF.
 *   Provides 1,460ms of uninterrupted ambient lighting before 0s capture,
 *   completely eliminating residual flash bleed and letting the camera
 *   sensor's Auto-Exposure (AE) & Auto-White-Balance (AWB) lock cleanly.
 *
 * - Shutter Capture:
 *   At t = totalSeconds * 1000ms: fires shutter capture.
 *
 * - Cancellation:
 *   Immediately clears all timeouts, kills torch, resets cue,
 *   and resets countdown to 0.
 */

export interface TimerSchedulerOptions {
  totalSeconds: number; // 3, 5, or 10
  onCountdownUpdate: (remaining: number) => void;
  onCueChange: (active: boolean) => void;
  onTorchMode?: (mode: "sustained" | "fast") => void;
  onTorchPulse?: (durationMs: number) => void;
  onTorchHold?: (on: boolean) => void;
  onTorchKill?: () => void;
  onCapture: () => void;
  onTickAudio?: (type: "single" | "double" | "hold" | "sustained" | "fast") => void;
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
    onTorchMode,
    onTorchPulse,
    onTorchHold,
    onTorchKill,
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
      onTorchKill?.();
      onTorchHold?.(false);
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
        // --- Sustained Beat: 1 beat per second (450ms warm amber cue glow) ---
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(sec);
          onCueChange(true);
          if (onTorchMode) {
            onTorchMode("sustained");
          } else if (onTorchPulse) {
            onTorchPulse(55);
          }
          onTickAudio?.("single");
          onHaptic?.([15]);
        }, secondOffsetMs);

        schedule(() => {
          if (!running) return;
          onCueChange(false);
        }, secondOffsetMs + 450);
      } else if (sec === 3 || sec === 2) {
        // --- Double-Time Fast Blips: 2 blips per second ---
        // Sub-blip 1 (+0ms to +120ms)
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(sec);
          onCueChange(true);
          if (onTorchMode) {
            onTorchMode("fast");
          } else if (onTorchPulse) {
            onTorchPulse(50);
          }
          onTickAudio?.("double");
          onHaptic?.([15]);
        }, secondOffsetMs);

        schedule(() => {
          if (!running) return;
          onCueChange(false);
        }, secondOffsetMs + 120);

        // Sub-blip 2 (+420ms to +540ms)
        schedule(() => {
          if (!running) return;
          onCueChange(true);
          if (onTorchMode) {
            onTorchMode("fast");
          } else if (onTorchPulse) {
            onTorchPulse(50);
          }
          onTickAudio?.("double");
          onHaptic?.([15]);
        }, secondOffsetMs + 420);

        schedule(() => {
          if (!running) return;
          onCueChange(false);
        }, secondOffsetMs + 540);

        // Hard Torch Lockout at t = +550ms of second 2 (1,450ms before shutter capture at 0s)
        if (sec === 2) {
          schedule(() => {
            if (!running) return;
            onTorchKill?.();
            onTorchHold?.(false);
          }, secondOffsetMs + 550);
        }
      } else if (sec === 1) {
        // --- Final Second: Zero Blip Stillness for Auto-Exposure Stabilization ---
        schedule(() => {
          if (!running) return;
          onCountdownUpdate(1);
          onCueChange(false);
          // Hardware torch strictly OFF - NO calls to onTorchPulse or onTorchMode
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
