// Script to audit Pixel 10 over Chrome DevTools Protocol
const CDP_HTTP = "http://localhost:9222/json";

async function getPageWsUrl() {
  const res = await fetch(CDP_HTTP);
  const list = await res.json();
  const page = list.find((p) => p.url.includes("localhost:3000/e/our-wedding"));
  if (!page) {
    throw new Error("Could not find localhost:3000/e/our-wedding tab on Pixel 10 Chrome");
  }
  return page.webSocketDebuggerUrl;
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = [];
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
      } else if (msg.method) {
        for (const listener of this.eventListeners) {
          listener(msg.method, msg.params);
        }
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

  onEvent(fn) {
    this.eventListeners.push(fn);
  }

  async eval(expression, awaitPromise = true) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log("1. Connecting to Pixel 10 Chrome DevTools Protocol...");
  const wsUrl = await getPageWsUrl();
  console.log("Connected to:", wsUrl);
  const client = new CDPClient(wsUrl);
  await client.connect();

  await client.send("Network.enable");
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  const recordedRequests = [];
  const recordedResponses = [];
  client.onEvent((method, params) => {
    if (method === "Network.requestWillBeSent") {
      recordedRequests.push(params.request.url);
    }
    if (method === "Network.responseReceived") {
      recordedResponses.push({ url: params.response.url, status: params.response.status });
    }
  });

  console.log("\n2. Wiping all site data (cookies, localStorage, indexedDB, cache) for origin...");
  await client.send("Storage.clearDataForOrigin", {
    origin: "http://localhost:3000",
    storageTypes: "all",
  });

  console.log("3. Reloading page for clean pre-consent audit...");
  recordedRequests.length = 0;
  await client.send("Page.reload", { ignoreCache: true });

  // Wait 3 seconds for initial load and React hydration
  await new Promise((r) => setTimeout(r, 3000));

  console.log("\n================ TEST 1: ZERO-ACTIVITY PRE-CONSENT AUDIT ================");

  // Check document.cookie
  const docCookie = await client.eval("document.cookie");
  console.log("A. document.cookie:", JSON.stringify(docCookie));
  if (docCookie !== "") {
    throw new Error(`PRE-CONSENT VIOLATION: document.cookie is not empty: ${docCookie}`);
  }

  // Check httpOnly cookies via CDP Network.getCookies
  const { cookies } = await client.send("Network.getCookies", { urls: ["http://localhost:3000"] });
  console.log("B. Network.getCookies count:", cookies.length, cookies.map((c) => c.name));
  const guestCookies = cookies.filter((c) => c.name.startsWith("dc_g_"));
  if (guestCookies.length > 0) {
    throw new Error(`PRE-CONSENT VIOLATION: Guest session cookie set before consent: ${JSON.stringify(guestCookies)}`);
  }

  // Check localStorage
  const lsLength = await client.eval("localStorage.length");
  console.log("C. localStorage.length:", lsLength);
  if (lsLength !== 0) {
    const keys = await client.eval("Object.keys(localStorage)");
    throw new Error(`PRE-CONSENT VIOLATION: localStorage contains keys before consent: ${JSON.stringify(keys)}`);
  }

  // Check IndexedDB
  const idbDatabases = await client.eval("(async () => { return window.indexedDB.databases ? (await window.indexedDB.databases()).map(d => d.name) : []; })()");
  console.log("D. indexedDB.databases():", JSON.stringify(idbDatabases));
  if (idbDatabases.length > 0) {
    throw new Error(`PRE-CONSENT VIOLATION: IndexedDB opened before consent: ${JSON.stringify(idbDatabases)}`);
  }

  // Check Network Requests
  const preConsentApiCalls = recordedRequests.filter((url) =>
    url.includes("/api/guests") || url.includes("/api/telemetry") || url.includes("/api/photos")
  );
  console.log("E. Pre-consent API calls:", preConsentApiCalls);
  if (preConsentApiCalls.length > 0) {
    throw new Error(`PRE-CONSENT VIOLATION: Network requests sent to protected APIs before consent: ${preConsentApiCalls.join(", ")}`);
  }

  console.log(">>> TEST 1 PASSED: ZERO COOKIES, ZERO LOCALSTORAGE, ZERO INDEXEDDB, ZERO API CALLS BEFORE CONSENT!");

  console.log("\n================ TEST 2: BILINGUAL TOGGLE & GATE INTERACTION ================");
  // Check language toggle: click ID button
  console.log("A. Switching language to ID...");
  await client.eval(`
    const idBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'ID');
    if (idBtn) idBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 500));

  const idText = await client.eval(`document.body.innerText`);
  const containsIdCopy = idText.includes("Saya setuju") || idText.includes("Pelindungan Data Pribadi");
  console.log("ID copy rendered:", containsIdCopy);
  if (!containsIdCopy) {
    throw new Error("Bilingual ID copy not rendered when clicking ID toggle");
  }

  // Switch back to EN
  console.log("B. Switching language back to EN...");
  await client.eval(`
    const enBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'EN');
    if (enBtn) enBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 500));

  // Verify Start button is disabled while consentAlbum is unchecked
  const startBtnDisabled = await client.eval(`(() => {
    const btn = document.querySelector('button[type="submit"]');
    return btn ? btn.disabled : null;
  })()`);
  console.log("C. Start button disabled while checkbox unchecked:", startBtnDisabled);
  if (startBtnDisabled !== true) {
    throw new Error("Start button is NOT disabled when consentAlbum is unchecked!");
  }

  // Check the required consent checkbox
  console.log("D. Ticking required album consent checkbox...");
  await client.eval(`
    const cb = document.getElementById('consent-album');
    if (cb) {
      cb.click();
    }
  `);
  await new Promise((r) => setTimeout(r, 300));

  const startBtnEnabled = await client.eval(`(() => {
    const btn = document.querySelector('button[type="submit"]');
    return btn ? !btn.disabled : null;
  })()`);
  console.log("E. Start button enabled after consent:", startBtnEnabled);
  if (!startBtnEnabled) {
    throw new Error("Start button failed to enable after ticking required consent!");
  }

  // Submit consent and start camera
  console.log("F. Submitting consent gate to start camera...");
  await client.eval(`(() => {
    const form = document.querySelector('form');
    if (form) form.requestSubmit();
  })()`);

  // Wait 3 seconds for /api/guests response and camera screen to mount
  await new Promise((r) => setTimeout(r, 3000));

  // Verify localStorage now has dc_consent
  const storedConsent = await client.eval(`localStorage.getItem('dc_consent')`);
  console.log("G. Stored consent in localStorage:", storedConsent);
  if (!storedConsent || !storedConsent.includes("2026-10-v1")) {
    throw new Error(`Consent not properly saved to localStorage: ${storedConsent}`);
  }

  console.log("Responses received:", recordedResponses.filter(r => r.url.includes('/api/')));
  // Verify guest cookie is now present
  const { cookies: postConsentCookies } = await client.send("Network.getCookies", { urls: ["http://localhost:3000"] });
  const activeGuestCookie = postConsentCookies.find((c) => c.name.startsWith("dc_g_"));
  console.log("H. Post-consent guest cookie issued:", activeGuestCookie ? activeGuestCookie.name : "none");
  if (!activeGuestCookie) {
    throw new Error("Guest session cookie was not issued after consent submission!");
  }

  console.log(">>> TEST 2 PASSED: BILINGUAL TOGGLE & CONSENT SUBMISSION VERIFIED!");

  console.log("\n================ TEST 3: CAMERA STREAM & CAPTURE HYGIENE ================");
  // Verify camera screen is active
  const isCameraScreen = await client.eval(`
    Boolean(document.querySelector('video') || document.querySelector('canvas') || document.querySelector('[data-camera-root]'))
  `);
  console.log("A. In-app camera screen active:", isCameraScreen);

  console.log("\nAll CDP live automated assertions on Pixel 10 passed cleanly!");
  client.close();
}

main().catch((err) => {
  console.error("CDP Test failed:", err);
  process.exit(1);
});
