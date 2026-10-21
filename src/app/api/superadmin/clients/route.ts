import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashClientPassword } from "@/lib/auth/session";
import { generateEventToken } from "@/lib/event-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/superadmin/clients
 * Lists all client accounts with their assigned events
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  try {
    const { data: clients, error: cErr } = await sb
      .from("clients")
      .select("id, name, email, access_code, max_events, status, notes, created_at")
      .order("created_at", { ascending: false });

    if (cErr) {
      // Table might be pending migration
      return NextResponse.json({ ok: true, clients: [] });
    }

    const { data: events } = await sb
      .from("events")
      .select("id, slug, couple_names, shots_per_guest, status, package_tier, package_max_guests, package_max_shots_per_guest, client_id, drive_root_folder_id, access_token");

    // Group events by client_id
    const clientsWithEvents = (clients || []).map((c) => ({
      ...c,
      events: (events || []).filter((e) => (e as any).client_id === c.id),
    }));

    // Find unassigned events
    const unassignedEvents = (events || []).filter((e) => !(e as any).client_id);

    return NextResponse.json({
      ok: true,
      clients: clientsWithEvents,
      unassignedEvents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/clients
 * Create a new Client account
 */
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
      access_code?: string;
      max_events?: number;
      notes?: string;
    };

    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const accessCode = (body.access_code?.trim() || generateEventToken()).toUpperCase().slice(0, 10);
    const password = body.password?.trim() || accessCode;
    const passwordHash = hashClientPassword(password);
    const maxEvents = typeof body.max_events === "number" ? Math.max(1, body.max_events) : 1;

    const sb = supabaseAdmin();
    const { data: client, error } = await sb
      .from("clients")
      .insert({
        name: body.name.trim(),
        email,
        access_code: accessCode,
        password_hash: passwordHash,
        max_events: maxEvents,
        status: "active",
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error || !client) {
      return NextResponse.json({ error: error?.message || "Failed to create client" }, { status: 500 });
    }

    // Auto-provision initial Event Roll if requested (default: true)
    let starterEvent: any = null;
    const shouldCreateStarter = (body as any).createStarterEvent !== false;
    if (shouldCreateStarter) {
      const cleanSlugBase = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const starterSlug = `${cleanSlugBase || "event"}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: createdEvent } = await sb
        .from("events")
        .insert({
          slug: starterSlug,
          couple_names: `${body.name.trim()}'s Wedding`,
          shots_per_guest: 27,
          status: "active",
          package_tier: "classic_35mm",
          package_max_guests: 300,
          package_max_shots_per_guest: 27,
          dual_master_enabled: true,
          client_id: client.id,
          access_token: generateEventToken(),
          token_duration_hours: 72,
        })
        .select()
        .maybeSingle();
      starterEvent = createdEvent;
    }

    return NextResponse.json({
      ok: true,
      client,
      starterEvent,
      generatedPassword: password,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/superadmin/clients
 * Update client status (e.g. suspension), max_events, or reset password/access code
 */
export async function PATCH(req: Request) {
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      id?: string;
      status?: "active" | "suspended";
      max_events?: number;
      name?: string;
      resetPassword?: string;
      notes?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Client ID required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.status) updates.status = body.status;
    if (typeof body.max_events === "number") updates.max_events = Math.max(1, body.max_events);
    if (body.name?.trim()) updates.name = body.name.trim();
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.resetPassword) {
      const code = body.resetPassword.trim().toUpperCase().slice(0, 10);
      updates.access_code = code;
      updates.password_hash = hashClientPassword(code);
    }

    const sb = supabaseAdmin();
    const { data: updated, error } = await sb
      .from("clients")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, client: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
