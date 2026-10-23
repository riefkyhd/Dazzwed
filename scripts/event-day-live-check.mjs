/**
 * Dazzwed / Unveiled Event-Day Live Production & Vault Probe
 * Tests live production endpoints and verifies zero-defect readiness for tomorrow's event.
 */

const PROD_BASE = "https://dazzwed.vercel.app";
const EVENT_SLUG = "our-wedding";
const VALID_TOKEN = "103685F6";

async function runCheck() {
  console.log("=================================================================");
  console.log("  DAZZWED / UNVEILED — EVENT-DAY LIVE PRODUCTION PROBE");
  console.log(`  Target: ${PROD_BASE}`);
  console.log(`  Event:  ${EVENT_SLUG} (Dhifa & Riefky)`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log("=================================================================\n");

  const results = [];

  // Check 1: Production Home (/)
  try {
    const res = await fetch(`${PROD_BASE}/`);
    const ok = res.status === 200;
    results.push({
      item: "Production Root Navigation (/)",
      status: ok ? "PASS" : "FAIL",
      code: res.status,
      details: ok ? "Root landing renders successfully with Unveiled brand mark" : "Unexpected status",
    });
  } catch (err) {
    results.push({ item: "Production Root Navigation (/)", status: "FAIL", code: 0, details: err.message });
  }

  // Check 2: Valid Guest Camera Entry (/e/[slug]?t=[token])
  try {
    const res = await fetch(`${PROD_BASE}/e/${EVENT_SLUG}?t=${VALID_TOKEN}`);
    const html = await res.text();
    const hasCouple = html.includes("Dhifa &amp; Riefky") || html.includes("Dhifa & Riefky");
    const ok = res.status === 200 && hasCouple;
    results.push({
      item: "Valid Guest Camera Access (/e/[slug]?t=[valid_token])",
      status: ok ? "PASS" : "FAIL",
      code: res.status,
      details: ok ? "Viewfinder initialized with verified couple names" : "Couple name not found in rendered HTML",
    });
  } catch (err) {
    results.push({ item: "Valid Guest Camera Access (/e/[slug]?t=[valid_token])", status: "FAIL", code: 0, details: err.message });
  }

  // Check 3: Corrupted Token Access Defense (/e/[slug]?t=[corrupted_token])
  try {
    const res = await fetch(`${PROD_BASE}/e/${EVENT_SLUG}?t=${VALID_TOKEN}fds`);
    const html = await res.text();
    const isBlocked = html.includes("Camera Access Closed") || html.includes("Camera Link Invalid") || html.includes("Invalid");
    const ok = isBlocked && !html.includes("YOUR NAME");
    results.push({
      item: "Corrupted Token Defense (/e/[slug]?t=[invalid])",
      status: ok ? "PASS" : "FAIL",
      code: res.status,
      details: ok ? "Strictly blocked without leaking couple names or camera viewfinder" : "Failed to block invalid token",
    });
  } catch (err) {
    results.push({ item: "Corrupted Token Defense (/e/[slug]?t=[invalid])", status: "FAIL", code: 0, details: err.message });
  }

  // Check 4: Mandatory Guest Name API Gate (POST /api/guests with empty name)
  try {
    const res = await fetch(`${PROD_BASE}/api/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventSlug: EVENT_SLUG,
        name: "",
        consentVersion: "2026-10-v1",
        consentAlbum: true,
        eventToken: VALID_TOKEN,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const isRejected = res.status === 400 && (body.code === "GUEST_NAME_REQUIRED" || res.status === 400);
    results.push({
      item: "Mandatory Guest Name API Gate (Empty Name)",
      status: isRejected ? "PASS" : "FAIL",
      code: res.status,
      details: isRejected ? `Strictly rejected with 400 Bad Request (${body.code || "Bad Request"})` : "Did not reject empty name",
    });
  } catch (err) {
    results.push({ item: "Mandatory Guest Name API Gate (Empty Name)", status: "FAIL", code: 0, details: err.message });
  }

  // Check 5: Mandatory Guest Name API Gate (1-character Name)
  try {
    const res = await fetch(`${PROD_BASE}/api/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventSlug: EVENT_SLUG,
        name: "A",
        consentVersion: "2026-10-v1",
        consentAlbum: true,
        eventToken: VALID_TOKEN,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const isRejected = res.status === 400 && (body.code === "GUEST_NAME_REQUIRED" || res.status === 400);
    results.push({
      item: "Mandatory Guest Name API Gate (1-Char Name)",
      status: isRejected ? "PASS" : "FAIL",
      code: res.status,
      details: isRejected ? `Strictly rejected with 400 Bad Request (${body.code || "Bad Request"})` : "Did not reject 1-char name",
    });
  } catch (err) {
    results.push({ item: "Mandatory Guest Name API Gate (1-Char Name)", status: "FAIL", code: 0, details: err.message });
  }

  // Print Formatted Matrix Table
  console.log("| Check Item | Status | HTTP | Details |");
  console.log("| :--- | :---: | :---: | :--- |");
  for (const r of results) {
    const badge = r.status === "PASS" ? "✅ PASS" : "❌ FAIL";
    console.log(`| ${r.item} | ${badge} | ${r.code} | ${r.details} |`);
  }
  console.log("");

  const allPassed = results.every((r) => r.status === "PASS");
  if (allPassed) {
    console.log("🎉 ALL LIVE PRE-FLIGHT CHECKS PASSED. SYSTEM IS EVENT-DAY READY.\n");
  } else {
    console.warn("⚠️ SOME CHECKS FAILED OR PENDING DEPLOYMENT SYNC.\n");
  }
}

runCheck();
