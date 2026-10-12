import { execSync } from "node:child_process";
import fs from "node:fs";

const ADB = "/Users/administrator/Library/Android/sdk/platform-tools/adb";

async function main() {
  const res = await fetch("http://127.0.0.1:9222/json");
  const targets = await res.json();
  const t = targets.find(t => t.type === "page" && (t.url.includes("dazzwed.vercel.app") || t.url.includes("localhost:3000")));
  if (!t) {
    console.error("No dazzwed page found!");
    return;
  }
  console.log("Connected to:", t.url);
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

  // Check current page
  const currentUrl = await evaluate("location.href");
  console.log("Current URL:", currentUrl);
  if (!currentUrl.includes("dazzwed.vercel.app/e/our-wedding")) {
    console.log("Navigating to https://dazzwed.vercel.app/e/our-wedding...");
    await evaluate("location.href = 'https://dazzwed.vercel.app/e/our-wedding'");
    await new Promise(r => setTimeout(r, 3000));
  }

  // Dismiss review if open
  await evaluate(`(() => {
    const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Retake"));
    if (b) b.click();
  })()`);
  await new Promise(r => setTimeout(r, 600));

  // Inspect page buttons
  const buttons = await evaluate(`Array.from(document.querySelectorAll("button")).map(b => b.textContent.trim())`);
  console.log("Buttons:", buttons);

  // Take photo
  console.log("Taking photo...");
  await evaluate(`(() => {
    const s = document.querySelector("[data-testid='shutter-button']") ||
              document.querySelector("button[aria-label*='Take photo' i]");
    if (s) s.click();
  })()`);

  // Wait 250ms for review modal to open
  await new Promise(r => setTimeout(r, 250));

  const reviewStateBefore = await evaluate(`(() => {
    const c = document.querySelector("canvas[data-testid='review-image']");
    const img = document.querySelector("img[data-testid='review-image']");
    return {
      hasCanvas: !!c,
      canvasW: c?.width,
      canvasH: c?.height,
      hasImg: !!img,
      imgSrc: img?.src?.substring(0, 50),
      reviewMounted: !!document.querySelector("[aria-label='Capture Review']")
    };
  })()`);
  console.log("Review state before lock:", reviewStateBefore);

  console.log("Locking phone (keyevent 26)...");
  execSync(`${ADB} shell input keyevent 26`);

  console.log("Waiting 6 seconds locked...");
  await new Promise(r => setTimeout(r, 6000));

  console.log("Unlocking phone (input keyevent 224 && wm dismiss-keyguard)...");
  execSync(`${ADB} shell "input keyevent 224 && wm dismiss-keyguard"`);
  await new Promise(r => setTimeout(r, 1500));

  console.log("Inspecting review state after unlock...");
  const reviewStateAfter = await evaluate(`(() => {
    const c = document.querySelector("canvas[data-testid='review-image']");
    const img = document.querySelector("img[data-testid='review-image']");
    let canvasBlank = "no-canvas";
    if (c) {
      try {
        const ctx = c.getContext("2d");
        const pixel = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
        canvasBlank = pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0 && pixel[3] === 0;
      } catch (e) {
        canvasBlank = "error: " + e.message;
      }
    }
    const reviewModal = document.querySelector("[aria-label='Capture Review']");
    return {
      reviewModalMounted: !!reviewModal,
      hasCanvas: !!c,
      canvasW: c?.width,
      canvasH: c?.height,
      canvasBlank,
      hasImg: !!img,
      imgSrc: img?.src?.substring(0, 50),
      buttons: Array.from(document.querySelectorAll("button")).map(b => b.textContent.trim())
    };
  })()`);
  console.log("Review state after unlock:", JSON.stringify(reviewStateAfter, null, 2));

  // Grab screencap
  execSync(`${ADB} exec-out screencap -p > /Users/administrator/Documents/Kiki/Dazzwed/test_review_after_lock.png`);
  console.log("Saved screenshot to test_review_after_lock.png");

  ws.close();
}

main().catch(console.error);
