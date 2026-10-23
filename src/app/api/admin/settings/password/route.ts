import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getAuthSession,
  verifyClientPassword,
  hashClientPassword,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIp(req);
    // Rate limit: 5 password changes/attempts per minute per IP
    const ipLimit = await checkRateLimit(`pwd_change_ip:${ip}`, 5, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = body.currentPassword?.trim();
    const newPassword = body.newPassword?.trim();

    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password cannot exceed 128 characters" },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();

    // 1. Locate the caller's client record
    let query = sb.from("clients").select("id, email, password_hash, access_code, status");
    if (session.role === "client") {
      query = query.eq("id", session.clientId);
    } else {
      query = query.eq("email", session.email.toLowerCase());
    }

    const { data: client, error: clientErr } = await query.maybeSingle();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: "User account record not found" },
        { status: 404 }
      );
    }

    // 2. Validate current password with constant-time comparison (crypto.timingSafeEqual)
    let isCurrentValid = false;

    if (client.password_hash) {
      isCurrentValid = verifyClientPassword(currentPassword, client.password_hash);
    } else if (client.access_code) {
      isCurrentValid = currentPassword.toUpperCase() === client.access_code.toUpperCase();
    }

    // Fallback check against Supabase Auth for superadmin if no hash in clients yet
    if (!isCurrentValid && session.role === "superadmin") {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const sup = await createClient();
        const { error: authErr } = await sup.auth.signInWithPassword({
          email: session.email,
          password: currentPassword,
        });
        if (!authErr) {
          isCurrentValid = true;
        }
      } catch {}
    }

    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // 3. Hash new password with scrypt (16-byte salt, 64-byte key)
    const newHash = hashClientPassword(newPassword);

    // 4. Update password_hash in database
    const { error: updateErr } = await sb
      .from("clients")
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (updateErr) {
      console.error("Failed to update password hash in clients:", updateErr);
      return NextResponse.json(
        { error: "Failed to update password. Please try again." },
        { status: 500 }
      );
    }

    // 5. If superadmin, also synchronize Supabase Auth user password
    if (session.role === "superadmin") {
      try {
        const { data: userList } = await sb.auth.admin.listUsers();
        const authUser = userList?.users?.find(
          (u) => u.email?.toLowerCase() === session.email.toLowerCase()
        );
        if (authUser) {
          await sb.auth.admin.updateUserById(authUser.id, {
            password: newPassword,
          });
        }
      } catch (authSyncErr) {
        console.warn("Notice: Supabase Auth sync skipped:", authSyncErr);
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Password updated successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
