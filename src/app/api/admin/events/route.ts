import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACTIVE_EVENT_COOKIE } from "@/lib/events/active";
import { generateEventToken } from "@/lib/event-token";
import { generateUniqueEventToken } from "@/lib/event-server";
import { assertEventTenantAccess } from "@/lib/auth/session";

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

  // Resolve caller session: superadmin vs client
  let clientScopeId: string | null = null;
  try {
    const { getAuthSession } = await import("@/lib/auth/session");
    const session = await getAuthSession();
    if (session && session.role === "client") {
      clientScopeId = session.clientId;
    }
  } catch {}

  let query = sb
    .from("events")
    .select("id, slug, couple_names, shots_per_guest, status, package_tier, package_max_guests, package_max_shots_per_guest, drive_root_folder_id, created_at, access_token, client_id");

  if (clientScopeId) {
    query = query.eq("client_id", clientScopeId);
  }

  const { data: events, error } = await query.order("created_at", { ascending: false });

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
    const sb = supabaseAdmin();

    // Resolve caller session: superadmin vs client
    let clientScopeId: string | null = null;
    let clientAllowedMaxEvents = 1;
    let clientPackageTier = "classic_35mm";
    let clientMaxShots = 25;

    try {
      const { getAuthSession } = await import("@/lib/auth/session");
      const session = await getAuthSession();
      if (session && session.role === "client") {
        clientScopeId = session.clientId;
        // Check client's max_events entitlement
        const { data: clientRecord } = await sb
          .from("clients")
          .select("id, max_events, status")
          .eq("id", clientScopeId)
          .maybeSingle();

        if (clientRecord) {
          clientAllowedMaxEvents = clientRecord.max_events || 1;
          const { count } = await sb
            .from("events")
            .select("*", { count: "exact", head: true })
            .eq("client_id", clientScopeId);

          if (count !== null && count >= clientAllowedMaxEvents) {
            return NextResponse.json(
              { error: `You have reached your event limit (${clientAllowedMaxEvents} event). Contact your coordinator to add more rolls.`, code: "CLIENT_MAX_EVENTS_REACHED" },
              { status: 403 }
            );
          }
        }
      }
    } catch {}

    // Auto-generate slug if not provided or clean it
    let slug = (body.slug || coupleNames)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    if (slug.length < 2) {
      slug = `event-${Date.now().toString(36)}`;
    }

    const packageTier = clientScopeId ? clientPackageTier : (body.package_tier || "owner_unlimited");
    const packageMaxShots = clientScopeId ? clientMaxShots : (typeof body.package_max_shots_per_guest === "number" ? body.package_max_shots_per_guest : 100);
    const shotsPerGuest = typeof body.shots_per_guest === "number" ? Math.max(1, Math.min(packageMaxShots, body.shots_per_guest)) : 25;
    const packageMaxGuests = clientScopeId ? 150 : (typeof body.package_max_guests === "number" ? body.package_max_guests : null);
    const status = body.status === "paused" ? "paused" : "active";

    const accessToken = await generateUniqueEventToken();
    const tokenDurationHours = 72;
    const tokenExpiresAt = new Date(Date.now() + tokenDurationHours * 3600 * 1000).toISOString();

    // Check slug uniqueness; if taken, append timestamp
    const { data: existing } = await sb.from("events").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    // Auto-provision Google Drive root folder under the master vault if available
    let driveRootFolderId = body.drive_root_folder_id || null;
    if (!driveRootFolderId) {
      try {
        const { resolveDriveTokens, getDriveClient } = await import("@/lib/drive/client");
        const { refreshToken } = await resolveDriveTokens();
        if (refreshToken) {
          const { createRootFolder } = await import("@/lib/drive/folders");
          const drive = getDriveClient(refreshToken);
          driveRootFolderId = await createRootFolder(drive, coupleNames);
        }
      } catch (driveErr) {
        console.warn("Could not pre-create drive root folder during event creation:", driveErr);
      }
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
        drive_root_folder_id: driveRootFolderId,
        client_id: clientScopeId || (body as any).client_id || null,
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

    const tenantGuard = await assertEventTenantAccess(body.eventId);
    if (!tenantGuard.authorized) {
      return NextResponse.json(
        { error: tenantGuard.error, code: tenantGuard.code },
        { status: tenantGuard.status }
      );
    }

    const event = tenantGuard.event;

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
