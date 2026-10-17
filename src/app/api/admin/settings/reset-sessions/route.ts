import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/settings/reset-sessions
 * Allows administrators to reset all device sessions and invalidate cookies across connected devices,
 * so guests can immediately start fresh camera rolls without manually clearing browser cookies/cache.
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      action?: "reset" | "clear";
    };

    const sb = supabaseAdmin();
    let query = sb.from("events").select("id, slug, couple_names, theme");
    if (body.eventId) {
      query = query.eq("id", body.eventId);
    } else {
      query = query.order("created_at", { ascending: true }).limit(1);
    }

    const { data: event, error: fetchErr } = await query.single();
    if (fetchErr || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const existingTheme = (event.theme && typeof event.theme === "object" ? event.theme : {}) as Record<string, unknown>;

    const isClear = body.action === "clear";
    const newResetTimestamp = isClear ? null : new Date().toISOString();
    const updatedTheme = {
      ...existingTheme,
      sessionResetAt: newResetTimestamp,
    };

    const { data: updatedEvent, error: updateErr } = await sb
      .from("events")
      .update({ theme: updatedTheme })
      .eq("id", event.id)
      .select("id, slug, theme")
      .single();

    if (updateErr || !updatedEvent) {
      return NextResponse.json({ error: updateErr?.message || "Failed to update event" }, { status: 500 });
    }

    revalidatePath("/admin", "layout");
    if (updatedEvent?.slug) {
      revalidatePath(`/e/${updatedEvent.slug}`, "layout");
    }

    return NextResponse.json({
      ok: true,
      action: isClear ? "cleared" : "reset",
      sessionResetAt: newResetTimestamp,
      message: isClear
        ? "Session reset timestamp removed. Original session tracking restored."
        : "All guest device sessions and cookies reset. Guests will automatically receive fresh camera rolls.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Reset failed: ${msg}` }, { status: 500 });
  }
}
