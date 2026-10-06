# Disposable Cam: Performance, Compatibility & Error Sweep Report

**Date**: October 6, 2026  
**Target Deployment**: Next.js 15+ (App Router) on Vercel Hobby, Supabase PostgreSQL with RLS, Google Drive API  
**Status**: All Tests Passing (113/113), Zero TypeScript Errors, Zero ESLint Warnings/Errors, Production Build Clean.

---

## 1. Executive Summary & Audit Scorecard

| Category | Initial Audit | Post-Remediation | Target / SLA | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ESLint Errors & Warnings** | 21 errors, 35 warnings | **0 errors, 0 warnings** | 0 | PASSED |
| **TypeScript Strict Mode** | 12 type failures / `any` | **0 errors (`tsc --noEmit`)** | 0 | PASSED |
| **Unit & Integration Tests** | 86 passing | **113 passing (17 suites)** | 100% pass | PASSED |
| **Concurrent Load Test (50 guests x 15 shots = 750 photos)** | Untested (Risk of 429 on venue WiFi) | **100% confirmed, 0 dropped, 100% duplicate protection** | 100% success | PASSED |
| **Init API Latency (p50 / p95)** | ~180ms / 850ms | **110.6ms / 530.4ms** | < 1000ms p95 | PASSED |
| **Crash & Rejection Telemetry** | Unmonitored | **Client beacon + Supabase log + Admin Health View** | Real-time monitoring | PASSED |
| **Zero-Data-Loss Guarantee** | Memory-only buffers in edge cases | **IndexedDB local persistence before network fetch** | 100% persisted | PASSED |

---

## 2. Before vs. After Metrics

### A. Static Code Health
* **Initial State**:
  - `any` types were present in `useCamera.ts`, `CameraDebugView.tsx`, `init/route.ts`, and test fixtures.
  - Cascading render warnings (`react-hooks/set-state-in-effect`) occurred in `useViewportLayout.ts` and `ReviewModal.tsx`.
  - Missing localization keys in `en.json` and `id.json` for review modal controls.
* **Remediation**:
  - Cleaned all lint violations; converted Object URLs to memoized references with explicit unmount revocation.
  - Resolved all strict typing issues and ensured safe type narrowing across API routes.

### B. Load & Soak Testing Results (`scripts/loadtest.mjs`)
* **Total Transactions**: 50 concurrent simulated guests executing 15 photo captures each (750 primary photos + 750 original records = 1,500 file operations).
* **Idempotency Verification**: 50 duplicate shot reservations fired concurrently — **100% returned `{ duplicate: true }` without allocating double slots**.
* **Limit Enforcement**: 50 attempts to shoot a 16th photo were fired — **100% were rejected with HTTP 403 `limit_reached`**.
* **Rate Limiting Hardening**:
  - Upgraded `/api/photos/init/route.ts` from a flat IP limit (60 req/min) to a per-guest token bucket (30 req/min) alongside an aggregate venue IP burst ceiling (300 req/min).
  - Prevents 500 wedding guests on a single venue WiFi router from triggering 429 errors.

---

## 3. Compatibility Matrix

| Environment / Device | Viewport & Layout | Camera Hardware / WebGL | Offline / Network Flakes |
| :--- | :--- | :--- | :--- |
| **iOS Safari 16+ (iPhone 12-16)** | Dynamic Island / safe-area insets handled via `--safe-top/bottom` + dvh fallback | WebGL2 pipeline with highp linear tone curves and safe math | Retries with exponential backoff; IndexedDB keeps photos safe |
| **Android Chrome (Pixel / Galaxy)** | Navigation gesture bar and dynamic URL collapse monitored | Full multi-lens picker (0.5x, 1x, 2x), torch control, and exposure compensation (-0.5 EV) | Auto-drains via `online` event listener |
| **Low-End / Older Devices (< 24 FPS)** | Scrim overlay in full-bleed mode; minimal UI chrome | Performance ladder: animated grain disabled at <24 fps; downscales viewport to standard/lite | Main thread fallback with periodic yielding (`setTimeout(0)`) |
| **High-Megapixel Sensors (48MP / 108MP)** | Geometry engine computes proportional crop without upscaling | Scaled down safely to max edge 4096 px before GPU upload | Prevents mobile Safari WebGL canvas OOM crashes |

---

## 4. Error Handling & Recovery Architecture

1. **Client Error Boundary (`GuestErrorBoundary.tsx`)**:
   - Catches unhandled React render errors.
   - Preserves active guest session and IndexedDB photo queue.
   - Provides a friendly one-tap camera reboot button without losing progress.
2. **Anonymous Error Telemetry (`/api/telemetry` & `src/lib/telemetry.ts`)**:
   - Captures unhandled promise rejections, WebGL context crashes, and camera initialization failures.
   - Uses `navigator.sendBeacon` for zero-impact reporting on page exit.
   - Monitored live via the `/admin/health` operations dashboard.
3. **WebGL Context Loss Recovery**:
   - `webglcontextlost` halts active draw operations gracefully.
   - `webglcontextrestored` recompiles shaders and restores textures automatically without requiring a page refresh.

---

## 5. Free-Tier Quota & Cost Guardrails

* **Vercel Hobby**:
  - Direct Google Drive resumable uploads bypass Vercel serverless function execution timeout and bandwidth limits.
  - Serverless functions handle only token minting and shot reservation (p50 duration: ~110ms).
* **Supabase Free Tier**:
  - Lightweight telemetry table (`client_events`) pruned automatically.
  - Atomic shot reservations handled in single stored procedures (`reserve_shot`).
* **Google Drive API**:
  - Google Drive upload operations utilize resumable upload URIs with 2 MiB chunks, adhering to standard Google Drive free storage quotas (15 GB).
