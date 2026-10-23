import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  signSessionToken,
  verifyClientPassword,
  SESSION_COOKIE_NAME,
  type AuthSession,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    // Rate limit: 5 login attempts per minute per IP
    const ipLimit = await checkRateLimit(`login_ip:${ip}`, 5, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait 1 minute." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
      );
    }

    const { email, password } = (await req.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const env = serverEnv();
    const cookieStore = await cookies();

    // 1. Check if email is an authorized Platform Owner / Superadmin
    if (env.ADMIN_EMAILS.includes(normalizedEmail)) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error && data.user) {
        const session: AuthSession = {
          role: "superadmin",
          email: normalizedEmail,
          userId: data.user.id,
          name: "Platform Owner",
        };
        const token = signSessionToken(session);
        cookieStore.set(SESSION_COOKIE_NAME, token, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 3600,
        });

        return NextResponse.json({
          ok: true,
          role: "superadmin",
          redirectTo: "/superadmin",
          user: { id: data.user.id, email: data.user.email },
        });
      }
    }

    // 2. Check if email matches a Client Host account (clients table)
    const sb = supabaseAdmin();
    const { data: rawClient, error: clientErr } = await sb
      .from("clients")
      .select("id, name, email, password_hash, access_code, status, notes")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!clientErr && rawClient) {
      const client = rawClient as {
        id: string;
        name: string;
        email: string;
        password_hash: string | null;
        access_code: string;
        status: string;
        notes?: string | null;
        role?: string | null;
      };

      // Check account suspension
      if (client.status === "suspended") {
        return NextResponse.json(
          { error: "This client account is currently suspended. Please contact platform support." },
          { status: 403 }
        );
      }

      // Check password (either hashed password match OR direct 8-char access code match)
      const isPasswordMatch =
        (client.access_code && password.trim().toUpperCase() === client.access_code.toUpperCase()) ||
        (client.password_hash && verifyClientPassword(password, client.password_hash));

      if (isPasswordMatch) {
        const isSuperadmin =
          client.role === "superadmin" ||
          client.notes === "superadmin" ||
          client.notes === "Platform Owner / Superadmin" ||
          env.ADMIN_EMAILS.includes(normalizedEmail);

        const session: AuthSession = isSuperadmin
          ? {
              role: "superadmin",
              email: client.email,
              userId: client.id,
              name: client.name || "Platform Owner",
            }
          : {
              role: "client",
              clientId: client.id,
              email: client.email,
              name: client.name,
            };
        const token = signSessionToken(session);
        cookieStore.set(SESSION_COOKIE_NAME, token, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 3600,
        });

        return NextResponse.json({
          ok: true,
          role: session.role,
          redirectTo: isSuperadmin ? "/superadmin" : "/admin",
          user: { id: client.id, email: client.email, name: client.name },
        });
      }
    }

    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Login failed: ${msg}` }, { status: 500 });
  }
}
