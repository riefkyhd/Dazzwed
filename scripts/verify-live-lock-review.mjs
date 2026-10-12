import { execSync } from "node:child_process";

const ADB = "/Users/administrator/Library/Android/sdk/platform-tools/adb";

async function run() {
  const res = await fetch("http://127.0.0.1:9222/json");
  const targets = await res.json();
  const t = targets.find(t => t.type === "page" && t.url.includes("dazzwed.vercel.app"));
  if (!t) {
    throw new Error("No dazzwed.vercel.app page found in Chrome on phone!");
  }
  console.log("Connected to target:", t.url);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
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

  // 1. Reload page on live production with cache bypass
  console.log("Navigating/reloading live production: https://dazzwed.vercel.app/e/our-wedding...");
  await evaluate("location.href = 'https://dazzwed.vercel.app/e/our-wedding'");
  await new Promise(r => setTimeout(r, 4000));

  // Dismiss review if open
  await evaluate(`(() => {
    const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Retake"));
    if (b) b.click();
  })()`);
  await new Promise(r => setTimeout(r, 1000));

  // Wait for camera video readyState
  console.log("Waiting for camera stream to be live...");
  await evaluate(`new Promise((resolve) => {
    const check = () => {
      const v = document.querySelector("video");
      if (v && v.readyState >= 2 && !v.paused) return resolve(true);
      setTimeout(check, 200);
    };
    check();
  })`);
  console.log("Camera stream is active and live!");

  // TEST 1: Capture photo -> Preview -> Screen Lock -> Unlock
  console.log("\n--- TEST 1: Shutter -> Lock Phone (6s) -> Unlock ---");
  console.log("Tapping shutter...");
  await evaluate(`(() => {
    const s = document.querySelector("[data-testid='shutter-button']") ||
              document.querySelector("button[aria-label*='Take photo' i]");
    if (s) s.click();
  })()`);

  // Wait 400ms for review modal to open
  await new Promise(r => setTimeout(r, 400));

  const stateInitial = await evaluate(`(() => {
    const c = document.querySelector("canvas[data-testid='review-image']");
    const img = document.querySelector("img[data-testid='review-image']");
    const modal = document.querySelector("[aria-label='Capture Review']");
    return {
      modalMounted: !!modal,
      hasCanvas: !!c,
      canvasW: c?.width,
      canvasH: c?.height,
      hasImg: !!img,
      imgSrc: img?.src?.substring(0, 50),
      imgComplete: img?.complete,
      imgNaturalWidth: img?.naturalWidth
    };
  })()`);
  console.log("Review state immediately after capture:", stateInitial);

  console.log("Locking phone (keyevent 26)...");
  execSync(`${ADB} shell input keyevent 26`);

  console.log("Waiting 6 seconds with phone locked...");
  await new Promise(r => setTimeout(r, 6000));

  console.log("Unlocking phone (keyevent 224 && wm dismiss-keyguard)...");
  execSync(`${ADB} shell "input keyevent 224 && wm dismiss-keyguard"`);
  await new Promise(r => setTimeout(r, 2000));

  const stateAfterUnlock = await evaluate(`(() => {
    const c = document.querySelector("canvas[data-testid='review-image']");
    const img = document.querySelector("img[data-testid='review-image']");
    const modal = document.querySelector("[aria-label='Capture Review']");
    return {
      modalMounted: !!modal,
      hasCanvas: !!c,
      canvasW: c?.width,
      canvasH: c?.height,
      hasImg: !!img,
      imgSrc: img?.src?.substring(0, 60),
      imgComplete: img?.complete,
      imgNaturalWidth: img?.naturalWidth,
      imgNaturalHeight: img?.naturalHeight,
      altText: img?.alt
    };
  })()`);
  console.log("Review state after unlock:", JSON.stringify(stateAfterUnlock, null, 2));

  execSync(`${ADB} exec-out screencap -p > /Users/administrator/Documents/Kiki/Dazzwed/live_lock_test_screen.png`);
  console.log("Saved live_lock_test_screen.png");

  // TEST 2: Backgrounding to Home screen (App Switch) -> Resume
  console.log("\n--- TEST 2: App Background (Home Key) -> 6s -> Foreground ---");
  console.log("Pressing HOME (keyevent 3)...");
  execSync(`${ADB} shell input keyevent 3`);

  console.log("Waiting 6 seconds in background...");
  await new Promise(r => setTimeout(r, 6000));

  console.log("Bringing Chrome back to foreground...");
  execSync(`${ADB} shell monkey -p com.android.chrome 1`);
  await new Promise(r => setTimeout(r, 2000));

  const stateAfterBackground = await evaluate(`(() => {
    const c = document.querySelector("canvas[data-testid='review-image']");
    const img = document.querySelector("img[data-testid='review-image']");
    const modal = document.querySelector("[aria-label='Capture Review']");
    return {
      modalMounted: !!modal,
      hasCanvas: !!c,
      hasImg: !!img,
      imgSrc: img?.src?.substring(0, 60),
      imgComplete: img?.complete,
      imgNaturalWidth: img?.naturalWidth,
      imgNaturalHeight: img?.naturalHeight,
      altText: img?.alt
    };
  })()`);
  console.log("Review state after background resume:", JSON.stringify(stateAfterBackground, null, 2));

  execSync(`${ADB} exec-out screencap -p > /Users/administrator/Documents/Kiki/Dazzwed/live_background_test_screen.png`);
  console.log("Saved live_background_test_screen.png");

  // TEST 3: Keep Photo verification
  console.log("\n--- TEST 3: Tap Keep Photo ---");
  await evaluate(`(() => {
    const keepBtn = document.querySelector("[data-testid='keep-button']") ||
                    Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Keep Photo"));
    if (keepBtn) keepBtn.click();
  })()`);
  await new Promise(r => setTimeout(r, 1500));

  const stateAfterKeep = await evaluate(`(() => {
    const modal = document.querySelector("[aria-label='Capture Review']");
    return {
      modalStillOpen: !!modal,
      shutterAvailable: !!document.querySelector("[data-testid='shutter-button']")
    };
  })()`);
  console.log("State after keeping photo:", stateAfterKeep);

  ws.close();
}

run().catch(console.error);
