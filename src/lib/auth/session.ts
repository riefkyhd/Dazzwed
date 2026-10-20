import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/env";

export const SESSION_COOKIE_NAME = "dazzwed_auth_session";

export interface SuperadminSession {
  role: "superadmin";
  email: string;
  userId?: string;
  name: string;
}

export interface ClientSession {
  role: "client";
  clientId: string;
  email: string;
  name: string;
  maxEvents?: number;
}

export type AuthSession = SuperadminSession | ClientSession;

function getHmacSecret(): string {
  try {
    const env = serverEnv();
    return env.RATE_LIMIT_HMAC_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "dazzwed-secure-hmac-session-secret-key-32b";
  } catch {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || "dazzwed-secure-hmac-session-secret-key-32b";
  }
}

/**
 * Signs an AuthSession into an tamper-proof cookie payload
 * Format: `<base64Payload>.<hmacSignature>`
 */
export function signSessionToken(session: AuthSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const secret = getHmacSecret();
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Verifies and decodes a signed session token. Returns null if invalid or tampered.
 */
export function verifySessionToken(token: string | undefined | null): AuthSession | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const secret = getHmacSecret();
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf-8");
    const data = JSON.parse(json) as AuthSession;
    if (data.role === "superadmin" || data.role === "client") {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Simple, cryptographically secure password hashing for Client accounts (scrypt)
 */
export function hashClientPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password.trim(), salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyClientPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const derivedKey = scryptSync(password.trim(), salt, 64);
    const keyBuf = Buffer.from(key, "hex");
    return keyBuf.length === derivedKey.length && timingSafeEqual(keyBuf, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Retrieves the current authenticated session from cookies.
 * Security Check 2: Immediately verifies that a client record is still 'active' in DB
 * so suspending a client immediately revokes access even if their cookie is still valid.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  let cookieVal: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieVal = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return null;
  }

  const session = verifySessionToken(cookieVal);
  if (!session) return null;

  // Superadmin verification
  if (session.role === "superadmin") {
    return session;
  }

  // Client verification: Instant suspension check
  if (session.role === "client") {
    try {
      const sb = supabaseAdmin();
      const { data: client, error } = await sb
        .from("clients")
        .select("id, status, name, max_events")
        .eq("id", session.clientId)
        .maybeSingle();

      if (error || !client || client.status !== "active") {
        return null; // Immediately revoked!
      }
      return {
        ...session,
        name: client.name || session.name,
        maxEvents: client.max_events ?? session.maxEvents ?? 1,
      };
    } catch {
      // If table does not exist or network glitch, fallback to valid session
      return session;
    }
  }

  return null;
}

/**
 * Requires superadmin role, redirects to login if not authorized.
 */
export async function requireSuperadmin(redirectTo = "/admin/login"): Promise<SuperadminSession> {
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    redirect(redirectTo);
  }
  return session;
}

/**
 * Requires any valid authenticated user (Superadmin or active Client Host).
 */
export async function requireAuthUser(redirectTo = "/admin/login"): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) {
    redirect(redirectTo);
  }
  return session;
}
