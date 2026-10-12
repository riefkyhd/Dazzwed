import { execSync } from "node:child_process";
import fs from "node:fs";

const ADB = "/Users/administrator/Library/Android/sdk/platform-tools/adb";

async function run() {
  console.log("=== REAL DEVICE VERIFICATION (PIXEL 10) ===");

  // Forward CDP
  execSync(`${ADB} forward tcp:9222 localabstract:chrome_devtools_remote`);
  const res = await fetch("http://127.0.0.1:9222/json");
  const targets = await res.json();
  const page = targets.find(t => t.type === "page" && t.url.includes("dazzwed.vercel.app"));
  if (!page) {
    throw new Error("No page found on phone for dazzwed.vercel.app");
  }

  console.log("Connected to target on Pixel:", page.title, page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  function evaluate(expr) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener("message", handler);
          if (data.error) reject(data.error);
          else resolve(data.result?.result?.value);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    });
  }

  // 1. Reset storage & reload page so we are on Landing Screen
  console.log("\n[1/5] Clearing session storage on phone and reloading to landing screen...");
  await evaluate(`(async () => {
    localStorage.clear();
    sessionStorage.clear();
    const dbs = await window.indexedDB.databases?.();
    if (dbs) {
      for (const d of dbs) {
        if (d.name) window.indexedDB.deleteDatabase(d.name);
      }
    }
    // Delete dc_g_our-wedding cookie
    document.cookie = "dc_g_our-wedding=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    location.href = "https://dazzwed.vercel.app/e/our-wedding";
  })()`);

  await new Promise(r => setTimeout(r, 4000));

  // 2. Test Mandatory Guest Name
  console.log("\n[2/5] Testing Mandatory Guest Name validation...");
  const landingState = await evaluate(`(() => {
    const input = document.querySelector("#guest-name");
    const startBtn = document.querySelector("button[type='submit']");
    const label = document.querySelector("label[for='guest-name']");
    return {
      hasInput: !!input,
      hasStartBtn: !!startBtn,
      btnDisabled: startBtn?.disabled,
      inputRequired: input?.required,
      labelText: label?.textContent?.trim(),
      inputValue: input?.value
    };
  })()`);

  console.log("Landing Screen State:", landingState);
  if (!landingState.hasInput) {
    console.log("User might already have an active session, checking current screen...");
    const curScreen = await evaluate(`document.body.innerText.substring(0, 200)`);
    console.log("Body snippet:", curScreen);
  } else {
    if (!landingState.btnDisabled) {
      console.error("FAIL: Start button should be disabled when name is empty!");
    } else {
      console.log("PASS: Start button is correctly disabled when name is empty.");
    }

    // Try typing spaces only
    console.log("Testing whitespace input...");
    const spacesState = await evaluate(`(() => {
      const input = document.querySelector("#guest-name");
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeSetter.call(input, "   ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const startBtn = document.querySelector("button[type='submit']");
      return { btnDisabled: startBtn?.disabled };
    })()`);
    console.log("Whitespace test result:", spacesState);

    // Now type valid guest name: "Pixel Guest QA"
    console.log("Entering guest name 'Pixel Guest QA'...");
    await evaluate(`(() => {
      const input = document.querySelector("#guest-name");
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeSetter.call(input, "Pixel Guest QA");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);

    const readyState = await evaluate(`(() => {
      const input = document.querySelector("#guest-name");
      const startBtn = document.querySelector("button[type='submit']");
      return { inputValue: input?.value, btnDisabled: startBtn?.disabled };
    })()`);
    console.log("Ready state after entering name:", readyState);

    // Click Start Camera
    console.log("Submitting form / clicking Start camera...");
    await evaluate(`(() => {
      const form = document.querySelector("form");
      if (form) form.requestSubmit();
    })()`);
  }

  // 3. Wait for camera screen to mount and video feed to play
  console.log("\n[3/5] Waiting for Camera Screen and live video...");
  const t0 = Date.now();
  const cameraLive = await evaluate(`new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const v = document.querySelector("video");
      const spinner = document.querySelector(".animate-spin");
      if (v && v.readyState >= 2 && !v.paused) {
        clearInterval(interval);
        resolve({
          active: true,
          videoW: v.videoWidth,
          videoH: v.videoHeight,
          spinnerPresent: !!spinner,
          elapsedMs: Date.now() - start
        });
      }
      if (Date.now() - start > 15000) {
        clearInterval(interval);
        resolve({
          active: false,
          elapsedMs: Date.now() - start,
          readyState: v?.readyState,
          paused: v?.paused,
          spinnerPresent: !!spinner
        });
      }
    }, 150);
  })`);
  console.log("Initial Camera live result:", cameraLive);

  // 4. Test Camera Flip (Rear -> Front Selfie)
  console.log("\n[4/5] Testing Camera Flip (Rear -> Front Selfie)...");
  await new Promise(r => setTimeout(r, 1000));
  const flipT0 = Date.now();
  await evaluate(`(() => {
    const flipBtn = document.querySelector("button[aria-label*='Flip' i]");
    if (flipBtn) flipBtn.click();
    else console.warn("Flip button not found!");
  })()`);

  // Measure how quickly the front camera becomes active and spinner is gone
  const frontCamResult = await evaluate(`new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const v = document.querySelector("video");
      const spinner = document.querySelector(".animate-spin");
      // When video is playing and readyState >= 2
      if (v && v.readyState >= 2 && !v.paused && !spinner) {
        clearInterval(interval);
        resolve({
          success: true,
          videoW: v.videoWidth,
          videoH: v.videoHeight,
          elapsedMs: Date.now() - start
        });
      }
      if (Date.now() - start > 12000) {
        clearInterval(interval);
        resolve({
          success: false,
          elapsedMs: Date.now() - start,
          readyState: v?.readyState,
          paused: v?.paused,
          spinnerPresent: !!spinner
        });
      }
    }, 150);
  })`);
  console.log("Front Camera Flip Result:", frontCamResult);

  // 5. Test Camera Flip (Front -> Rear)
  console.log("\n[5/5] Testing Camera Flip back (Front -> Rear)...");
  await new Promise(r => setTimeout(r, 1000));
  await evaluate(`(() => {
    const flipBtn = document.querySelector("button[aria-label*='Flip' i]");
    if (flipBtn) flipBtn.click();
  })()`);

  const rearCamResult = await evaluate(`new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const v = document.querySelector("video");
      const spinner = document.querySelector(".animate-spin");
      if (v && v.readyState >= 2 && !v.paused && !spinner) {
        clearInterval(interval);
        resolve({
          success: true,
          videoW: v.videoWidth,
          videoH: v.videoHeight,
          elapsedMs: Date.now() - start
        });
      }
      if (Date.now() - start > 12000) {
        clearInterval(interval);
        resolve({
          success: false,
          elapsedMs: Date.now() - start,
          readyState: v?.readyState,
          paused: v?.paused,
          spinnerPresent: !!spinner
        });
      }
    }, 150);
  })`);
  console.log("Rear Camera Flip Result:", rearCamResult);

  // Take physical screenshot on phone via adb screencap
  console.log("\nTaking screenshot on device...");
  execSync(`${ADB} shell screencap -p /sdcard/camera_qa_result.png`);
  execSync(`${ADB} pull /sdcard/camera_qa_result.png /tmp/camera_qa_result.png`);
  console.log("Device screenshot pulled to /tmp/camera_qa_result.png");

  console.log("\n=== SUMMARY ===");
  console.log("Mandatory name enforced:", landingState.btnDisabled === true ? "PASSED" : "CHECK");
  console.log("Front camera latency:", frontCamResult.elapsedMs, "ms (Success:", frontCamResult.success, ")");
  console.log("Rear camera latency:", rearCamResult.elapsedMs, "ms (Success:", rearCamResult.success, ")");
  ws.close();
}

run().catch(console.error);
