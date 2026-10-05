import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status"); // all | confirmed | hidden | failed | pending

  const sb = supabaseAdmin();

  // 1. Fetch guests with counts
  const { data: guests, error: guestsErr } = await sb
    .from("guests")
    .select("id, display_name, drive_folder_id, created_at, last_seen_at")
    .order("created_at", { ascending: false });

  if (guestsErr) {
    return NextResponse.json({ error: guestsErr.message }, { status: 500 });
  }

  // 2. Fetch photos
  let photosQuery = sb
    .from("photos")
    .select("id, guest_id, shot_id, drive_file_id, size_bytes, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    photosQuery = photosQuery.eq("status", statusFilter);
  }

  const { data: photos, error: photosErr } = await photosQuery;
  if (photosErr) {
    return NextResponse.json({ error: photosErr.message }, { status: 500 });
  }

  // 3. Compute metrics
  const { data: allPhotos, error: allErr } = await sb
    .from("photos")
    .select("status, size_bytes");

  if (allErr) {
    return NextResponse.json({ error: allErr.message }, { status: 500 });
  }

  const confirmedCount = (allPhotos || []).filter((p) => p.status === "confirmed").length;
  const hiddenCount = (allPhotos || []).filter((p) => p.status === "hidden").length;
  const failedCount = (allPhotos || []).filter((p) => p.status === "failed").length;
  const pendingCount = (allPhotos || []).filter((p) => p.status === "pending").length;
  const totalSizeBytes = (allPhotos || []).reduce(
    (acc, p) => acc + (p.size_bytes || 0),
    0,
  );

  return NextResponse.json({
    metrics: {
      totalGuests: guests?.length || 0,
      confirmedCount,
      hiddenCount,
      failedCount,
      pendingCount,
      totalSizeBytes,
      driveQuotaLimitBytes: 15 * 1024 * 1024 * 1024, // 15 GB
    },
    guests: guests || [],
    photos: photos || [],
  });
}
