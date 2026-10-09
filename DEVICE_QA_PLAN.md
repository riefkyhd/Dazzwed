# Plan: Device QA + Fix Pass (Real Device on Pixel 10)

## Objectives
Execute an end-to-end Device QA and Fix Pass for the camera screen on the connected physical phone (Google Pixel 10 `56051FDCR005AC` over ADB and CDP):
1. Build and verify the device harness (`npm run device:qa` / `scripts/device-qa.mjs`).
2. Add in-app debug HUD (`/debug/hud` and `?debug=1`).
3. Harden the Camera Lifecycle Recovery Ladder (never require a new tab, seamless recovery, in-place permission prompt retry, blurred last frame).
4. Viewfinder geometry verification ($0.750 \pm 0.005$ aspect ratio, symmetric gold corner brackets in DOM and true screencap pixels, visualViewport resize watchdog).
5. Shutter latency optimization ($t_1 \le 50\text{ms}$, $t_4 \le 250\text{ms}$, Keep $\to$ live view $\le 100\text{ms}$, background WebWorker JPEG encoding, pre-warmed offscreen WebGL).
6. Complete scenario matrix sweep, generate `DEVICE_QA_REPORT.md` with before/after benchmarks and screencap evidence.

---

## Phase 1: Real-Device Test Harness (`scripts/device-qa.mjs`)
- **ADB & CDP Plumbing**:
  - Auto-resolve `adb` (`/Users/administrator/Library/Android/sdk/platform-tools/adb`).
  - Forward port `9222` to `localabstract:chrome_devtools_remote`.
  - Reverse port `3000` to local Next.js dev server.
  - Native Node.js `WebSocket` client connecting to Chrome DevTools Protocol targets.
  - Support ADB automation commands: `screencap -p`, `input keyevent 26` (lock), `wm dismiss-keyguard` (unlock), `user_rotation` (orientation change), `input tap`.
  - Color detection & pixel analysis script for true-pixel bracket symmetry validation from screencaps.
  - Package script entry in `package.json`: `"device:qa": "node scripts/device-qa.mjs"`.

---

## Phase 2: In-App Debug HUD (`/debug/hud` & `?debug=1`)
- Create `<CameraDebugHud />` component:
  - Track states (`readyState`, `muted`, `settings.width`, `height`, `frameRate`, `facingMode`).
  - Permissions API status (`granted`, `prompt`, `denied`).
  - Viewfinder DOM metrics: measured width, height, aspect ratio, bracket offsets, invariant checks.
  - Lifecycle event log (last 20 events with relative timestamp ms).
  - Shutter marks ($t_0 \dots t_7$) with average and p95 latency.
  - "Copy Diagnostic JSON" button.

---

## Phase 3: Camera Lifecycle Recovery Ladder
- In `src/lib/camera/useCamera.ts` and `src/components/camera/CameraScreen.tsx`:
  - **Single-tab recovery**: The camera route never unmounts or navigates away.
  - **Background behavior**: Immediately freeze/pause preview on `visibilitychange: hidden`. If hidden $> 45\text{s}$, stop active media tracks to preserve battery and privacy.
  - **Resume behavior**: On `visibilitychange: visible` / `pageshow` / `focus`:
    1. Retain blurred last frame as backdrop.
    2. Silently re-acquire camera stream with same constraints.
    3. If re-acquire fails with `NotAllowedError` and state is `"prompt"`, render an in-place "Tap to enable camera" button calling `getUserMedia` inside the click handler to trigger the browser's permission dialog.
    4. If state is `"denied"`, render browser-specific step-by-step instructions (Chrome lock icon $\to$ Site settings $\to$ Camera $\to$ Allow) + "I've enabled it, retry" button + "Use phone's camera app" button (`<input type="file" capture="environment">`).
    5. Soft reload option that preserves session, offline upload queue, and user settings.
  - Pre-permission prompt: "Choose Allow (not 'Allow this time') so your camera keeps working."

---

## Phase 4: Viewfinder Geometry & Corner Bracket Symmetry
- In `src/lib/camera/useViewportLayout.ts`:
  - In 3:4 portrait mode, enforce `vfW / vfH === 0.750 \pm 0.005`.
  - Viewfinder must be contained within safe area and never clipped by top bar or controls.
  - Gold corner brackets positioned with exact matching insets on all 4 corners in CSS pixels and validated via ADB screencap.
  - VisualViewport watcher updating on resize, orientation change, and post-rAF / $250\text{ms}$ toolbar settle.
  - Layout invariant watchdog logging any violation to diagnostic events.

---

## Phase 5: Shutter Latency & Decoupled Worker Capture
- Ensure shutter latency meets budgets:
  - $t_0 \to t_1 \le 50\text{ms}$: Immediately trigger haptic + audio + viewfinder freeze (`isFrozenRef` with flash backdrop).
  - $t_0 \to t_2$: Frame grabbed via `createImageBitmap(video)`.
  - $t_0 \to t_3$: Pre-allocated offscreen WebGL pipeline renders look at capture resolution.
  - $t_0 \to t_4 \le 250\text{ms}$: Review UI displayed with processed frame.
  - $t_4 \to t_5$: JPEG conversion offloaded lazily in WebWorker (`OffscreenCanvas.convertToBlob`), unblocking the main thread completely.
  - Keep $\to$ live view: $\le 100\text{ms}$.
  - Retake $\to$ live view: immediate.

---

## Phase 6: Execution, Verification & Deliverables
1. Run `npm run device:qa` on the physical Pixel 10 to gather baseline metrics.
2. Apply implementation and run full scenario sweep:
   - 5s, 30s, 2min, 6min background tests.
   - Lock/unlock screen tests.
   - Denied/prompt recovery tests.
   - Bracket symmetry screencap pixel tests.
   - 30-shot shutter latency benchmark (p50/p95).
3. Playwright automated regression tests.
4. Deliver comprehensive `DEVICE_QA_REPORT.md`.
