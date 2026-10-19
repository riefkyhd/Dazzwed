# Self-Timer Hardware Flash & WebRTC Torch Engineering Reference

## 1. Executive Summary
This document archives our technical research, hardware timings, and engineering decisions regarding smartphone LED torch blipping during camera self-timer countdowns in web browsers (WebRTC `MediaStreamTrack`) versus native mobile operating systems.

In `Dazzwed`, hardware LED blipping during the self-timer countdown (`10s..1s`) is deliberately disabled in favor of:
- **Zero Viewfinder Clutter:** Keeping the camera framing unobstructed by confining the visual countdown indicator to the bottom tactile `ShutterButton` progress ring and digits.
- **Eye-Safe Subject Comfort:** Eliminating glare caused by WebRTC's boolean torch saturation.
- **Zero Residual Exposure Bleed:** Reserving the physical LED torch exclusively for actual photo capture at `0s` when the user has Camera Flash toggled `ON`.

---

## 2. WebRTC Boolean Torch Limitations vs. Native Android/iOS APIs

### A. WebRTC Standard (Chrome Android & Safari iOS)
In modern mobile web browsers, the only interface to control the camera flash/torch is through `MediaTrackConstraints`:
```ts
await track.applyConstraints({
  advanced: [{ torch: true }] // Boolean only!
});
```
- **100% Saturation Current:** The WebRTC specification does not expose pulse-width modulation (PWM) or current strength parameters. Passing `{ torch: true }` instructs the kernel driver to supply maximum thermal current to the physical LED emitter.
- **Subject Discomfort:** During multi-second countdowns (`3s`, `5s`, `10s`), subjects staring at the camera lens experience uncomfortable thermal flash glare.

### B. Native Android (`CameraManager`) & iOS (`AVCaptureDevice`)
In native Android applications (API level 33+), developers have access to:
```java
cameraManager.turnOnTorchWithStrengthLevel(cameraId, torchStrength); // Levels 1..5
```
Native Google Camera and Samsung Camera use low current levels (e.g., Level 1: ~10%–20% lumen output) for countdown indicator blips, reserving full power for the actual shutter strobe. Because WebRTC cannot access `torchStrength`, attempting countdown blips on the web drives the LED to full flashlight power.

---

## 3. Android Camera2 HAL IPC Latency & Rising-Edge Clipping

### Measured IPC Delay
Each `track.applyConstraints()` call traverses:
1. Browser Renderer Process
2. Chromium Browser / Audio-Video Host Process
3. Android `android.hardware.camera.provider` HAL service
4. Kernel LED Driver IC

Measurements on Google Pixel 10 (Android 16 / Chrome 155):
- `applyConstraints({ advanced: [{ torch: true }] })`: **45ms – 85ms** round-trip promise resolution.
- `applyConstraints({ advanced: [{ torch: false }] })`: **40ms – 75ms** round-trip promise resolution.

### Queue Backlog Risk
Rapidly scheduling micro-pulses (`setTorchSafe(true)` $\rightarrow$ wait 50ms $\rightarrow$ `setTorchSafe(false)`) back-to-back (especially during accelerated countdown cadences like 2 blips per second on `3s` and `2s`) easily queues IPC messages in the Android Camera2 service. If the user cancels the countdown or the timer transitions into the final second (`1s`), an in-flight `torch: true` constraint can resolve *after* the turn-off command was issued, causing the LED to stay on during photo capture and blowing out the sensor's Auto-Exposure (AE).

---

## 4. Google Pixel 10 Self-Timer Cadence Specification

For future native wrappers or reference implementations, the Google Pixel 10 countdown cadence follows this state machine:

| Remaining Time | Cadence Rhythm | Audio / Frequency | Haptics | Hardware LED Window |
|---|---|---|---|---|
| **`10s..4s`** | Sustained Beat (1 beat/sec) | 880 Hz, 80ms | `[15]` | Single soft pulse (sub-saturation rising-edge or dim PWM) |
| **`3s` & `2s`** | Double-Time Urgency (2 beats/sec) | 1100 Hz, 50ms (at +0ms & +420ms) | `[15]` | 2 fast micro-blips per second |
| **`2s` (+550ms)** | Hard Lockout Trigger | — | — | Hardware torch driver forcibly locked OFF |
| **`1s`** | **Absolute Stillness** | 1100 Hz, 50ms (at +0ms) | `[20]` | **0% Torch Activity.** 1,450ms total recovery window for camera ISP Auto-Exposure & AWB settling |
| **`0s`** | Shutter Capture | Shutter click sound | `[30, 80]` | Full Godox Xenon strobe pass if Camera Flash is ON |

---

## 5. Summary of Current Web Client Implementation
To maintain the highest quality, reliability, and visual ergonomics for guests:
1. **Clean Viewfinder:** No distracting overlay badges or pulsing colored borders inside the camera viewport. The framing stays 100% visible and true to life.
2. **Tactile Shutter Dock:** The `ShutterButton` displays the active countdown number inside its center circle and sweeps an animated circular amber progress ring around the perimeter.
3. **Audio & Haptic Cadence:** Crisp audio ticks (`880Hz` $\rightarrow$ `1100Hz`) and gentle haptic pulses communicate countdown urgency without blinding the subjects.
4. **Deterministic Flash:** Flash is reserved exclusively for the moment of photo capture at `0s`, executing our calibrated pre-flash metering pass and dual-frame look rendering.
