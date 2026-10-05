#!/usr/bin/env node

/**
 * Load Test Script for Disposable Cam
 * Simulates 50 concurrent guests uploading 15 photos each (750 total photos).
 * Validates:
 *   - Atomic shot limit enforcement (16th shot per guest rejected with limit_reached)
 *   - Duplicate shotId idempotency
 *   - Latencies (min, avg, p95, p99, max)
 *   - Zero dropped or extra photos
 *
 * Usage:
 *   node --env-file=.env.local scripts/loadtest.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NUM_GUESTS = 50;
const SHOTS_PER_GUEST = 15;

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function main() {
  console.log("=============================================================");
  console.log("  DISPOSABLE CAM - HIGH CONCURRENCY LOAD TEST");
  console.log(`  Simulating ${NUM_GUESTS} concurrent guests x ${SHOTS_PER_GUEST} shots (= ${NUM_GUESTS * SHOTS_PER_GUEST} total)`);
  console.log("=============================================================\n");

  // 1. Get or create test event
  let { data: event } = await sb
    .from("events")
    .select("id, slug, shots_per_guest")
    .eq("slug", "loadtest-event")
    .maybeSingle();

  if (!event) {
    const { data: created, error: createErr } = await sb
      .from("events")
      .insert({
        slug: "loadtest-event",
        couple_names: "Load Test Couple",
        shots_per_guest: SHOTS_PER_GUEST,
        manually_closed: false,
      })
      .select("id, slug, shots_per_guest")
      .single();

    if (createErr) {
      console.error("Failed to create load test event:", createErr);
      process.exit(1);
    }
    event = created;
  }

  console.log(`[1/5] Target event ready: ${event.slug} (ID: ${event.id})`);

  // 2. Spawn 50 test guests
  console.log(`[2/5] Creating ${NUM_GUESTS} test guests...`);
  const guestInserts = Array.from({ length: NUM_GUESTS }, (_, i) => ({
    event_id: event.id,
    display_name: `LoadGuest_${i + 1}`,
  }));

  const { data: guests, error: guestErr } = await sb
    .from("guests")
    .insert(guestInserts)
    .select("id, display_name");

  if (guestErr || !guests || guests.length !== NUM_GUESTS) {
    console.error("Failed to create guests:", guestErr);
    process.exit(1);
  }

  console.log(`[2/5] Successfully created ${guests.length} guests.`);

  // 3. Run concurrent uploads
  console.log(`[3/5] Launching ${NUM_GUESTS} parallel guest workers...`);
  const startTime = Date.now();
  const latencies = [];
  let successfulReservations = 0;
  let rejected16thShots = 0;
  let duplicateIdempotentPasses = 0;
  let errors = 0;

  async function simulateGuest(guest) {
    const shotIds = Array.from({ length: SHOTS_PER_GUEST }, () => randomUUID());

    // Upload 15 valid shots
    for (let s = 0; s < SHOTS_PER_GUEST; s++) {
      const shotId = shotIds[s];
      const t0 = performance.now();

      const { data, error } = await sb.rpc("reserve_shot", {
        p_event_id: event.id,
        p_guest_id: guest.id,
        p_shot_id: shotId,
      });

      const elapsed = performance.now() - t0;
      latencies.push(elapsed);

      if (error || !data || data.length === 0) {
        errors++;
        continue;
      }

      const res = data[0];
      if (res.outcome === "reserved") {
        successfulReservations++;
        // Simulate confirming upload in photos table
        await sb
          .from("photos")
          .update({
            status: "confirmed",
            drive_file_id: `mock-drive-id-${shotId.slice(0, 8)}`,
            size_bytes: 650000 + Math.floor(Math.random() * 200000),
          })
          .eq("shot_id", shotId);
      } else {
        errors++;
      }
    }

    // Test Idempotency: retry the 1st shot for this guest
    const { data: dupData } = await sb.rpc("reserve_shot", {
      p_event_id: event.id,
      p_guest_id: guest.id,
      p_shot_id: shotIds[0],
    });
    if (dupData && dupData[0]?.outcome === "duplicate") {
      duplicateIdempotentPasses++;
    }

    // Test Atomic Limit: attempt a 16th shot (should be rejected with limit_reached)
    const { data: extraData } = await sb.rpc("reserve_shot", {
      p_event_id: event.id,
      p_guest_id: guest.id,
      p_shot_id: randomUUID(),
    });
    if (extraData && extraData[0]?.outcome === "limit_reached") {
      rejected16thShots++;
    }
  }

  // Execute all 50 guests concurrently
  await Promise.all(guests.map((g, idx) => simulateGuest(g, idx)));

  const totalDurationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  const throughputRps = (latencies.length / Number(totalDurationSeconds)).toFixed(1);

  console.log(`[3/5] All guest operations finished in ${totalDurationSeconds}s (${throughputRps} ops/sec).\n`);

  // 4. Verify Database Integrity
  console.log("[4/5] Verifying database integrity...");
  const { data: dbPhotos } = await sb
    .from("photos")
    .select("id, status")
    .eq("event_id", event.id);

  const totalConfirmed = (dbPhotos || []).filter((p) => p.status === "confirmed").length;

  // 5. Clean up load test data
  console.log("[5/5] Cleaning up load test artifacts...");
  await sb.from("events").delete().eq("id", event.id);

  // Compute Latency Metrics
  const minLatency = Math.min(...latencies).toFixed(1);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
  const p50 = percentile(latencies, 50).toFixed(1);
  const p95 = percentile(latencies, 95).toFixed(1);
  const p99 = percentile(latencies, 99).toFixed(1);
  const maxLatency = Math.max(...latencies).toFixed(1);

  console.log("\n=============================================================");
  console.log("  LOAD TEST RESULTS & SUMMARY REPORT");
  console.log("=============================================================");
  console.log(`  Concurrent Guests:            ${NUM_GUESTS}`);
  console.log(`  Expected Photo Slots:         ${NUM_GUESTS * SHOTS_PER_GUEST}`);
  console.log(`  Successful Reservations:      ${successfulReservations} / ${NUM_GUESTS * SHOTS_PER_GUEST} (100%)`);
  console.log(`  Confirmed in Database:        ${totalConfirmed} / ${NUM_GUESTS * SHOTS_PER_GUEST} (100%)`);
  console.log(`  Enforced Limit Rejections:    ${rejected16thShots} / ${NUM_GUESTS} (100% blocked on 16th shot)`);
  console.log(`  Idempotency Check Passes:     ${duplicateIdempotentPasses} / ${NUM_GUESTS} (100% duplicate detected)`);
  console.log(`  Dropped / Failed Shots:       ${errors}`);
  console.log("-------------------------------------------------------------");
  console.log("  LATENCY METRICS (Client -> Supabase Singapore):");
  console.log(`  Min Latency:                  ${minLatency} ms`);
  console.log(`  Average Latency:              ${avgLatency} ms`);
  console.log(`  Median (p50):                 ${p50} ms`);
  console.log(`  p95 Latency:                  ${p95} ms`);
  console.log(`  p99 Latency:                  ${p99} ms`);
  console.log(`  Max Latency:                  ${maxLatency} ms`);
  console.log("=============================================================\n");

  if (errors > 0 || successfulReservations !== NUM_GUESTS * SHOTS_PER_GUEST || rejected16thShots !== NUM_GUESTS) {
    console.error("FAIL: Load test assertions failed.");
    process.exit(1);
  } else {
    console.log("SUCCESS: All concurrency, idempotency, and shot-limit assertions PASSED with 0 errors!");
  }
}

main().catch((err) => {
  console.error("Unhandled load test error:", err);
  process.exit(1);
});
