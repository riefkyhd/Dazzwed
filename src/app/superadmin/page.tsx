import React from "react";
import { requireSuperadmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkDriveHealth } from "@/lib/drive/health";
import { SuperadminView } from "@/components/superadmin/SuperadminView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperadminPage() {
  const superadmin = await requireSuperadmin();
  const sb = supabaseAdmin();

  // Check Drive integration health concurrently
  const driveHealth = await checkDriveHealth().catch(() => null);

  // Fetch clients, events, and metrics
  let clients: any[] = [];
  let events: any[] = [];

  try {
    const { data: clientsData } = await sb
      .from("clients")
      .select("id, name, email, access_code, max_events, status, notes, created_at")
      .order("created_at", { ascending: false });
    clients = clientsData || [];
  } catch (err) {
    console.error("Failed to fetch clients (table might be pending migration):", err);
  }

  try {
    const { data: eventsData } = await sb
      .from("events")
      .select("id, slug, couple_names, shots_per_guest, status, package_tier, package_max_guests, package_max_shots_per_guest, client_id, drive_root_folder_id, access_token, created_at")
      .order("created_at", { ascending: false });
    events = eventsData || [];
  } catch (err) {
    console.error("Failed to fetch events:", err);
  }

  // Fetch photo counts per event
  const photoCountByEvent: Record<string, number> = {};
  try {
    const { data: photos } = await sb.from("photos").select("event_id");
    if (photos) {
      for (const p of photos) {
        if (p.event_id) {
          photoCountByEvent[p.event_id] = (photoCountByEvent[p.event_id] || 0) + 1;
        }
      }
    }
  } catch {}

  // Fetch guest counts per event
  const guestCountByEvent: Record<string, number> = {};
  try {
    const { data: guests } = await sb.from("guests").select("event_id");
    if (guests) {
      for (const g of guests) {
        if (g.event_id) {
          guestCountByEvent[g.event_id] = (guestCountByEvent[g.event_id] || 0) + 1;
        }
      }
    }
  } catch {}

  // Enrich events with photo and guest counts
  const enrichedEvents = events.map((ev) => ({
    ...ev,
    photo_count: photoCountByEvent[ev.id] || 0,
    guest_count: guestCountByEvent[ev.id] || 0,
  }));

  // Group events by client
  const clientsWithEvents = clients.map((c) => ({
    ...c,
    events: enrichedEvents.filter((e) => e.client_id === c.id),
  }));

  const unassignedEvents = enrichedEvents.filter((e) => !e.client_id);

  return (
    <div className="min-h-screen bg-[#0C0A09] text-zinc-100 font-sans selection:bg-amber-400 selection:text-black">
      <SuperadminView
        ownerEmail={superadmin.email}
        initialClients={clientsWithEvents}
        initialUnassignedEvents={unassignedEvents}
        allEvents={enrichedEvents}
        driveHealth={driveHealth}
      />
    </div>
  );
}
