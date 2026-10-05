import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve(__dirname, "../supabase/migrations/0001_init.sql"),
  "utf8",
);

// Minimal stand-in for Supabase's roles + auth.jwt().
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
let guestId: string;

async function reserve(shot: string, guest = guestId, event = eventId) {
  const r = await db.query<{ outcome: string; status: string; shots_used: number }>(
    "select * from reserve_shot($1,$2,$3)", [event, guest, shot]);
  return r.rows[0];
}
const uuid = () => crypto.randomUUID();

beforeEach(async () => {
  db = new PGlite();
  await db.exec(supabaseStub);
  await db.exec(migration);
  // grants for stubs must be applied after tables exist
  await db.exec("grant all on all tables in schema public to authenticated, service_role");
  eventId = (await db.query<{ id: string }>(
    "insert into events (slug, couple_names, shots_per_guest) values ('wedding','A & B',3) returning id")).rows[0].id;
  guestId = (await db.query<{ id: string }>(
    "insert into guests (event_id) values ($1) returning id", [eventId])).rows[0].id;
});

describe("reserve_shot", () => {
  it("allows exactly shots_per_guest then rejects", async () => {
    for (let i = 1; i <= 3; i++) {
      const r = await reserve(uuid());
      expect(r.outcome).toBe("reserved");
      expect(r.shots_used).toBe(i);
    }
    expect((await reserve(uuid())).outcome).toBe("limit_reached");
  });

  it("is idempotent for the same shot_id", async () => {
    const s = uuid();
    expect((await reserve(s)).outcome).toBe("reserved");
    const again = await reserve(s);
    expect(again.outcome).toBe("duplicate");
    expect(again.shots_used).toBe(1);
    const n = await db.query<{ c: number }>("select count(*)::int c from photos");
    expect(n.rows[0].c).toBe(1);
  });

  it("failed shots free the slot and can be revived", async () => {
    const shots = [uuid(), uuid(), uuid()];
    for (const s of shots) await reserve(s);
    await db.query("select release_shot($1)", [shots[0]]);
    const revived = await reserve(shots[0]);
    expect(revived.outcome).toBe("reserved");
    expect((await reserve(uuid())).outcome).toBe("limit_reached");
  });

  it("failed shot can't be revived when the freed slot was used", async () => {
    const [a, b, c] = [uuid(), uuid(), uuid()];
    for (const s of [a, b, c]) await reserve(s);
    await db.query("select release_shot($1)", [a]);
    expect((await reserve(uuid())).outcome).toBe("reserved");
    expect((await reserve(a)).outcome).toBe("limit_reached");
  });

  it("hidden photos still count", async () => {
    const s = uuid();
    await reserve(s);
    await db.query("update photos set status='hidden' where shot_id=$1", [s]);
    await reserve(uuid()); await reserve(uuid());
    expect((await reserve(uuid())).outcome).toBe("limit_reached");
  });

  it("expires stale pending reservations", async () => {
    for (let i = 0; i < 3; i++) await reserve(uuid());
    await db.query("update photos set updated_at = now() - interval '11 minutes'");
    expect((await reserve(uuid())).outcome).toBe("reserved");
  });

  it("rejects guests of another event / unknown guests", async () => {
    const e2 = (await db.query<{ id: string }>(
      "insert into events (slug, couple_names) values ('other','C & D') returning id")).rows[0].id;
    expect((await reserve(uuid(), guestId, e2)).outcome).toBe("not_found");
    expect((await reserve(uuid(), uuid())).outcome).toBe("not_found");
  });

  it("does not let one guest reuse another guest's shot_id", async () => {
    const g2 = (await db.query<{ id: string }>(
      "insert into guests (event_id) values ($1) returning id", [eventId])).rows[0].id;
    const s = uuid();
    await reserve(s);
    expect((await reserve(s, g2)).outcome).toBe("not_found");
  });
});

describe("RLS", () => {
  async function asRole(role: string, claims: object, sql: string) {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    try {
      return (await db.query<{ c: number }>(sql)).rows;
    } finally {
      await db.exec("reset role");
    }
  }
  beforeEach(async () => {
    await reserve(uuid());
    await db.exec("insert into admin_emails values ('admin@x.com')");
  });

  it("anon has no access", async () => {
    await expect(asRole("anon", { role: "anon" }, "select count(*)::int c from photos")).rejects.toThrow();
  });

  it("anon cannot call reserve_shot", async () => {
    await db.exec("set role anon");
    await expect(db.query("select * from reserve_shot($1,$2,$3)", [eventId, guestId, uuid()])).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });

  it("non-admin authenticated sees nothing", async () => {
    const rows = await asRole("authenticated", { role: "authenticated", email: "rando@x.com" },
      "select count(*)::int c from photos");
    expect(rows[0].c).toBe(0);
  });

  it("allowlisted admin sees rows (case-insensitive email)", async () => {
    const rows = await asRole("authenticated", { role: "authenticated", email: "Admin@X.com" },
      "select count(*)::int c from photos");
    expect(rows[0].c).toBe(1);
  });

  it("non-admin cannot write", async () => {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", email: "rando@x.com" })]);
    await expect(db.query("insert into events (slug, couple_names) values ('hack','x')")).rejects.toThrow(/row-level security/);
    await db.exec("reset role");
  });
});
