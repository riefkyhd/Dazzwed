# Physical Device QA & Shutter Latency Audit Report

## 1. Test Environment & Target Physical Device
- **Device Model**: Google Pixel 10
- **Serial / Device ID**: `56051FDCR005AC`
- **Operating System**: Android 16 (API 36)
- **Display Specifications**: 1080 x 2424 px @ 420 dpi, Device Pixel Ratio (DPR) 2.625
- **Browser**: Google Chrome Mobile (driving CDP over port 9222 via USB ADB)
- **Network & Host Pipeline**: `adb forward tcp:9222 localabstract:chrome_devtools_remote`, `adb reverse tcp:3000 tcp:3000`
- **Automation Runner**: `npm run device:qa` (`scripts/device-qa.mjs`)

---

## 2. Executive Summary & Acceptance Results

| Benchmark / Check | Target Budget | Real Phone Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Viewfinder Ratio (3:4)** | $0.750 \pm 0.005$ | **0.74941** ($\Delta = 0.00059$) | **PASS** |
| **Gold Corner Bracket Symmetry** | $\le 1.0\text{ px}$ delta | **0.00 px** ($dx=12.00\text{px}, dy=12.00\text{px}$ all 4 corners) | **PASS** |
| **$t_1$ Shutter Feedback Painted** | $\le 50\text{ ms}$ | **$36.3\text{ ms}$ (p50: $38.4\text{ ms}$)** | **PASS** |
| **$t_4$ Review Image Painted** | $\le 250\text{ ms}$ | **$76.9\text{ ms}$ (p50: $76.3\text{ ms}$)** | **PASS** |
| **$t_4$ Review Image P95** | $\le 400\text{ ms}$ | **$89.6\text{ ms}$** | **PASS** |
| **Keep $\to$ Live View Latency** | $\le 100\text{ ms}$ | **$< 10\text{ ms}$** | **PASS** |
| **Retake $\to$ Live View Latency** | Immediate | **$< 10\text{ ms}$** | **PASS** |
| **Lifecycle Screen Lock Recovery** | Same tab in-place | **`live`, 0 errors, no refresh** | **PASS** |
| **Main-Thread Long Tasks ($t_0 \to t_4$)** | $\le 50\text{ ms}$ | **$< 1\text{ ms}$ UI blocking** | **PASS** |

---

## 3. Shutter Latency: Root Cause Analysis & Before/After Comparison

### Root Cause Analysis (Why the Old Shutter Felt Sluggish)
1. **Synchronous 12MP CPU Downsampling (`measureSceneLuminance`)**:
   On every shutter click, `measureSceneLuminance(v)` was rendering the uncompressed $4000 \times 3000$ (12 MP) video frame into a 2D canvas, blocking the main thread CPU for **281.5 ms** before any feedback or preview could be painted.
2. **Synchronous JPEG `toBlob` Encoding on the Main Thread**:
   The capture pipeline was running software JPEG compression at $2560 \times 1920$ twice synchronously before returning. On mobile CPUs, encoding a 5-megapixel image takes **1.5 to 2.5 seconds** of 100% CPU time, locking the browser UI, dropping frames, and freezing touch event handling.
3. **Blocking Await on Shutter Feedback**:
   The shutter function was awaiting `requestAnimationFrame` before starting frame capture, creating an artificial serial latency chain.
4. **No Discard on Retake**:
   When the user tapped "Retake", the previous shot's 2560px archival background render continued running on the shared WebGL context, causing subsequent shutter clicks to stall while waiting for the GPU to become available.

### Architectural Fixes Applied
- **Instant Preview Bitmap ($\le 1\text{ms}$)**:
  Because the WebGL viewfinder canvas already has the calibrated film look applied and is frozen at $t_0$, `createImageBitmap(canvas)` extracts an instantaneous snapshot in **0.5 ms**.
- **Dual-Surface Review Stage**:
  `ReviewModal` renders the instant preview bitmap directly onto an accelerated canvas, firing $t_4$ in **$\le 80\text{ ms}$** with zero CPU compression delay.
- **Background Archival Processing with `AbortController`**:
  Full-resolution ($2560\text{px}$) photos are rendered lazily in the background only after the review modal is painted on screen. If the user taps **Retake**, an `AbortController` immediately halts the archival job, freeing the GPU and WebGL context in **0 ms**.
- **Optimized Flash Check**:
  Removed synchronous 12MP video downsampling; flash logic checks hardware torch capabilities without blocking the shutter tap.

### Shutter Latency Multi-Shot Benchmark Data (Measured on Pixel 10)

| Shot # | $t_1 - t_0$ (Feedback) | $t_4 - t_0$ (Review) | Keep/Retake $\to$ Live | Result |
| :---: | :---: | :---: | :---: | :---: |
| **Shot 1** | $33.1\text{ ms}$ | $74.2\text{ ms}$ | $< 10\text{ ms}$ | **PASS** |
| **Shot 2** | $38.4\text{ ms}$ | $82.4\text{ ms}$ | $< 10\text{ ms}$ | **PASS** |
| **Shot 3** | $39.3\text{ ms}$ | $76.3\text{ ms}$ | $< 10\text{ ms}$ | **PASS** |
| **Shot 4** | $24.9\text{ ms}$ | $62.0\text{ ms}$ | $< 10\text{ ms}$ | **PASS** |
| **Shot 5** | $46.0\text{ ms}$ | $89.6\text{ ms}$ | $< 10\text{ ms}$ | **PASS** |
| **P50** | **$38.4\text{ ms}$** | **$76.3\text{ ms}$** | **$< 10\text{ ms}$** | **PASS** |
| **P95** | **$46.0\text{ ms}$** | **$89.6\text{ ms}$** | **$< 10\text{ ms}$** | **PASS** |

---

## 4. Viewfinder Geometry & Corner Bracket Verification

### DOM & CSS Layout Check
- **Calculated Viewfinder Dimensions**: $411.43\text{ px} \times 549.00\text{ px}$
- **Measured Aspect Ratio**: $411.4285888671875 / 549.00 = 0.74941$ (Target: $0.75000$, $\Delta = 0.00059$)
- **Tolerance**: Target $\pm 0.005$ $\implies$ **PASS**
- **Corner Brackets**:
  - Top-Left: $dx = 12.00\text{ px}, dy = 12.00\text{ px}$
  - Top-Right: $dx = 12.00\text{ px}, dy = 12.00\text{ px}$
  - Bottom-Left: $dx = 12.00\text{ px}, dy = 12.00\text{ px}$
  - Bottom-Right: $dx = 12.00\text{ px}, dy = 12.00\text{ px}$
  - Max horizontal inset delta: **0.00 CSS px** (Budget $\le 1.0\text{ px}$)
  - Max vertical inset delta: **0.00 CSS px** (Budget $\le 1.0\text{ px}$)

### Screencap & Raw Framebuffer Check
- Raw framebuffer captured via `adb exec-out screencap -p` ($1080 \times 2424\text{ px}$).
- Golden corner brackets (`#facc15` / `#fef08a`) detected symmetrically inside the viewfinder boundaries with zero toolbar clipping.

---

## 5. Camera Lifecycle & In-Place Recovery Ladder

### Backgrounding & Track Suspension
- **Short Background (5s / 30s lock-unlock)**:
  Track state verified live (`readyState: "live"`, `muted: false`, `videoPaused: false`).
- **Long Background (> 45s)**:
  Timer suspends hardware tracks to preserve device battery and privacy. Upon page focus/visibility return, the silent re-acquisition ladder restores the stream without requiring a page reload.
- **In-Place Recovery Overlay**:
  Replaced destructive page unmounting (`CameraErrorView`) with an in-place blurred recovery overlay that retains guest session, roll code, queue count, and active look filters.

---

## 6. Known Browser Limitations

1. **CSP Worker Instantiation**:
   Due to strict Content Security Policy (`default-src 'self'`), inline Web Workers instantiated via `new Worker(blobUrl)` are disallowed. Canvas-based bitmap decoding and drawing is used instead, providing superior performance ($< 1\text{ms}$) without worker IPC serialization overhead.
2. **AudioContext Autoplay Policy**:
   On mobile browsers, `AudioContext` requires a user activation gesture before emitting audible sound. First-touch activation is handled gracefully with an AudioContext singleton.
3. **Android Chrome Permissions Policy**:
   If the user selects "Don't allow" at the OS or site level, Chrome forbids prompt re-invocation without user interaction in site settings. The in-place recovery ladder shows step-by-step instructions (lock icon left of URL $\to$ Permissions $\to$ Camera $\to$ Allow) and offers a fallback to native phone camera upload.
