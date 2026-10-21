import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateUniqueEventToken } from "@/lib/event-server";

export const dynamic = "force-dynamic";

/**
 * Admin API: Manage rotating event access token and expiration window
 */

export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      eventId?: string;
      tokenDurationHours?: number;
      tokenExpiresAt?: string | null;
    };

    if (!body.eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.tokenDurationHours === "number") {
      updates.token_duration_hours = Math.max(1, Math.min(8760, body.tokenDurationHours));
    }
    if (body.tokenExpiresAt !== undefined) {
      updates.token_expires_at = body.tokenExpiresAt ? new Date(body.tokenExpiresAt).toISOString() : null;
    }

    const sb = supabaseAdmin();
    const { data: updated, error } = await sb
      .from("events")
      .update(updates)
      .eq("id", body.eventId)
      .select("id, slug, access_token, token_expires_at, token_duration_hours")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/admin", "layout");
    if (updated?.slug) {
      revalidatePath(`/e/${updated.slug}`, "layout");
    }

    return NextResponse.json({
      ok: true,
      accessToken: updated.access_token,
      tokenExpiresAt: updated.token_expires_at,
      tokenDurationHours: updated.token_duration_hours,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      eventId?: string;
      tokenDurationHours?: number;
    };

    if (!body.eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const duration = typeof body.tokenDurationHours === "number"
      ? Math.max(1, Math.min(8760, body.tokenDurationHours))
      : 72;

    const sb = supabaseAdmin();

    // Query current event to ensure the rotated token is guaranteed unique and never repeats the previous token
    const { data: currentEvent } = await sb
      .from("events")
      .select("id, access_token")
      .eq("id", body.eventId)
      .maybeSingle();

    const newAccessToken = await generateUniqueEventToken({
      previousToken: currentEvent?.access_token,
    });
    const newExpiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

    const { data: updated, error } = await sb
      .from("events")
      .update({
        access_token: newAccessToken,
        token_expires_at: newExpiresAt,
        token_duration_hours: duration,
      })
      .eq("id", body.eventId)
      .select("id, slug, access_token, token_expires_at, token_duration_hours")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/admin", "layout");
    if (updated?.slug) {
      revalidatePath(`/e/${updated.slug}`, "layout");
    }

    return NextResponse.json({
      ok: true,
      accessToken: updated.access_token,
      tokenExpiresAt: updated.token_expires_at,
      tokenDurationHours: updated.token_duration_hours,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Token rotation failed: ${msg}` }, { status: 500 });
  }
}
