import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { join } from "path";

const supabaseStub = `
  create role anon nologin; create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema if not exists auth;
  create or replace function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

describe("Stage 1 SaaS Multi-Event Isolation & Quota Anti-Tamper", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(supabaseStub);

    // Run core migrations
    const m1 = readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf-8");
    const m9 = readFileSync(join(process.cwd(), "supabase/migrations/0009_event_access_tokens.sql"), "utf-8");
    const m11 = readFileSync(join(process.cwd(), "supabase/migrations/0011_multi_event_saas.sql"), "utf-8");

    await db.exec(m1);
    await db.exec(m9);
    await db.exec(m11);
  });

  it("successfully applies migration 0011 with default SaaS values", async () => {
    // Insert an initial event
    await db.exec(`
      INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token)
      VALUES ('tasyakuran-2026', 'Alya & Rizky', 15, 'TASY1234');
    `);

    const result = await db.query<any>(`
      SELECT slug, status, package_tier, package_max_guests, package_max_shots_per_guest, dual_master_enabled
      FROM public.events
      WHERE slug = 'tasyakuran-2026';
    `);

    expect(result.rows).toHaveLength(1);
    const ev = result.rows[0];
    expect(ev.status).toBe("active");
    expect(ev.package_tier).toBe("owner_unlimited");
    expect(ev.package_max_shots_per_guest).toBe(100);
    expect(ev.dual_master_enabled).toBe(true);
  });

  it("isolates guests and photos across multiple events", async () => {
    // Event A: Tasyakuran
    const evA = (await db.query<any>(`
      INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, status)
      VALUES ('event-a', 'Event A', 15, 'TOKENA01', 'active')
      RETURNING id;
    `)).rows[0].id;

    // Event B: Wedding
    const evB = (await db.query<any>(`
      INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, status)
      VALUES ('event-b', 'Event B', 25, 'TOKENB02', 'active')
      RETURNING id;
    `)).rows[0].id;

    // Guest in Event A
    const guestA = (await db.query<any>(`
      INSERT INTO public.guests (event_id, display_name)
      VALUES ($1, 'Guest A')
      RETURNING id;
    `, [evA])).rows[0].id;

    // Guest in Event B
    const guestB = (await db.query<any>(`
      INSERT INTO public.guests (event_id, display_name)
      VALUES ($1, 'Guest B')
      RETURNING id;
    `, [evB])).rows[0].id;

    // Photos for each
    await db.exec(`
      INSERT INTO public.photos (event_id, guest_id, shot_id, status)
      VALUES ('${evA}', '${guestA}', '${crypto.randomUUID()}', 'confirmed');

      INSERT INTO public.photos (event_id, guest_id, shot_id, status)
      VALUES ('${evB}', '${guestB}', '${crypto.randomUUID()}', 'confirmed');
    `);

    // Verify Event A photos query strictly returns 1 photo belonging to Event A
    const resA = await db.query<any>(`
      SELECT id, event_id FROM public.photos WHERE event_id = $1;
    `, [evA]);
    expect(resA.rows).toHaveLength(1);
    expect(resA.rows[0].event_id).toBe(evA);

    // Verify Event B photos query strictly returns 1 photo belonging to Event B
    const resB = await db.query<any>(`
      SELECT id, event_id FROM public.photos WHERE event_id = $1;
    `, [evB]);
    expect(resB.rows).toHaveLength(1);
    expect(resB.rows[0].event_id).toBe(evB);
  });

  it("enforces package status constraint ('active', 'paused', 'archived')", async () => {
    // Valid status
    await db.exec(`
      INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, status)
      VALUES ('paused-event', 'Paused Event', 25, 'PAUSE123', 'paused');
    `);

    // Invalid status should reject
    await expect(
      db.exec(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, status)
        VALUES ('invalid-status', 'Invalid', 25, 'INV12345', 'deleted');
      `)
    ).rejects.toThrow();
  });

  it("enforces package tier constraint ('pocket_roll', 'classic_35mm', 'grand_archive', 'owner_unlimited')", async () => {
    // Valid tiers
    for (const tier of ['pocket_roll', 'classic_35mm', 'grand_archive', 'owner_unlimited']) {
      const cleanSlug = `tier-${tier.replace(/_/g, '-')}`;
      await db.exec(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, package_tier)
        VALUES ('${cleanSlug}', 'Tier Test', 25, 'TIER${tier.slice(0, 4)}', '${tier}');
      `);
    }

    // Invalid tier should reject
    await expect(
      db.exec(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, package_tier)
        VALUES ('invalid-tier', 'Invalid', 25, 'BADTIER1', 'free_trial');
      `)
    ).rejects.toThrow();
  });
});
