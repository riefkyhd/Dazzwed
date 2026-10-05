import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const env = serverEnv();

    if (!env.ADMIN_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: "Access denied: This email is not in the ADMIN_EMAILS allowlist." },
        { status: 403 },
      );
    }

    const sbAdmin = supabaseAdmin();

    // Check if user already exists in auth.users
    const { data: listData } = await sbAdmin.auth.admin.listUsers();
    const existing = listData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    );

    if (existing) {
      // User exists, so update their password
      const { error: updateErr } = await sbAdmin.auth.admin.updateUserById(
        existing.id,
        { password, email_confirm: true },
      );
      if (updateErr) {
        return NextResponse.json(
          { error: `Failed to update password: ${updateErr.message}` },
          { status: 500 },
        );
      }
    } else {
      // Create user with confirmed email
      const { error: createErr } = await sbAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });

      if (createErr) {
        return NextResponse.json(
          { error: `Failed to create user: ${createErr.message}` },
          { status: 500 },
        );
      }
    }

    // Sign in the newly created or updated admin to establish session cookies
    const supabase = await createClient();
    const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signErr || !signData.user) {
      return NextResponse.json(
        { error: `Account ready, but login failed: ${signErr?.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Admin password successfully set and logged in.",
      user: { id: signData.user.id, email: signData.user.email },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Setup failed: ${msg}` }, { status: 500 });
  }
}
