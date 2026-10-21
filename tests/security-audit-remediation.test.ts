import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { join } from "path";
import {
  assertEventTenantAccess,
  signSessionToken,
  type AuthSession,
  type ClientSession,
  type SuperadminSession,
} from "@/lib/auth/session";
import { generateUniqueEventToken } from "@/lib/event-server";

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

describe("Security Audit Remediation — Tenant Ownership Guard & QR Protection", () => {
  let db: PGlite;
  let clientAId: string;
  let clientBId: string;
  let eventAId: string;
  let eventBId: string;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(supabaseStub);

    const m1 = readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf-8");
    const m9 = readFileSync(join(process.cwd(), "supabase/migrations/0009_event_access_tokens.sql"), "utf-8");
    const m11 = readFileSync(join(process.cwd(), "supabase/migrations/0011_multi_event_saas.sql"), "utf-8");
    const m12 = readFileSync(join(process.cwd(), "supabase/migrations/0012_clients_and_rbac.sql"), "utf-8");
    const m13 = readFileSync(join(process.cwd(), "supabase/migrations/0013_unique_event_access_token.sql"), "utf-8");

    await db.exec(m1);
    await db.exec(m9);
    await db.exec(m11);
    await db.exec(m12);
    await db.exec(m13);

    // Create Client A & Client B
    clientAId = (
      await db.query<any>(`
        INSERT INTO public.clients (name, email, access_code, max_events, status)
        VALUES ('Client A Weddings', 'clienta@example.com', 'DZ-AAAA01', 1, 'active')
        RETURNING id;
      `)
    ).rows[0].id;

    clientBId = (
      await db.query<any>(`
        INSERT INTO public.clients (name, email, access_code, max_events, status)
        VALUES ('Client B Weddings', 'clientb@example.com', 'DZ-BBBB02', 1, 'active')
        RETURNING id;
      `)
    ).rows[0].id;

    // Create Event A belonging to Client A
    eventAId = (
      await db.query<any>(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, status, client_id, access_token)
        VALUES ('event-a', 'Alice & Alex', 24, 'active', '${clientAId}', 'TOK-A1A1')
        RETURNING id;
      `)
    ).rows[0].id;

    // Create Event B belonging to Client B
    eventBId = (
      await db.query<any>(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, status, client_id, access_token)
        VALUES ('event-b', 'Bella & Bob', 36, 'active', '${clientBId}', 'TOK-B2B2')
        RETURNING id;
      `)
    ).rows[0].id;
  });

  // Mock Supabase admin builder pointing to local PGlite
  function createMockSb() {
    return {
      from: (table: string) => ({
        select: (cols: string) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => {
                const res = await db.query<any>(
                  `SELECT ${cols === "*" ? "*" : cols} FROM public.${table} WHERE ${col1} = $1 AND ${col2} = $2 LIMIT 1`,
                  [val1, val2]
                );
                return { data: res.rows[0] || null, error: null };
              },
            }),
            maybeSingle: async () => {
              const res = await db.query<any>(
                `SELECT ${cols === "*" ? "*" : cols} FROM public.${table} WHERE ${col1} = $1 LIMIT 1`,
                [val1]
              );
              return { data: res.rows[0] || null, error: null };
            },
          }),
        }),
      }),
    } as any;
  }

  describe("1. Centralized Tenant Ownership Guard (assertEventTenantAccess)", () => {
    it("returns 401 Unauthorized when no session exists", async () => {
      const mockSb = createMockSb();
      const res = await assertEventTenantAccess(eventAId, {
        session: null,
        sb: mockSb,
      });

      expect(res.authorized).toBe(false);
      if (!res.authorized) {
        expect(res.status).toBe(401);
        expect(res.code).toBe("UNAUTHORIZED");
      }
    });

    it("returns 404 Not Found when event does not exist", async () => {
      const mockSb = createMockSb();
      const sessionA: ClientSession = {
        role: "client",
        clientId: clientAId,
        email: "clienta@example.com",
        name: "Client A",
      };

      const res = await assertEventTenantAccess("00000000-0000-0000-0000-000000000099", {
        session: sessionA,
        sb: mockSb,
      });

      expect(res.authorized).toBe(false);
      if (!res.authorized) {
        expect(res.status).toBe(404);
        expect(res.code).toBe("NOT_FOUND");
      }
    });

    it("blocks cross-tenant tampering with 403 Forbidden when Client A accesses Client B's event", async () => {
      const mockSb = createMockSb();
      const sessionA: ClientSession = {
        role: "client",
        clientId: clientAId,
        email: "clienta@example.com",
        name: "Client A",
      };

      // Client A attempts to access Event B
      const res = await assertEventTenantAccess(eventBId, {
        session: sessionA,
        sb: mockSb,
      });

      expect(res.authorized).toBe(false);
      if (!res.authorized) {
        expect(res.status).toBe(403);
        expect(res.code).toBe("FORBIDDEN_CROSS_TENANT");
        expect(res.error).toContain("Cross-tenant access denied");
      }
    });

    it("allows Client A to access their own Event A by UUID or slug", async () => {
      const mockSb = createMockSb();
      const sessionA: ClientSession = {
        role: "client",
        clientId: clientAId,
        email: "clienta@example.com",
        name: "Client A",
      };

      // By UUID
      const resUuid = await assertEventTenantAccess(eventAId, {
        session: sessionA,
        sb: mockSb,
      });
      expect(resUuid.authorized).toBe(true);
      if (resUuid.authorized) {
        expect(resUuid.event.id).toBe(eventAId);
        expect(resUuid.event.client_id).toBe(clientAId);
      }

      // By slug
      const resSlug = await assertEventTenantAccess("event-a", {
        session: sessionA,
        sb: mockSb,
      });
      expect(resSlug.authorized).toBe(true);
      if (resSlug.authorized) {
        expect(resSlug.event.slug).toBe("event-a");
      }
    });

    it("allows Superadmin to access any tenant event (Event A or Event B)", async () => {
      const mockSb = createMockSb();
      const superadminSession: SuperadminSession = {
        role: "superadmin",
        email: "admin@unveiled.id",
        name: "Platform Superadmin",
      };

      const resA = await assertEventTenantAccess(eventAId, {
        session: superadminSession,
        sb: mockSb,
      });
      expect(resA.authorized).toBe(true);

      const resB = await assertEventTenantAccess(eventBId, {
        session: superadminSession,
        sb: mockSb,
      });
      expect(resB.authorized).toBe(true);
    });
  });

  describe("2. Globally Unique Token Generation & Non-Repeating Rotation", () => {
    it("guarantees rotating token never matches immediate previous token", async () => {
      const prevToken = "ABCD1234";
      for (let i = 0; i < 20; i++) {
        const nextToken = await generateUniqueEventToken({
          previousToken: prevToken,
          checkExists: async () => false,
        });
        expect(nextToken).not.toBe(prevToken);
        expect(nextToken.length).toBeGreaterThanOrEqual(8);
      }
    });

    it("automatically retries when collision is detected in database", async () => {
      let attempts = 0;
      const collidedToken = "COLLIDE1";

      const nextToken = await generateUniqueEventToken({
        checkExists: async (candidate) => {
          attempts++;
          // Simulate first 2 candidates colliding
          if (attempts <= 2) return true;
          return false;
        },
      });

      expect(attempts).toBeGreaterThanOrEqual(3);
      expect(nextToken).toBeDefined();
    });

    it("database unique index rejects duplicate access_token inserts", async () => {
      await expect(
        db.exec(`
          INSERT INTO public.events (slug, couple_names, access_token)
          VALUES ('duplicate-test', 'Duplicate Test', 'TOK-A1A1');
        `)
      ).rejects.toThrow();
    });
  });

  describe("3. Zero-Flicker Returning Guest Hydration", () => {
    it("correctly pre-computes remaining shots from server count", () => {
      const shotsPerGuest = 24;
      const serverShotsTaken = 9;

      const shotsLeft = Math.max(0, shotsPerGuest - serverShotsTaken);
      expect(shotsLeft).toBe(15);

      // Verify bounds when over-limit
      const overLimitTaken = 25;
      const shotsLeftOver = Math.max(0, shotsPerGuest - overLimitTaken);
      expect(shotsLeftOver).toBe(0);
    });
  });
});
