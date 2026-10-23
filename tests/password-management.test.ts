import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { join } from "path";
import {
  signSessionToken,
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

describe("Superadmin Provisioning & Password Management Security", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(supabaseStub);

    const m1 = readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf-8");
    const m9 = readFileSync(join(process.cwd(), "supabase/migrations/0009_event_access_tokens.sql"), "utf-8");
    const m11 = readFileSync(join(process.cwd(), "supabase/migrations/0011_multi_event_saas.sql"), "utf-8");
    const m12 = readFileSync(join(process.cwd(), "supabase/migrations/0012_clients_and_rbac.sql"), "utf-8");
    const m14 = readFileSync(join(process.cwd(), "supabase/migrations/0014_superadmin_and_password_security.sql"), "utf-8");

    await db.exec(m1);
    await db.exec(m9);
    await db.exec(m11);
    await db.exec(m12);
    await db.exec(m14);
  });

  describe("1. Database Schema & Superadmin Provisioning (0014)", () => {
    it("adds role column to clients table and provisions riefky.hd@gmail.com as superadmin", async () => {
      const res = await db.query<any>(`
        SELECT id, name, email, role, status, max_events, access_code
        FROM public.clients
        WHERE email = 'riefky.hd@gmail.com';
      `);

      expect(res.rows.length).toBe(1);
      const row = res.rows[0];
      expect(row.email).toBe("riefky.hd@gmail.com");
      expect(row.role).toBe("superadmin");
      expect(row.status).toBe("active");
      expect(row.max_events).toBe(999);
      expect(row.access_code).toBe("SUPERADM");
    });

    it("enforces role check constraint on clients table", async () => {
      await expect(
        db.query(`
          INSERT INTO public.clients (name, email, access_code, role)
          VALUES ('Invalid User', 'bad@example.com', 'CODE1234', 'hacker');
        `)
      ).rejects.toThrow();
    });
  });

  describe("2. Cryptographic Password Security (scrypt + timingSafeEqual)", () => {
    it("hashes password with a random 16-byte salt and scryptSync", () => {
      const hash1 = hashClientPassword("MySecretPass123!");
      const hash2 = hashClientPassword("MySecretPass123!");

      // Different random salts produce different hashes
      expect(hash1).not.toBe(hash2);
      expect(hash1).toContain(":");

      const [salt1, key1] = hash1.split(":");
      expect(salt1.length).toBe(32); // 16 bytes in hex
      expect(key1.length).toBe(128); // 64 bytes in hex
    });

    it("verifies matching password in constant time and rejects wrong password", () => {
      const hash = hashClientPassword("CorrectHorseBatteryStaple");

      expect(verifyClientPassword("CorrectHorseBatteryStaple", hash)).toBe(true);
      expect(verifyClientPassword("WrongPassword123!", hash)).toBe(false);
      expect(verifyClientPassword("correcthorsebatterystaple", hash)).toBe(false); // case-sensitive
      expect(verifyClientPassword("", hash)).toBe(false);
    });

    it("safely handles corrupted or malformed stored hashes without throwing", () => {
      expect(verifyClientPassword("test", "bad_hash_without_colon")).toBe(false);
      expect(verifyClientPassword("test", ":empty_salt")).toBe(false);
      expect(verifyClientPassword("test", "salt:")).toBe(false);
      expect(verifyClientPassword("test", "invalid_hex:not_hex")).toBe(false);
    });
  });

  describe("3. Password Change Flow & Re-Authentication", () => {
    it("updates password hash in database and enables instant re-authentication with new password", async () => {
      const initialPass = "OldPassword2026!";
      const newPass = "NewSecurePassword2026!";

      const initialHash = hashClientPassword(initialPass);

      // Set initial password for superadmin
      await db.query(`
        UPDATE public.clients
        SET password_hash = $1
        WHERE email = 'riefky.hd@gmail.com';
      `, [initialHash]);

      // Verify current password
      const userBefore = (await db.query<any>(`
        SELECT password_hash FROM public.clients WHERE email = 'riefky.hd@gmail.com';
      `)).rows[0];
      expect(verifyClientPassword(initialPass, userBefore.password_hash)).toBe(true);

      // Perform password update with scrypt
      const updatedHash = hashClientPassword(newPass);
      await db.query(`
        UPDATE public.clients
        SET password_hash = $1, updated_at = now()
        WHERE email = 'riefky.hd@gmail.com';
      `, [updatedHash]);

      // Verify old password now fails and new password succeeds
      const userAfter = (await db.query<any>(`
        SELECT password_hash FROM public.clients WHERE email = 'riefky.hd@gmail.com';
      `)).rows[0];
      expect(verifyClientPassword(initialPass, userAfter.password_hash)).toBe(false);
      expect(verifyClientPassword(newPass, userAfter.password_hash)).toBe(true);
    });

    it("validates session token signing for superadmin and client roles", () => {
      const superadminSession: AuthSession = {
        role: "superadmin",
        email: "riefky.hd@gmail.com",
        name: "Muhammad Riefky Hadid",
      };

      const token = signSessionToken(superadminSession);
      expect(typeof token).toBe("string");
      expect(token).toContain(".");

      const clientSession: AuthSession = {
        role: "client",
        clientId: "11111111-2222-3333-4444-555555555555",
        email: "client@example.com",
        name: "Wedding Client",
      };

      const clientToken = signSessionToken(clientSession);
      expect(typeof clientToken).toBe("string");
      expect(clientToken).toContain(".");
    });
  });
});
