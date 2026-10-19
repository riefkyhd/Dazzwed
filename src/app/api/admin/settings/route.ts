import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  const { getActiveAdminEvent } = await import("@/lib/events/active");
  const event = await getActiveAdminEvent(eventId);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Check whether drive is configured
  const hasGoogleDrive = !!event.drive_root_folder_id;
  return NextResponse.json({
    event: {
      ...event,
      has_google_drive: hasGoogleDrive,
    },
  });
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

    const sb = supabaseAdmin();
    // Fetch existing event to enforce package limits
    const { data: currentEvent } = await sb
      .from("events")
      .select("id, package_max_shots_per_guest, package_tier")
      .eq("id", body.id)
      .single();

    if (!currentEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.couple_names === "string") updates.couple_names = body.couple_names.trim();
    if (typeof body.shots_per_guest === "number") {
      const maxAllowed = currentEvent.package_max_shots_per_guest || 100;
      if (body.shots_per_guest < 1 || body.shots_per_guest > maxAllowed) {
        return NextResponse.json(
          { error: `shots_per_guest must be between 1 and ${maxAllowed} for your package tier (${currentEvent.package_tier})` },
          { status: 400 }
        );
      }
      updates.shots_per_guest = body.shots_per_guest;
    }
    if (body.opens_at !== undefined) updates.opens_at = body.opens_at;
    if (body.closes_at !== undefined) updates.closes_at = body.closes_at;
    if (typeof body.manually_closed === "boolean") {
      updates.manually_closed = body.manually_closed;
      // Mirror to status if changed
      updates.status = body.manually_closed ? "archived" : "active";
    }
    if ((body as any).status && ["active", "paused", "archived"].includes((body as any).status)) {
      updates.status = (body as any).status;
      if ((body as any).status === "archived") {
        updates.manually_closed = true;
      } else if ((body as any).status === "active") {
        updates.manually_closed = false;
      }
    }
    if (body.theme && typeof body.theme === "object") updates.theme = body.theme;
    const { data: updated, error } = await sb
      .from("events")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/admin", "layout");
    if (updated?.slug) {
      revalidatePath(`/e/${updated.slug}`, "layout");
    }

    return NextResponse.json({ ok: true, event: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${msg}` }, { status: 500 });
  }
}
