import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const migration0001 = readFileSync(path.resolve(__dirname, "../supabase/migrations/0001_init.sql"), "utf8");
const migration0010 = readFileSync(path.resolve(__dirname, "../supabase/migrations/0010_product_analytics.sql"), "utf8");

const supabaseStub = `
  create role anon nologin; create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

let db: PGlite;
let eventId: string;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(supabaseStub);
  await db.exec(migration0001);
  await db.exec(migration0010);
  await db.exec("grant all on all tables in schema public to authenticated, service_role");

  const eventRes = await db.query<{ id: string }>(
    "insert into events (slug, couple_names, shots_per_guest) values ('wedding-analytics','Dhifa & Riefky',15) returning id"
  );
  eventId = eventRes.rows[0].id;
});

describe("Migration 0010: Product Analytics & Event Metrics", () => {
  it("adds preset_id to photos table", async () => {
    const guestRes = await db.query<{ id: string }>(
      "insert into guests (event_id) values ($1) returning id",
      [eventId]
    );
    const guestId = guestRes.rows[0].id;

    await db.query(
      "insert into photos (event_id, guest_id, shot_id, preset_id, status) values ($1, $2, $3, $4, 'confirmed')",
      [eventId, guestId, "00000000-0000-0000-0000-000000000001", "disposable-400"]
    );

    const photoRes = await db.query<{ preset_id: string }>(
      "select preset_id from photos where shot_id = '00000000-0000-0000-0000-000000000001'"
    );
    expect(photoRes.rows[0].preset_id).toBe("disposable-400");
  });

  it("atomically increments event metrics via increment_event_metric RPC", async () => {
    // 1. Initial increment
    await db.query("select increment_event_metric($1, $2, $3, $4)", [
      eventId,
      "filter_kept",
      "disposable-400",
      1,
    ]);

    let res = await db.query<{ count: string }>(
      "select count from event_metrics where event_id = $1 and metric_type = 'filter_kept' and metric_key = 'disposable-400'",
      [eventId]
    );
    expect(Number(res.rows[0].count)).toBe(1);

    // 2. Second increment with delta 2
    await db.query("select increment_event_metric($1, $2, $3, $4)", [
      eventId,
      "filter_kept",
      "disposable-400",
      2,
    ]);

    res = await db.query<{ count: string }>(
      "select count from event_metrics where event_id = $1 and metric_type = 'filter_kept' and metric_key = 'disposable-400'",
      [eventId]
    );
    expect(Number(res.rows[0].count)).toBe(3);

    // 3. Different metric type and key
    await db.query("select increment_event_metric($1, $2, $3, $4)", [
      eventId,
      "filter_retaken",
      "portra-400",
      1,
    ]);

    const retakeRes = await db.query<{ count: string }>(
      "select count from event_metrics where event_id = $1 and metric_type = 'filter_retaken' and metric_key = 'portra-400'",
      [eventId]
    );
    expect(Number(retakeRes.rows[0].count)).toBe(1);

    // Kept metric remains unchanged
    res = await db.query<{ count: string }>(
      "select count from event_metrics where event_id = $1 and metric_type = 'filter_kept' and metric_key = 'disposable-400'",
      [eventId]
    );
    expect(Number(res.rows[0].count)).toBe(3);
  });

  it("supports capture_mode metrics (takePhoto vs videoFrame)", async () => {
    await db.query("select increment_event_metric($1, 'capture_mode', 'takePhoto', 5)", [eventId]);
    await db.query("select increment_event_metric($1, 'capture_mode', 'videoFrame', 12)", [eventId]);

    const modes = await db.query<{ metric_key: string; count: string }>(
      "select metric_key, count from event_metrics where event_id = $1 and metric_type = 'capture_mode' order by count desc",
      [eventId]
    );

    expect(modes.rows).toHaveLength(2);
    expect(modes.rows[0].metric_key).toBe("videoFrame");
    expect(Number(modes.rows[0].count)).toBe(12);
    expect(modes.rows[1].metric_key).toBe("takePhoto");
    expect(Number(modes.rows[1].count)).toBe(5);
  });
});
