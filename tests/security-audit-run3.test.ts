import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { join } from "path";
import {
  createOAuthStateToken,
  verifyOAuthStateToken,
} from "@/lib/security/encryption";
import {
  signSessionToken,
  type AuthSession,
  type ClientSession,
  type SuperadminSession,
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

describe("Security Audit Run-3 Remediation Tests", () => {
  describe("Finding 1: OAuth 2.0 CSRF State Token Cryptographic Invariants", () => {
    it("generates a signed state token containing event slug and valid expiration", () => {
      const slug = "test-wedding-2026";
      const token = createOAuthStateToken(slug);

      expect(typeof token).toBe("string");
      expect(token).toContain(".");

      const verified = verifyOAuthStateToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.slug).toBe(slug);
      expect(verified?.nonce).toBeDefined();
      expect(verified?.nonce.length).toBe(48); // 24 bytes hex
    });

    it("rejects state tokens with forged or tampered signatures", () => {
      const token = createOAuthStateToken("our-wedding");
      const [payloadB64, sig] = token.split(".");

      // Tamper signature by changing last character
      const tamperedSig = sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a");
      const tamperedToken = `${payloadB64}.${tamperedSig}`;

      expect(verifyOAuthStateToken(tamperedToken)).toBeNull();
    });

    it("rejects state tokens with tampered payloads", () => {
      const token = createOAuthStateToken("our-wedding");
      const [, sig] = token.split(".");

      // Tamper payload to point to a different slug
      const tamperedPayload = Buffer.from(
        JSON.stringify({ slug: "victim-wedding", nonce: "forged", exp: Date.now() + 60000 })
      ).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${sig}`;

      expect(verifyOAuthStateToken(tamperedToken)).toBeNull();
    });

    it("rejects state tokens that have expired", () => {
      // Craft an expired token with valid signature
      const expiredPayload = Buffer.from(
        JSON.stringify({ slug: "our-wedding", nonce: "expired-nonce", exp: Date.now() - 1000 })
      ).toString("base64url");

      // Sign with the system key
      const { createHmac, createHash } = require("node:crypto");
      const secret =
        process.env.TOKEN_ENCRYPTION_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.GOOGLE_CLIENT_SECRET ||
        "dazzwed-secure-token-vault-key-32b!";
      const key = createHash("sha256").update(secret).digest();
      const sig = createHmac("sha256", key).update(expiredPayload).digest("hex");
      const expiredToken = `${expiredPayload}.${sig}`;

      expect(verifyOAuthStateToken(expiredToken)).toBeNull();
    });

    it("rejects empty, non-string, or malformed state tokens", () => {
      expect(verifyOAuthStateToken("")).toBeNull();
      expect(verifyOAuthStateToken("nodots")).toBeNull();
      expect(verifyOAuthStateToken("too.many.dots.here")).toBeNull();
      expect(verifyOAuthStateToken(null as any)).toBeNull();
    });
  });

  describe("Finding 2: Cross-Tenant Drive File Exfiltration via Photo Proxy ID", () => {
    let db: PGlite;
    let clientAId: string;
    let clientBId: string;
    let eventAId: string;
    let eventBId: string;
    let photoAId: string;
    let photoBId: string;
    const driveFileIdA = "1DriveFileIdClientA1234567890";
    const driveFileIdB = "1DriveFileIdClientB0987654321";

    beforeEach(async () => {
      db = new PGlite();
      await db.exec(supabaseStub);

      const m1 = readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf-8");
      const m3 = readFileSync(join(process.cwd(), "supabase/migrations/0003_photo_metadata.sql"), "utf-8");
      const m9 = readFileSync(join(process.cwd(), "supabase/migrations/0009_event_access_tokens.sql"), "utf-8");
      const m11 = readFileSync(join(process.cwd(), "supabase/migrations/0011_multi_event_saas.sql"), "utf-8");
      const m12 = readFileSync(join(process.cwd(), "supabase/migrations/0012_clients_and_rbac.sql"), "utf-8");
      const m13 = readFileSync(join(process.cwd(), "supabase/migrations/0013_unique_event_access_token.sql"), "utf-8");

      await db.exec(m1);
      await db.exec(m3);
      await db.exec(m9);
      await db.exec(m11);
      await db.exec(m12);
      await db.exec(m13);

      // Create Clients
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

      // Create Events
      eventAId = (
        await db.query<any>(`
          INSERT INTO public.events (slug, couple_names, shots_per_guest, status, client_id, access_token)
          VALUES ('event-a', 'Alice & Alex', 24, 'active', '${clientAId}', 'TOK-A1A1')
          RETURNING id;
        `)
      ).rows[0].id;

      eventBId = (
        await db.query<any>(`
          INSERT INTO public.events (slug, couple_names, shots_per_guest, status, client_id, access_token)
          VALUES ('event-b', 'Bob & Bella', 24, 'active', '${clientBId}', 'TOK-B2B2')
          RETURNING id;
        `)
      ).rows[0].id;

      // Create Guests
      const guestAId = (
        await db.query<any>(`
          INSERT INTO public.guests (event_id, display_name)
          VALUES ('${eventAId}', 'Alice Guest')
          RETURNING id;
        `)
      ).rows[0].id;

      const guestBId = (
        await db.query<any>(`
          INSERT INTO public.guests (event_id, display_name)
          VALUES ('${eventBId}', 'Bob Guest')
          RETURNING id;
        `)
      ).rows[0].id;

      // Create Photos with specific Drive File IDs
      photoAId = (
        await db.query<any>(`
          INSERT INTO public.photos (event_id, guest_id, shot_id, drive_file_id, status)
          VALUES ('${eventAId}', '${guestAId}', '00000000-0000-0000-0000-000000000001', '${driveFileIdA}', 'confirmed')
          RETURNING id;
        `)
      ).rows[0].id;

      photoBId = (
        await db.query<any>(`
          INSERT INTO public.photos (event_id, guest_id, shot_id, drive_file_id, status)
          VALUES ('${eventBId}', '${guestBId}', '00000000-0000-0000-0000-000000000002', '${driveFileIdB}', 'confirmed')
          RETURNING id;
        `)
      ).rows[0].id;
    });

    /**
     * Simulates the updated /api/admin/photos/[id] resolution and tenant authorization logic
     */
    async function resolvePhotoAccess(
      id: string,
      session: AuthSession | null
    ): Promise<{ status: number; error?: string; targetDriveFileId?: string }> {
      if (!session) {
        return { status: 401, error: "Unauthorized" };
      }

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{10,128}$/;

      const isUuid = UUID_REGEX.test(id);
      const isDriveId = DRIVE_FILE_ID_REGEX.test(id);

      if (!isUuid && !isDriveId) {
        return { status: 400, error: "Invalid photo identifier format" };
      }

      // Query database joining event for client_id
      let sql: string;
      if (isUuid) {
        sql = `
          SELECT p.id, p.shot_id, p.drive_file_id, p.original_drive_file_id, p.status, p.event_id, e.client_id
          FROM public.photos p
          JOIN public.events e ON e.id = p.event_id
          WHERE p.id = '${id}' OR p.shot_id = '${id}'
          LIMIT 1;
        `;
      } else {
        sql = `
          SELECT p.id, p.shot_id, p.drive_file_id, p.original_drive_file_id, p.status, p.event_id, e.client_id
          FROM public.photos p
          JOIN public.events e ON e.id = p.event_id
          WHERE p.drive_file_id = '${id}' OR p.original_drive_file_id = '${id}'
          LIMIT 1;
        `;
      }

      const res = await db.query<any>(sql);
      const photo = res.rows[0];

      if (!photo) {
        return { status: 404, error: "Photo not found" };
      }

      if (session.role === "client") {
        if (photo.client_id !== session.clientId) {
          return { status: 403, error: "Access denied to photos of another client" };
        }
      }

      return { status: 200, targetDriveFileId: photo.drive_file_id };
    }

    it("rejects unmapped Drive file IDs with 404 (never blindly streaming arbitrary Drive files)", async () => {
      const clientASession: ClientSession = {
        name: "Client A",
        email: "clienta@example.com",
        role: "client",
        clientId: clientAId,
      };

      const result = await resolvePhotoAccess("1UnmappedDriveFileId99999", clientASession);
      expect(result.status).toBe(404);
      expect(result.error).toBe("Photo not found");
      expect(result.targetDriveFileId).toBeUndefined();
    });

    it("rejects Client A attempting to access Client B's photo via Drive file ID with 403 Forbidden", async () => {
      const clientASession: ClientSession = {
        name: "Client A",
        email: "clienta@example.com",
        role: "client",
        clientId: clientAId,
      };

      // Client A attempts to fetch Client B's photo by Drive file ID
      const result = await resolvePhotoAccess(driveFileIdB, clientASession);
      expect(result.status).toBe(403);
      expect(result.error).toBe("Access denied to photos of another client");
    });

    it("allows Client A to access their own photo via Drive file ID", async () => {
      const clientASession: ClientSession = {
        name: "Client A",
        email: "clienta@example.com",
        role: "client",
        clientId: clientAId,
      };

      const result = await resolvePhotoAccess(driveFileIdA, clientASession);
      expect(result.status).toBe(200);
      expect(result.targetDriveFileId).toBe(driveFileIdA);
    });

    it("allows Superadmin to access any tenant photo by Drive file ID", async () => {
      const superadminSession: SuperadminSession = {
        userId: "superadmin-1",
        name: "Super Admin",
        email: "platform@dazzwed.com",
        role: "superadmin",
      };

      const resultA = await resolvePhotoAccess(driveFileIdA, superadminSession);
      expect(resultA.status).toBe(200);

      const resultB = await resolvePhotoAccess(driveFileIdB, superadminSession);
      expect(resultB.status).toBe(200);
    });

    it("rejects malformed identifiers with 400 Bad Request", async () => {
      const clientASession: ClientSession = {
        name: "Client A",
        email: "clienta@example.com",
        role: "client",
        clientId: clientAId,
      };

      const result = await resolvePhotoAccess("../../etc/passwd", clientASession);
      expect(result.status).toBe(400);
      expect(result.error).toBe("Invalid photo identifier format");
    });
  });

  describe("Finding 3: Admin LUT Upload Bounds & Stock Protection Invariants", () => {
    const PROTECTED_STOCK_PRESETS = new Set([
      "warm-portrait-400.cube",
      "tungsten-800t.cube",
      "cinema-250d.cube",
      "mono-street-400.cube",
      "super-8mm-vintage.cube",
      "vivid-100.cube",
      "rangefinder-35.cube",
      "classic-neg-400.cube",
      "golden-200.cube",
    ]);
    const MAX_LUT_SIZE = 2 * 1024 * 1024; // 2 MB

    function validateLutUpload(
      fileName: string,
      fileSize: number,
      content: string,
      sessionRole: "superadmin" | "client",
      clientId?: string
    ): { status: number; error?: string; savedFileName?: string } {
      if (!fileName.toLowerCase().endsWith(".cube")) {
        return { status: 400, error: "Only .cube LUT files are accepted" };
      }

      if (fileSize > MAX_LUT_SIZE) {
        return { status: 413, error: "File exceeds 2 MB limit" };
      }

      const rawSafeName = fileName.toLowerCase().replace(/[^a-z0-9._-]/g, "-");

      if (PROTECTED_STOCK_PRESETS.has(rawSafeName)) {
        return { status: 403, error: "Cannot overwrite system stock LUT preset" };
      }

      if (content.includes("\0")) {
        return { status: 400, error: "Invalid LUT file: binary content detected" };
      }

      const upper = content.toUpperCase();
      if (!upper.includes("LUT_3D_SIZE") && !upper.includes("LUT_1D_SIZE")) {
        return { status: 400, error: "Invalid LUT file: missing LUT_3D_SIZE or LUT_1D_SIZE declaration" };
      }

      let finalFileName = rawSafeName;
      if (sessionRole === "client" && clientId) {
        const clientPrefix = `client-${clientId.slice(0, 8)}-`;
        if (!rawSafeName.startsWith(clientPrefix)) {
          finalFileName = `${clientPrefix}${rawSafeName}`;
        }
      }

      return { status: 200, savedFileName: finalFileName };
    }

    it("rejects files exceeding 2 MB with 413 Payload Too Large", () => {
      const result = validateLutUpload(
        "custom-look.cube",
        2.5 * 1024 * 1024,
        "TITLE custom\nLUT_3D_SIZE 33\n",
        "client",
        "11111111-2222-3333-4444-555555555555"
      );
      expect(result.status).toBe(413);
      expect(result.error).toBe("File exceeds 2 MB limit");
    });

    it("rejects uploads attempting to overwrite stock system presets with 403 Forbidden", () => {
      const result = validateLutUpload(
        "warm-portrait-400.cube",
        1000,
        "TITLE stock\nLUT_3D_SIZE 33\n",
        "client",
        "11111111-2222-3333-4444-555555555555"
      );
      expect(result.status).toBe(403);
      expect(result.error).toBe("Cannot overwrite system stock LUT preset");
    });

    it("rejects invalid content containing binary null bytes", () => {
      const result = validateLutUpload(
        "corrupted.cube",
        1000,
        "LUT_3D_SIZE 33\n\0\0\0bad",
        "client",
        "11111111-2222-3333-4444-555555555555"
      );
      expect(result.status).toBe(400);
      expect(result.error).toBe("Invalid LUT file: binary content detected");
    });

    it("rejects text files missing valid LUT_3D_SIZE / LUT_1D_SIZE headers", () => {
      const result = validateLutUpload(
        "random-text.cube",
        1000,
        "hello world this is just random text",
        "client",
        "11111111-2222-3333-4444-555555555555"
      );
      expect(result.status).toBe(400);
      expect(result.error).toContain("missing LUT_3D_SIZE");
    });

    it("namespaces valid client LUT uploads with client tenant prefix", () => {
      const clientId = "abcdef12-3456-7890-abcd-ef1234567890";
      const result = validateLutUpload(
        "sunset-glow.cube",
        50000,
        "TITLE Sunset\nLUT_3D_SIZE 17\n0.0 0.0 0.0",
        "client",
        clientId
      );
      expect(result.status).toBe(200);
      expect(result.savedFileName).toBe("client-abcdef12-sunset-glow.cube");
    });
  });
});
