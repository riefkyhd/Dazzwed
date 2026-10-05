import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PhotosManagementView } from "@/components/admin/PhotosManagementView";

export const dynamic = "force-dynamic";

export default async function AdminPhotosPage() {
  await requireAdmin();

  const sb = supabaseAdmin();

  // 1. Fetch active event
  const { data: event } = await sb
    .from("events")
    .select("id, slug, shots_per_guest, drive_root_folder_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!event) {
    return <div className="p-8 text-center text-zinc-400">Event not found.</div>;
  }

  // 2. Fetch guests
  const { data: guests } = await sb
    .from("guests")
    .select("id, display_name, drive_folder_id, created_at, last_seen_at")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  // 3. Fetch photos
  const { data: photos } = await sb
    .from("photos")
    .select("id, guest_id, shot_id, drive_file_id, size_bytes, status, created_at")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  return (
    <PhotosManagementView
      initialGuests={guests || []}
      initialPhotos={(photos as unknown as Array<{
        id: string;
        guest_id: string;
        shot_id: string;
        drive_file_id: string | null;
        size_bytes: number | null;
        status: "pending" | "confirmed" | "failed" | "hidden";
        created_at: string;
      }>) || []}
      rootFolderId={event.drive_root_folder_id}
      shotsPerGuest={event.shots_per_guest}
    />
  );
}
