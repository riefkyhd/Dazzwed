import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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

    if (!env.ADMIN_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: "Access denied: This email is not in the ADMIN_EMAILS allowlist." },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Invalid credentials" },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true, user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Login failed: ${msg}` }, { status: 500 });
  }
}
