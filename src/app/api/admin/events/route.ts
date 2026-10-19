import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACTIVE_EVENT_COOKIE } from "@/lib/events/active";
import { generateEventToken } from "@/lib/event-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/events
 * List all events for the switcher
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: events, error } = await sb
    .from("events")
    .select("id, slug, couple_names, shots_per_guest, status, package_tier, package_max_guests, package_max_shots_per_guest, drive_root_folder_id, created_at, access_token")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, events });
}

/**
 * POST /api/admin/events
 * Create a new event with isolated slug, access token, and status
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      couple_names?: string;
      slug?: string;
      shots_per_guest?: number;
      package_tier?: string;
      package_max_guests?: number | null;
      package_max_shots_per_guest?: number;
      status?: "active" | "paused";
      drive_root_folder_id?: string | null;
    };

    if (!body.couple_names || typeof body.couple_names !== "string" || !body.couple_names.trim()) {
      return NextResponse.json({ error: "Couple / Event name is required" }, { status: 400 });
    }

    const coupleNames = body.couple_names.trim();
    // Auto-generate slug if not provided or clean it
    let slug = (body.slug || coupleNames)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    if (slug.length < 2) {
      slug = `event-${Date.now().toString(36)}`;
    }

    const shotsPerGuest = typeof body.shots_per_guest === "number" ? Math.max(1, Math.min(100, body.shots_per_guest)) : 25;
    const packageTier = body.package_tier || "owner_unlimited";
    const packageMaxShots = typeof body.package_max_shots_per_guest === "number" ? body.package_max_shots_per_guest : 100;
    const packageMaxGuests = typeof body.package_max_guests === "number" ? body.package_max_guests : null;
    const status = body.status === "paused" ? "paused" : "active";

    const accessToken = generateEventToken();
    const tokenDurationHours = 72;
    const tokenExpiresAt = new Date(Date.now() + tokenDurationHours * 3600 * 1000).toISOString();

    const sb = supabaseAdmin();

    // Check slug uniqueness; if taken, append timestamp
    const { data: existing } = await sb.from("events").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const { data: newEvent, error } = await sb
      .from("events")
      .insert({
        couple_names: coupleNames,
        slug,
        shots_per_guest: Math.min(shotsPerGuest, packageMaxShots),
        status,
        package_tier: packageTier,
        package_max_guests: packageMaxGuests,
        package_max_shots_per_guest: packageMaxShots,
        dual_master_enabled: true,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        token_duration_hours: tokenDurationHours,
        drive_root_folder_id: body.drive_root_folder_id || null,
        theme: {
          accentColor: "#f59e0b",
          accentFg: "#000000",
          bgColor: "#09090b",
        },
      })
      .select()
      .single();

    if (error || !newEvent) {
      return NextResponse.json({ error: error?.message || "Failed to create event" }, { status: 500 });
    }

    // Set active event cookie to the newly created event
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_EVENT_COOKIE, newEvent.id, {
      path: "/",
      maxAge: 30 * 24 * 3600,
      httpOnly: false,
      sameSite: "lax",
    });

    revalidatePath("/admin", "layout");

    return NextResponse.json({ ok: true, event: newEvent });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Creation failed: ${msg}` }, { status: 500 });
  }
}

/**
 * PUT /api/admin/events
 * Switch active event by setting the cookie
 */
export async function PUT(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { eventId?: string };
    if (!body.eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.eventId)) {
      return NextResponse.json({ error: "Valid eventId is required" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: event } = await sb.from("events").select("id, slug, couple_names").eq("id", body.eventId).maybeSingle();
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_EVENT_COOKIE, event.id, {
      path: "/",
      maxAge: 30 * 24 * 3600,
      httpOnly: false,
      sameSite: "lax",
    });

    revalidatePath("/admin", "layout");

    return NextResponse.json({ ok: true, activeEventId: event.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Switch failed: ${msg}` }, { status: 500 });
  }
}
