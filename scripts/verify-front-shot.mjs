import { execSync } from "node:child_process";

const ADB = "/Users/administrator/Library/Android/sdk/platform-tools/adb";

async function run() {
  console.log("=== FRONT CAMERA REAL-SHOT QA ===");

  execSync(`${ADB} forward tcp:9222 localabstract:chrome_devtools_remote`);
  const res = await fetch("http://127.0.0.1:9222/json");
  const targets = await res.json();
  const page = targets.find(t => t.type === "page" && t.url.includes("dazzwed.vercel.app"));
  if (!page) throw new Error("No dazzwed page found!");

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

  // 1. Flip to front camera
  console.log("Flipping to front camera...");
  await evaluate(`(() => {
    const flipBtn = document.querySelector("button[aria-label*='Flip' i]");
    if (flipBtn) flipBtn.click();
  })()`);

  await new Promise(r => setTimeout(r, 1500));

  // Take screenshot of live front camera
  console.log("Taking screenshot of live front camera feed...");
  execSync(`${ADB} shell screencap -p /sdcard/front_cam_live.png`);
  execSync(`${ADB} pull /sdcard/front_cam_live.png /tmp/front_cam_live.png`);

  // 2. Tap Shutter
  console.log("Tapping shutter...");
  await evaluate(`(() => {
    const s = document.querySelector("[data-testid='shutter-button']") ||
              document.querySelector("button[aria-label*='Take photo' i]");
    if (s) s.click();
  })()`);

  // Wait for review dialog
  console.log("Waiting for review dialog...");
  await new Promise(r => setTimeout(r, 600));

  execSync(`${ADB} shell screencap -p /sdcard/front_cam_review.png`);
  execSync(`${ADB} pull /sdcard/front_cam_review.png /tmp/front_cam_review.png`);

  // 3. Tap Keep Photo
  console.log("Tapping Keep Photo...");
  await evaluate(`(() => {
    const keepBtn = Array.from(document.querySelectorAll("button")).find(b =>
      b.textContent.includes("Keep") || b.textContent.includes("Simpan")
    );
    if (keepBtn) keepBtn.click();
  })()`);

  // Wait 2s for upload queue to initiate
  await new Promise(r => setTimeout(r, 2000));

  const sessionData = await evaluate(`(() => {
    const s = localStorage.getItem("dc:session:our-wedding");
    return s ? JSON.parse(s) : null;
  })()`);

  console.log("Guest session data on phone:", sessionData);
  ws.close();
}

run().catch(console.error);
