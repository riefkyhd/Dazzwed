import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PhotosManagementView } from "@/components/admin/PhotosManagementView";

import { computeRollCodeFromGuestId } from "@/lib/guest/session";
import { getActiveAdminEvent } from "@/lib/events/active";

export const dynamic = "force-dynamic";

export default async function AdminPhotosPage() {
  await requireAdmin();

  const sb = supabaseAdmin();

  // 1. Fetch active event dynamically
  const event = await getActiveAdminEvent();

  if (!event) {
    return <div className="p-8 text-center text-zinc-400">Event not found.</div>;
  }

  // 2. Fetch guests and photos concurrently in parallel
  const [
    { data: guestsData },
    pResult,
  ] = await Promise.all([
    sb
      .from("guests")
      .select("id, display_name, drive_folder_id, created_at, last_seen_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
    sb
      .from("photos")
      .select("id, guest_id, shot_id, drive_file_id, original_drive_file_id, size_bytes, status, created_at, source, tier, look_id, preset_id")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
  ]);

  const guests = (guestsData || []).map((g) => ({
    ...g,
    roll_code: computeRollCodeFromGuestId(g.id),
  }));

  // Fail-safe fallback if preset_id is pending migration
  let photos: any[] = [];
  if (pResult.error) {
    const { data: fallbackPhotos } = await sb
      .from("photos")
      .select("id, guest_id, shot_id, drive_file_id, original_drive_file_id, size_bytes, status, created_at, source, tier, look_id")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });
    photos = fallbackPhotos || [];
  } else {
    photos = pResult.data || [];
  }

  return (
    <PhotosManagementView
      initialGuests={guests || []}
      initialPhotos={(photos as unknown as Array<{
        id: string;
        guest_id: string;
        shot_id: string;
        drive_file_id: string | null;
        original_drive_file_id?: string | null;
        size_bytes: number | null;
        status: "pending" | "confirmed" | "failed" | "hidden";
        created_at: string;
        source?: string;
        tier?: string;
        look_id?: string;
        preset_id?: string | null;
      }>) || []}
      rootFolderId={event.drive_root_folder_id}
      shotsPerGuest={event.shots_per_guest}
      eventSlug={event.slug || "wedding"}
    />
  );
}
