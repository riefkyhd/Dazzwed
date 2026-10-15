import fs from "fs";
import path from "path";

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || process.cwd();

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const tabsRes = await fetch("http://localhost:9222/json/list");
  const tabs = await tabsRes.json();
  const targetTab = tabs.find(t => t.type === "page" && !t.url.includes("youtube"));

  if (!targetTab) {
    console.error("No suitable tab found");
    process.exit(1);
  }

  console.log("Connecting to tab:", targetTab.id, targetTab.title, targetTab.url);
  const client = new CDPClient(targetTab.webSocketDebuggerUrl);
  await client.connect();
  console.log("Connected to CDP!");

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");

  // Step 1: Clear local storage and cookies
  await client.send("Network.clearBrowserCookies");
  await client.send("Storage.clearDataForOrigin", {
    origin: "http://localhost:3000",
    storageTypes: "all",
  });
  console.log("Cleared all storage and cookies for localhost:3000");

  // Step 2: Navigate to URL WITHOUT token
  console.log("Navigating to http://localhost:3000/e/our-wedding (no token)...");
  await client.send("Page.navigate", { url: "http://localhost:3000/e/our-wedding" });
  await new Promise(r => setTimeout(r, 2500));

  // Check title and evaluate page text
  const evalBlocked = await client.send("Runtime.evaluate", {
    expression: `({
      title: document.title,
      hasExpiredText: document.body.innerText.includes("Camera Link Expired"),
      hasTagText: document.body.innerText.includes("ACCESS WINDOW CLOSED"),
      hasCoupleName: document.body.innerText.includes("Dhifa & Riefky")
    })`,
    returnByValue: true,
  });
  console.log("Blocked check evaluation:", evalBlocked.result.value);

  // Take screenshot of blocked screen
  const snap1 = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "pixel10_token_blocked.png"), Buffer.from(snap1.data, "base64"));
  console.log("Saved pixel10_token_blocked.png");

  // Step 3: Navigate to URL WITH valid token
  console.log("Navigating to http://localhost:3000/e/our-wedding?t=DEVELOP1 (valid token)...");
  await client.send("Page.navigate", { url: "http://localhost:3000/e/our-wedding?t=DEVELOP1" });
  await new Promise(r => setTimeout(r, 2500));

  // Evaluate Landing screen
  const evalValid = await client.send("Runtime.evaluate", {
    expression: `({
      title: document.title,
      hasCoupleName: document.body.innerText.includes("Dhifa & Riefky"),
      hasBadge: document.body.innerText.includes("Camera active • Closes in"),
      storageLength: localStorage.length,
      cookie: document.cookie
    })`,
    returnByValue: true,
  });
  console.log("Valid token landing evaluation:", evalValid.result.value);

  // Take screenshot of landing screen in EN
  const snap2 = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "pixel10_token_valid_landing.png"), Buffer.from(snap2.data, "base64"));
  console.log("Saved pixel10_token_valid_landing.png");

  // Step 4: Toggle language to ID
  await client.send("Runtime.evaluate", {
    expression: `Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'ID')?.click()`,
  });
  await new Promise(r => setTimeout(r, 800));

  const evalId = await client.send("Runtime.evaluate", {
    expression: `({
      hasBadgeId: document.body.innerText.includes("Tautan aktif • Ditutup dalam"),
      summaryId: document.body.innerText.includes("Selamat datang!")
    })`,
    returnByValue: true,
  });
  console.log("Indonesian toggle evaluation:", evalId.result.value);

  const snap3 = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "pixel10_token_valid_landing_id.png"), Buffer.from(snap3.data, "base64"));
  console.log("Saved pixel10_token_valid_landing_id.png");

  client.close();
  console.log("Audit complete!");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
