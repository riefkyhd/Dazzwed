# Unveiled Project Backlog & Future Tasks

## Camera & Viewfinder

### [ ] Tap-to-Focus & Exposure Metering
- **Research Status**: Completed (see `/Users/administrator/.gemini/antigravity/brain/12267a2d-80c6-40b4-9a8b-4a45926ba66e/tap_to_focus_plan.md`).
- **Platform Reality**:
  - **iOS Safari (WebKit)**: Hardware focus point APIs (`focusMode`, `pointsOfInterest`, `focusDistance`) are completely omitted in WebKit IDL (`// FIXME` markers). The camera always operates on continuous autofocus (CAF).
  - **Android Chrome (Chromium Camera2)**: Hardware `pointsOfInterest` is supported on compatible sensors via `MediaStreamTrack.applyConstraints({ advanced: [{ pointsOfInterest: [{ x, y }] }] })`.
- **Planned Implementation (Hybrid Graceful Degradation)**:
  1. **UI Simulation**: On tap/touch within the viewfinder, render a gold animated focus reticle square that springs down from 64px to 48px, pulses, and auto-fades after 1.5s.
  2. **Haptic Feedback**: Trigger `navigator.vibrate(20)` for tactile confirmation.
  3. **Hardware Constraint**: If `navigator.mediaDevices.getSupportedConstraints().pointsOfInterest` is true, calculate normalized sensor coordinates $(0.0 - 1.0)$ and dispatch `pointsOfInterest` inside an isolated `advanced` constraint set.
  4. **Gesture Disambiguation**: Ignore taps when multi-touch pinch-to-zoom is active.
