import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { join } from "path";
import {
  signSessionToken,
  verifySessionToken,
  hashClientPassword,
  verifyClientPassword,
  type AuthSession,
} from "@/lib/auth/session";

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

describe("Stage 2 Multi-Tenant SaaS — RBAC & Tenant Isolation", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(supabaseStub);

    // Apply migrations up to 0012
    const m1 = readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf-8");
    const m9 = readFileSync(join(process.cwd(), "supabase/migrations/0009_event_access_tokens.sql"), "utf-8");
    const m11 = readFileSync(join(process.cwd(), "supabase/migrations/0011_multi_event_saas.sql"), "utf-8");
    const m12 = readFileSync(join(process.cwd(), "supabase/migrations/0012_clients_and_rbac.sql"), "utf-8");

    await db.exec(m1);
    await db.exec(m9);
    await db.exec(m11);
    await db.exec(m12);
  });

  describe("1. Database Schema & Multi-Client Linking (0012)", () => {
    it("creates clients table with unique email and links events via client_id", async () => {
      // Create Client 1
      const client1 = (await db.query<any>(`
        INSERT INTO public.clients (name, email, access_code, max_events, status)
        VALUES ('Dhifa & Riefky', 'dhifa@example.com', 'DZ-ABCD12', 1, 'active')
        RETURNING id;
      `)).rows[0].id;

      // Create Client 2
      const client2 = (await db.query<any>(`
        INSERT INTO public.clients (name, email, access_code, max_events, status)
        VALUES ('Lumina WO', 'wo@lumina.id', 'DZ-WOLUM9', 3, 'active')
        RETURNING id;
      `)).rows[0].id;

      // Link events to Client 1
      await db.exec(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, client_id)
        VALUES ('dhifa-riefky-wedding', 'Dhifa & Riefky', 27, 'DHIF001', '${client1}');
      `);

      // Link 2 events to Client 2
      await db.exec(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, client_id)
        VALUES ('lumina-engagement', 'Engagement Roll', 15, 'LUM001', '${client2}');

        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, client_id)
        VALUES ('lumina-wedding', 'Wedding Roll', 27, 'LUM002', '${client2}');
      `);

      // Unassigned Owner event
      await db.exec(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, client_id)
        VALUES ('owner-test', 'Owner Master Roll', 100, 'OWN001', NULL);
      `);

      // Verify query scoped by client 1 strictly returns only Client 1 events
      const client1Events = await db.query<any>(`
        SELECT slug, couple_names FROM public.events WHERE client_id = $1;
      `, [client1]);
      expect(client1Events.rows).toHaveLength(1);
      expect(client1Events.rows[0].slug).toBe("dhifa-riefky-wedding");

      // Verify query scoped by client 2 strictly returns 2 events
      const client2Events = await db.query<any>(`
        SELECT slug, couple_names FROM public.events WHERE client_id = $1;
      `, [client2]);
      expect(client2Events.rows).toHaveLength(2);

      // Verify unassigned owner event has client_id IS NULL
      const ownerEvents = await db.query<any>(`
        SELECT slug FROM public.events WHERE client_id IS NULL;
      `);
      expect(ownerEvents.rows.some((r) => r.slug === "owner-test")).toBe(true);
    });

    it("prevents duplicate client emails (case-insensitive)", async () => {
      await db.exec(`
        INSERT INTO public.clients (name, email, access_code, max_events)
        VALUES ('Client A', 'test@wedding.com', 'CODE1111', 1);
      `);

      // Same email in lowercase/uppercase should violate unique constraint
      await expect(
        db.exec(`
          INSERT INTO public.clients (name, email, access_code, max_events)
          VALUES ('Client B', 'TEST@wedding.com', 'CODE2222', 1);
        `)
      ).rejects.toThrow();
    });
  });

  describe("2. Cryptographic Session Token Security & RBAC", () => {
    it("signs and verifies superadmin session correctly", () => {
      const superadminSession: AuthSession = {
        role: "superadmin",
        email: "owner@dazzwed.my.id",
        name: "Platform Owner",
      };

      const token = signSessionToken(superadminSession);
      expect(token).toContain(".");

      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.role).toBe("superadmin");
      expect(verified?.email).toBe("owner@dazzwed.my.id");
    });

    it("signs and verifies client session with clientId", () => {
      const clientSession: AuthSession = {
        role: "client",
        clientId: "client-uuid-12345",
        email: "dhifa@example.com",
        name: "Dhifa & Riefky",
        maxEvents: 2,
      };

      const token = signSessionToken(clientSession);
      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.role).toBe("client");
      if (verified?.role === "client") {
        expect(verified.clientId).toBe("client-uuid-12345");
        expect(verified.maxEvents).toBe(2);
      }
    });

    it("rejects tampered session tokens with signature mismatch", () => {
      const clientSession: AuthSession = {
        role: "client",
        clientId: "client-uuid-12345",
        email: "dhifa@example.com",
        name: "Dhifa",
      };

      const token = signSessionToken(clientSession);
      const [payload, signature] = token.split(".");

      // Attacker attempts privilege escalation by modifying role from client to superadmin
      const forgedPayload = Buffer.from(
        JSON.stringify({ role: "superadmin", email: "attacker@hack.com", name: "Hacker" })
      ).toString("base64url");

      const tamperedToken = `${forgedPayload}.${signature}`;
      const result = verifySessionToken(tamperedToken);
      expect(result).toBeNull();
    });

    it("rejects malformed or empty session tokens", () => {
      expect(verifySessionToken(null)).toBeNull();
      expect(verifySessionToken("")).toBeNull();
      expect(verifySessionToken("malformed-token-without-dot")).toBeNull();
    });
  });

  describe("3. Secure Password & Access Code Verification", () => {
    it("hashes password with scrypt and verifies matches accurately", () => {
      const password = "WeddingSecret2026!";
      const hash = hashClientPassword(password);
      expect(hash).toContain(":");

      expect(verifyClientPassword(password, hash)).toBe(true);
      expect(verifyClientPassword("WrongPassword123", hash)).toBe(false);
      expect(verifyClientPassword("", hash)).toBe(false);
    });
  });

  describe("4. Photo Tenant Ownership Security Check", () => {
    it("verifies client can only view and mutate photos belonging to their assigned event", async () => {
      // Client 1 (Dhifa) & Client 2 (Alya)
      const c1 = (await db.query<any>(`
        INSERT INTO public.clients (name, email, access_code) VALUES ('Dhifa', 'c1@test.com', 'CODEC111') RETURNING id;
      `)).rows[0].id;
      const c2 = (await db.query<any>(`
        INSERT INTO public.clients (name, email, access_code) VALUES ('Alya', 'c2@test.com', 'CODEC222') RETURNING id;
      `)).rows[0].id;

      // Event 1 (owned by C1) & Event 2 (owned by C2)
      const ev1 = (await db.query<any>(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, client_id)
        VALUES ('ev1-dhifa', 'Dhifa Wedding', 25, 'TOK11111', '${c1}') RETURNING id;
      `)).rows[0].id;

      const ev2 = (await db.query<any>(`
        INSERT INTO public.events (slug, couple_names, shots_per_guest, access_token, client_id)
        VALUES ('ev2-alya', 'Alya Wedding', 25, 'TOK22222', '${c2}') RETURNING id;
      `)).rows[0].id;

      // Guest & Photo for Event 2 (owned by C2)
      const g2 = (await db.query<any>(`
        INSERT INTO public.guests (event_id, display_name) VALUES ('${ev2}', 'Guest in Ev2') RETURNING id;
      `)).rows[0].id;

      const p2 = (await db.query<any>(`
        INSERT INTO public.photos (event_id, guest_id, shot_id, status)
        VALUES ('${ev2}', '${g2}', '${crypto.randomUUID()}', 'confirmed') RETURNING id;
      `)).rows[0].id;

      // Simulating tenant verification check from /api/admin/photos/[id]/**
      async function verifyPhotoTenantAccess(photoId: string, session: AuthSession): Promise<boolean> {
        if (session.role === "superadmin") return true;

        const photoRes = await db.query<any>(`
          SELECT p.id, p.event_id, e.client_id
          FROM public.photos p
          JOIN public.events e ON e.id = p.event_id
          WHERE p.id = $1;
        `, [photoId]);

        if (photoRes.rows.length === 0) return false;
        const photo = photoRes.rows[0];

        if (session.role === "client") {
          return photo.client_id === session.clientId;
        }
        return false;
      }

      // Test 1: Client 1 (Dhifa) attempts to access Client 2's photo -> MUST BE FORBIDDEN
      const client1Session: AuthSession = { role: "client", clientId: c1, email: "c1@test.com", name: "Dhifa" };
      const accessClient1 = await verifyPhotoTenantAccess(p2, client1Session);
      expect(accessClient1).toBe(false);

      // Test 2: Client 2 (Alya) accesses their own photo -> ALLOWED
      const client2Session: AuthSession = { role: "client", clientId: c2, email: "c2@test.com", name: "Alya" };
      const accessClient2 = await verifyPhotoTenantAccess(p2, client2Session);
      expect(accessClient2).toBe(true);

      // Test 3: Superadmin accesses any photo -> ALLOWED
      const superadminSession: AuthSession = { role: "superadmin", email: "owner@dazzwed.my.id", name: "Owner" };
      const accessSuperadmin = await verifyPhotoTenantAccess(p2, superadminSession);
      expect(accessSuperadmin).toBe(true);
    });
  });

  describe("5. Instant Suspension Verification", () => {
    it("revokes access immediately when client status is suspended in database", async () => {
      const client = (await db.query<any>(`
        INSERT INTO public.clients (name, email, access_code, status)
        VALUES ('Suspended Couple', 'suspended@test.com', 'SUSP1234', 'suspended')
        RETURNING id, status;
      `)).rows[0];

      // Simulated instant suspension check
      async function isSessionActive(clientId: string): Promise<boolean> {
        const res = await db.query<any>(`
          SELECT id, status FROM public.clients WHERE id = $1;
        `, [clientId]);
        if (res.rows.length === 0) return false;
        return res.rows[0].status === "active";
      }

      expect(await isSessionActive(client.id)).toBe(false);

      // Reactivate client in DB
      await db.exec(`UPDATE public.clients SET status = 'active' WHERE id = '${client.id}';`);
      expect(await isSessionActive(client.id)).toBe(true);
    });
  });
});
