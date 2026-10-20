import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/superadmin/events
 * Platform Owner locked overrides: package_tier, package_max_guests, package_max_shots_per_guest, client_id, dual_master
 */
export async function PATCH(req: Request) {
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized: Superadmin only" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      eventId?: string;
      clientId?: string | null;
      packageTier?: "pocket_roll" | "classic_35mm" | "grand_archive" | "owner_unlimited";
      packageMaxGuests?: number | null;
      packageMaxShotsPerGuest?: number;
      shotsPerGuest?: number;
      status?: "active" | "paused" | "archived";
      dualMasterEnabled?: boolean;
    };

    if (!body.eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.clientId !== undefined) updates.client_id = body.clientId;
    if (body.packageTier) updates.package_tier = body.packageTier;
    if (body.packageMaxGuests !== undefined) updates.package_max_guests = body.packageMaxGuests;
    if (typeof body.packageMaxShotsPerGuest === "number") updates.package_max_shots_per_guest = body.packageMaxShotsPerGuest;
    if (typeof body.shotsPerGuest === "number") updates.shots_per_guest = body.shotsPerGuest;
    if (body.status) {
      updates.status = body.status;
      updates.manually_closed = body.status === "archived";
    }
    if (typeof body.dualMasterEnabled === "boolean") updates.dual_master_enabled = body.dualMasterEnabled;

    const sb = supabaseAdmin();
    const { data: updated, error } = await sb
      .from("events")
      .update(updates)
      .eq("id", body.eventId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
