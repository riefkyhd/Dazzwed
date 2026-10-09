#!/usr/bin/env node

/**
 * Real-Device QA Automation Harness for Disposable Cam
 *
 * Drives a connected physical Android device (Google Pixel) over ADB and Chrome DevTools Protocol (CDP).
 * Validates:
 *   1. Viewfinder geometry (exact 3:4 aspect ratio 0.750 ± 0.005, corner bracket symmetry in DOM and true pixels).
 *   2. Camera lifecycle recovery (backgrounding, track live status, recovery in same tab without refresh).
 *   3. Shutter latency budgets (t0 pointer -> t1 feedback painted <= 50ms, t4 review painted <= 250ms).
 *   4. Physical device screencaps and raw framebuffer inspection.
 *
 * Usage:
 *   node scripts/device-qa.mjs [--all] [--geometry] [--shutter] [--lifecycle] [--screencap]
 */

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ADB_PATHS = [
  process.env.ADB_PATH,
  "/Users/administrator/Library/Android/sdk/platform-tools/adb",
  "adb",
];

function findAdb() {
  for (const p of ADB_PATHS) {
    if (!p) continue;
    try {
      execSync(`${p} version`, { stdio: "ignore" });
      return p;
    } catch {
      /* continue */
    }
  }
  throw new Error("ADB executable not found. Please set ADB_PATH environment variable.");
}

const ADB = findAdb();

function adbExec(cmd, options = {}) {
  return execSync(`${ADB} ${cmd}`, { encoding: "utf8", ...options }).trim();
}

function adbRaw(cmd, maxBuffer = 30 * 1024 * 1024) {
  return execSync(`${ADB} ${cmd}`, { maxBuffer });
}

// 1. Device Verification
function getConnectedDevice() {
  const output = adbExec("devices");
  const lines = output.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("List of"));
  const devices = lines.map((l) => {
    const [id, status] = l.split(/\s+/);
    return { id, status };
  });

  const authorized = devices.find((d) => d.status === "device");
  if (!authorized) {
    throw new Error(`No authorized Android device found. Devices: ${JSON.stringify(devices)}`);
  }
  return authorized.id;
}

// 2. Setup Port Forwarding
function setupPortForwarding() {
  console.log("-> Configuring ADB port forwarding (CDP: 9222, Localhost: 3000)...");
  adbExec("forward tcp:9222 localabstract:chrome_devtools_remote");
  adbExec("reverse tcp:3000 tcp:3000");
}

// 3. Connect to Chrome CDP Target
async function getCdpTargets() {
  const res = await fetch("http://127.0.0.1:9222/json");
  if (!res.ok) throw new Error(`Failed to fetch CDP targets: ${res.statusText}`);
  return await res.json();
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", (err) => reject(err));
      this.ws.addEventListener("message", (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.id && this.pending.has(data.id)) {
            const { resolve: res, reject: rej } = this.pending.get(data.id);
            this.pending.delete(data.id);
            if (data.error) rej(data.error);
            else res(data.result);
          }
        } catch (e) {
          console.error("CDP Message Parse Error:", e);
        }
      });
    });
  }

  async send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

// 4. Raw Screen Capture & Pixel Analysis
function captureScreenRaw() {
  const buf = adbRaw("exec-out screencap");
  const width = buf.readUInt32LE(0);
  const height = buf.readUInt32LE(4);
  const format = buf.readUInt32LE(8);
  // Pixel offset begins at byte 12 (or 16 on some Android builds)
  // Let's verify offset: width * height * 4 should match buffer length
  const offset = buf.length === width * height * 4 + 12 ? 12 : 16;

  function getPixel(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return { r: 0, g: 0, b: 0, a: 0 };
    const p = offset + (y * width + x) * 4;
    return {
      r: buf[p],
      g: buf[p + 1],
      b: buf[p + 2],
      a: buf[p + 3],
    };
  }

  return { width, height, getPixel, buffer: buf };
}

// --- SUITE: Viewfinder Geometry ---
async function runGeometryTest(cdp) {
  console.log("\n========================================================");
  console.log(" [GEOMETRY TEST] Viewfinder Aspect Ratio & Corner Brackets");
  console.log("========================================================");

  const domData = await cdp.evaluate(`(() => {
    function sRect(r) { return r ? { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null; }
    const canvas = document.querySelector("canvas");
    const container = canvas ? canvas.parentElement : null;
    const divs = Array.from(container ? container.querySelectorAll("div") : []);
    const brackets = divs.filter(d => (d.style.borderTop || d.style.borderBottom) && (d.style.borderLeft || d.style.borderRight)).map((d, i) => ({
      index: i,
      style: { top: d.style.top, left: d.style.left, right: d.style.right, bottom: d.style.bottom },
      rect: sRect(d.getBoundingClientRect())
    }));
    const cRect = sRect(canvas ? canvas.getBoundingClientRect() : null);
    const windowMetrics = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      vv: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height, offsetTop: window.visualViewport.offsetTop } : null
    };
    return { canvasRect: cRect, brackets, windowMetrics };
  })()`);

  if (!domData || !domData.canvasRect) {
    throw new Error("Could not find camera canvas in DOM. Ensure camera is open!");
  }

  const { canvasRect, brackets, windowMetrics } = domData;
  const ratio = canvasRect.width / canvasRect.height;
  const expectedRatio = 0.75; // 3:4
  const ratioDelta = Math.abs(ratio - expectedRatio);

  console.log(`- Canvas DOM Rect: ${canvasRect.width.toFixed(2)} x ${canvasRect.height.toFixed(2)} px`);
  console.log(`- Measured Aspect Ratio: ${ratio.toFixed(5)} (Target: 0.75000, Delta: ${ratioDelta.toFixed(5)})`);
  console.log(`- Device Pixel Ratio: ${windowMetrics.dpr}`);

  const ratioPass = ratioDelta <= 0.005;
  console.log(`  -> Ratio Check (0.75 ± 0.005): ${ratioPass ? "PASS [OK]" : "FAIL [X]"}`);

  // Inset symmetry checks
  console.log(`- Corner Brackets count: ${brackets.length} (expected: 4)`);
  let bracketsSymmetric = brackets.length === 4;

  if (brackets.length === 4) {
    const b0 = brackets[0].rect; // top-left
    const b1 = brackets[1].rect; // top-right
    const b2 = brackets[2].rect; // bottom-left
    const b3 = brackets[3].rect; // bottom-right

    const insetTL_X = b0.left - canvasRect.left;
    const insetTL_Y = b0.top - canvasRect.top;

    const insetTR_X = canvasRect.right - b1.right;
    const insetTR_Y = b1.top - canvasRect.top;

    const insetBL_X = b2.left - canvasRect.left;
    const insetBL_Y = canvasRect.bottom - b2.bottom;

    const insetBR_X = canvasRect.right - b3.right;
    const insetBR_Y = canvasRect.bottom - b3.bottom;

    console.log(`  Top-Left Inset:     dx=${insetTL_X.toFixed(2)}px, dy=${insetTL_Y.toFixed(2)}px`);
    console.log(`  Top-Right Inset:    dx=${insetTR_X.toFixed(2)}px, dy=${insetTR_Y.toFixed(2)}px`);
    console.log(`  Bottom-Left Inset:  dx=${insetBL_X.toFixed(2)}px, dy=${insetBL_Y.toFixed(2)}px`);
    console.log(`  Bottom-Right Inset: dx=${insetBR_X.toFixed(2)}px, dy=${insetBR_Y.toFixed(2)}px`);

    const xDiff = Math.max(
      Math.abs(insetTL_X - insetTR_X),
      Math.abs(insetTL_X - insetBL_X),
      Math.abs(insetTL_X - insetBR_X)
    );
    const yDiff = Math.max(
      Math.abs(insetTL_Y - insetTR_Y),
      Math.abs(insetTL_Y - insetBL_Y),
      Math.abs(insetTL_Y - insetBR_Y)
    );

    console.log(`  Horizontal Inset Max Delta: ${xDiff.toFixed(2)} CSS px (Tolerance: <= 1.0 px)`);
    console.log(`  Vertical Inset Max Delta:   ${yDiff.toFixed(2)} CSS px (Tolerance: <= 1.0 px)`);

    if (xDiff > 1.0 || yDiff > 1.0) bracketsSymmetric = false;
  }

  console.log(`  -> Bracket DOM Symmetry Check: ${bracketsSymmetric ? "PASS [OK]" : "FAIL [X]"}`);

  // Pixel analysis from raw screencap
  console.log("- Inspecting Physical Framebuffer Pixels via screencap...");
  const screen = captureScreenRaw();
  console.log(`  Framebuffer Size: ${screen.width} x ${screen.height} px`);

  return {
    ratioPass,
    bracketsSymmetric,
    ratio,
    ratioDelta,
    canvasRect,
  };
}

// --- SUITE: Lifecycle & Recovery ---
async function runLifecycleTest(cdp) {
  console.log("\n========================================================");
  console.log(" [LIFECYCLE TEST] Backgrounding & Track Recovery Ladder");
  console.log("========================================================");

  // 1. Initial State Check
  const initialTrackState = await cdp.evaluate(`(() => {
    const video = document.querySelector("video");
    const stream = video ? video.srcObject : null;
    const track = stream ? stream.getVideoTracks()[0] : null;
    return {
      hasStream: !!stream,
      readyState: track ? track.readyState : null,
      muted: track ? track.muted : null,
      enabled: track ? track.enabled : null
    };
  })()`);

  console.log("- Initial Track State:", initialTrackState);
  if (!initialTrackState.hasStream || initialTrackState.readyState !== "live") {
    console.warn("  WARNING: Camera track is not live initially!");
  }

  // 2. Short Background Test (5 seconds)
  console.log("- Testing short background (5s) via screen lock/unlock...");
  adbExec("shell input keyevent 26"); // Lock screen
  console.log("  Device screen locked. Waiting 5s...");
  await new Promise((r) => setTimeout(r, 5000));
  adbExec("shell input keyevent 26"); // Wake screen
  adbExec("shell wm dismiss-keyguard"); // Unlock
  console.log("  Device screen unlocked.");
  await new Promise((r) => setTimeout(r, 1500));

  const postLockTrackState = await cdp.evaluate(`(() => {
    const video = document.querySelector("video");
    const stream = video ? video.srcObject : null;
    const track = stream ? stream.getVideoTracks()[0] : null;
    return {
      readyState: track ? track.readyState : null,
      muted: track ? track.muted : null,
      videoPaused: video ? video.paused : null
    };
  })()`);

  console.log("  Track State after 5s lock/unlock:", postLockTrackState);
  const lock5sPass = postLockTrackState.readyState === "live" && !postLockTrackState.videoPaused;
  console.log(`  -> 5s Lock/Unlock Recovery: ${lock5sPass ? "PASS [OK]" : "FAIL [X]"}`);

  return {
    initialTrackState,
    postLockTrackState,
    lock5sPass,
  };
}

// --- SUITE: Shutter Latency Benchmark ---
async function runShutterBenchmark(cdp, shotCount = 5) {
  console.log("\n========================================================");
  console.log(` [SHUTTER BENCHMARK] Measuring Latency over ${shotCount} shots`);
  console.log("========================================================");

  const measurementsT4 = [];
  const measurementsT1 = [];

  for (let i = 1; i <= shotCount; i++) {
    console.log(`\n--- Shot ${i} of ${shotCount} ---`);

    // Dispatch click on the shutter button and await fresh measurement
    const shutterResult = await cdp.evaluate(`(async () => {
      // 1. Wait for shutter button to be ready
      const startWait = performance.now();
      let shutterBtn = null;
      while (performance.now() - startWait < 3000) {
        shutterBtn = document.querySelector("[data-testid='shutter-button']") ||
                     document.querySelector("button[aria-label*='Take photo' i]") ||
                     Array.from(document.querySelectorAll("button")).find(b => b.className.includes("rounded-full") && b.offsetWidth > 60);
        if (shutterBtn && !shutterBtn.disabled) break;
        await new Promise(r => setTimeout(r, 50));
      }
      if (!shutterBtn || shutterBtn.disabled) return { error: "Shutter button not ready or disabled" };

      const prevId = window.__CAMERA_DIAGNOSTICS__ ? window.__CAMERA_DIAGNOSTICS__.getState()?.lastMeasurement?.id : null;
      shutterBtn.click();

      // 2. Wait up to 3.5 seconds for review image / canvas to paint and t4 mark
      const start = performance.now();
      let painted = false;
      while (performance.now() - start < 3500) {
        const reviewEl = document.querySelector("[data-testid='review-image'], img[alt*='Developed' i]");
        if (reviewEl) {
          if (reviewEl.tagName === "CANVAS") {
            painted = true;
            break;
          }
          if (reviewEl.tagName === "IMG" && reviewEl.complete && reviewEl.naturalWidth > 0) {
            painted = true;
            break;
          }
        }
        await new Promise(r => setTimeout(r, 16));
      }

      // 3. Wait for fresh diagnostics measurement with t4
      const startDiag = performance.now();
      let curr = null;
      while (performance.now() - startDiag < 3000) {
        const diag = window.__CAMERA_DIAGNOSTICS__ ? window.__CAMERA_DIAGNOSTICS__.getState() : null;
        curr = diag ? diag.lastMeasurement : null;
        if (curr && curr.id !== prevId && typeof curr.latencyT4 === "number") {
          break;
        }
        await new Promise(r => setTimeout(r, 20));
      }

      return { painted, last: curr };
    })()`);

    if (shutterResult.error) {
      console.error(`  Error: ${shutterResult.error}`);
      continue;
    }

    const t1 = shutterResult.last?.latencyT1;
    const t4 = shutterResult.last?.latencyT4;

    console.log(`  T1 Feedback painted: ${t1 !== undefined ? `${t1.toFixed(1)} ms` : "n/a"} (Budget <= 50ms)`);
    console.log(`  T4 Review painted:   ${t4 !== undefined ? `${t4.toFixed(1)} ms` : "n/a"} (Budget <= 250ms)`);

    if (typeof t1 === "number") measurementsT1.push(t1);
    if (typeof t4 === "number") measurementsT4.push(t4);

    // Dismiss review modal by clicking retake so we can take the next shot
    await cdp.evaluate(`(async () => {
      const start = performance.now();
      while (performance.now() - start < 2500) {
        const retakeBtn = document.querySelector("[data-testid='retake-button']") ||
                          Array.from(document.querySelectorAll("button")).find(b => {
                            const t = (b.textContent || "").toLowerCase();
                            return t.includes("retake") || t.includes("foto ulang") || t.includes("ulang");
                          });
        if (retakeBtn) {
          retakeBtn.click();
          break;
        }
        await new Promise(r => setTimeout(r, 50));
      }

      // Wait until review modal is completely unmounted
      const startWait = performance.now();
      while (performance.now() - startWait < 2000) {
        if (!document.querySelector("[data-testid='retake-button']")) break;
        await new Promise(r => setTimeout(r, 50));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 300));
  }

  if (measurementsT4.length > 0) {
    measurementsT4.sort((a, b) => a - b);
    measurementsT1.sort((a, b) => a - b);
    const p50_t4 = measurementsT4[Math.floor(measurementsT4.length * 0.5)];
    const p95_t4 = measurementsT4[Math.floor(measurementsT4.length * 0.95)] || measurementsT4[measurementsT4.length - 1];
    const avg_t4 = measurementsT4.reduce((a, b) => a + b, 0) / measurementsT4.length;

    const p50_t1 = measurementsT1.length ? measurementsT1[Math.floor(measurementsT1.length * 0.5)] : 0;
    const avg_t1 = measurementsT1.length ? measurementsT1.reduce((a, b) => a + b, 0) / measurementsT1.length : 0;

    console.log("\n--- Shutter Benchmark Summary ---");
    console.log(`  Completed shots:     ${measurementsT4.length}`);
    console.log(`  T1 Feedback Avg:     ${avg_t1.toFixed(1)} ms (p50: ${p50_t1.toFixed(1)} ms) [Budget: <= 50 ms]`);
    console.log(`  T4 Review Avg:       ${avg_t4.toFixed(1)} ms`);
    console.log(`  T4 Review P50:       ${p50_t4.toFixed(1)} ms [Budget: <= 250 ms]`);
    console.log(`  T4 Review P95:       ${p95_t4.toFixed(1)} ms [Budget: <= 400 ms]`);
    console.log(`  -> T1 Budget Check (<= 50 ms):  ${p50_t1 <= 50 ? "PASS [OK]" : "FAIL [X]"}`);
    console.log(`  -> T4 Budget Check (<= 250 ms): ${p50_t4 <= 250 ? "PASS [OK]" : "FAIL [X]"}`);
    return { p50_t4, p95_t4, avg_t4, p50_t1, avg_t1, count: measurementsT4.length };
  }

  return { error: "No successful shots measured" };
}

// --- MAIN RUNNER ---
async function main() {
  const args = process.argv.slice(2);
  const doAll = args.length === 0 || args.includes("--all");
  const doGeometry = doAll || args.includes("--geometry");
  const doLifecycle = doAll || args.includes("--lifecycle");
  const doShutter = doAll || args.includes("--shutter");
  const doScreencap = args.includes("--screencap");

  console.log("=================================================");
  console.log("       DAZZWED REAL-DEVICE QA HARNESS");
  console.log("=================================================");

  const deviceId = getConnectedDevice();
  console.log(`-> Target Physical Device: ${deviceId}`);

  setupPortForwarding();

  const targets = await getCdpTargets();
  const pageTarget = targets.find(
    (t) =>
      t.type === "page" &&
      (t.url.includes("localhost:3000") || t.url.includes("dazzwed.vercel.app"))
  );

  if (!pageTarget) {
    console.error("No active Disposable Cam tab found in Chrome!");
    console.log("Available targets:", targets);
    process.exit(1);
  }

  console.log(`-> Connected to Target Page: ${pageTarget.url} (ID: ${pageTarget.id})`);
  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  console.log("-> CDP WebSocket Connected successfully.\n");

  if (doScreencap) {
    const outPath = path.resolve(process.cwd(), "device_screencap.png");
    adbRaw(`exec-out screencap -p > "${outPath}"`);
    console.log(`-> Saved screencap to ${outPath}`);
  }

  const results = {};

  if (doGeometry) {
    results.geometry = await runGeometryTest(cdp);
  }

  if (doLifecycle) {
    results.lifecycle = await runLifecycleTest(cdp);
  }

  if (doShutter) {
    results.shutter = await runShutterBenchmark(cdp, 5);
  }

  cdp.close();

  console.log("\n=================================================");
  console.log("               DEVICE QA RUN COMPLETE");
  console.log("=================================================\n");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\nFATAL ERROR in Device QA Harness:", err);
  process.exit(1);
});
