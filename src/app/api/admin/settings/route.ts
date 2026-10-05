import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: event, error } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      id?: string;
      couple_names?: string;
      shots_per_guest?: number;
      opens_at?: string | null;
      closes_at?: string | null;
      manually_closed?: boolean;
      theme?: Record<string, unknown>;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.couple_names === "string") updates.couple_names = body.couple_names.trim();
    if (typeof body.shots_per_guest === "number") {
      if (body.shots_per_guest < 1 || body.shots_per_guest > 100) {
        return NextResponse.json({ error: "shots_per_guest must be between 1 and 100" }, { status: 400 });
      }
      updates.shots_per_guest = body.shots_per_guest;
    }
    if (body.opens_at !== undefined) updates.opens_at = body.opens_at;
    if (body.closes_at !== undefined) updates.closes_at = body.closes_at;
    if (typeof body.manually_closed === "boolean") updates.manually_closed = body.manually_closed;
    if (body.theme && typeof body.theme === "object") updates.theme = body.theme;

    const sb = supabaseAdmin();
    const { data: updated, error } = await sb
      .from("events")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${msg}` }, { status: 500 });
  }
}
