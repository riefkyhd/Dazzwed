import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DashboardView } from "@/components/admin/DashboardView";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const sb = supabaseAdmin();

  // 1. Fetch active event
  const { data: event } = await sb
    .from("events")
    .select("id, slug, couple_names, shots_per_guest, opens_at, closes_at, manually_closed, drive_root_folder_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-zinc-400">
        No event found in the database. Please initialize the database migration first.
      </div>
    );
  }

  // 2. Fetch guests count
  const { count: guestsCount } = await sb
    .from("guests")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id);

  // 3. Fetch photos metrics
  const { data: allPhotos } = await sb
    .from("photos")
    .select("id, status, size_bytes")
    .eq("event_id", event.id);

  const confirmedCount = (allPhotos || []).filter((p) => p.status === "confirmed").length;
  const failedCount = (allPhotos || []).filter((p) => p.status === "failed").length;
  const pendingCount = (allPhotos || []).filter((p) => p.status === "pending").length;
  const totalSizeBytes = (allPhotos || []).reduce(
    (acc, p) => acc + (p.size_bytes || 0),
    0,
  );

  // 4. Fetch recent photos with guest display names
  const { data: recentRaw } = await sb
    .from("photos")
    .select("id, shot_id, status, size_bytes, created_at, guest_id, guests(display_name)")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false })
    .limit(5);

  interface RawPhotoItem {
    id: string;
    shot_id: string;
    status: string;
    size_bytes: number | null;
    created_at: string;
    guest_id: string;
    guests?: { display_name?: string | null } | null;
  }

  const recentPhotos = (recentRaw as unknown as RawPhotoItem[] || []).map((r) => ({
    id: r.id,
    guestName: r.guests?.display_name || `Guest (${r.guest_id.slice(0, 6)})`,
    shot_id: r.shot_id,
    status: r.status,
    size_bytes: r.size_bytes,
    created_at: r.created_at,
  }));

  return (
    <DashboardView
      event={event}
      metrics={{
        totalGuests: guestsCount || 0,
        confirmedCount,
        failedCount,
        pendingCount,
        totalSizeBytes,
      }}
      recentPhotos={recentPhotos}
    />
  );
}
