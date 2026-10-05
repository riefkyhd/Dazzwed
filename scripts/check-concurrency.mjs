// Run against your REAL Supabase project to verify atomic shot limiting under concurrency.
//   node --env-file=.env.local scripts/check-concurrency.mjs
// Creates a temporary event + guest, fires 40 parallel reservations, expects exactly `limit` reserved.
// Cleans up afterwards.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const LIMIT = 15;
const slug = `concurrency-test-${Date.now()}`;

const { data: ev, error: e1 } = await sb.from("events")
  .insert({ slug, couple_names: "Test", shots_per_guest: LIMIT }).select("id").single();
if (e1) throw e1;
const { data: g, error: e2 } = await sb.from("guests").insert({ event_id: ev.id }).select("id").single();
if (e2) throw e2;

const results = await Promise.all(
  Array.from({ length: 40 }, () =>
    sb.rpc("reserve_shot", { p_event_id: ev.id, p_guest_id: g.id, p_shot_id: randomUUID() })),
);
const outcomes = {};
for (const r of results) {
  if (r.error) throw r.error;
  const o = r.data[0].outcome;
  outcomes[o] = (outcomes[o] ?? 0) + 1;
}
console.log(outcomes);
await sb.from("events").delete().eq("id", ev.id); // cascades
if (outcomes.reserved !== LIMIT) { console.error("FAIL: expected exactly", LIMIT); process.exit(1); }
console.log("PASS");
