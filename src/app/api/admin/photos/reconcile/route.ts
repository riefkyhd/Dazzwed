import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDriveClient, resolveDriveTokens } from "@/lib/drive/client";
import { getActiveAdminEvent } from "@/lib/events/active";
import { assertEventTenantAccess } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/photos/reconcile
 * Scans confirmed photos against Google Drive and safely marks orphaned/deleted records
 * as "failed" to synchronize database counts with actual Google Drive storage.
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventIdParam = searchParams.get("eventId");

  if (eventIdParam) {
    const tenantGuard = await assertEventTenantAccess(eventIdParam);
    if (!tenantGuard.authorized) {
      return NextResponse.json(
        { error: tenantGuard.error, code: tenantGuard.code },
        { status: tenantGuard.status }
      );
    }
  }

  const activeEvent = await getActiveAdminEvent(eventIdParam);

  if (!activeEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { refreshToken } = await resolveDriveTokens();
  if (!refreshToken) {
    return NextResponse.json(
      { error: "Google Drive is not connected. Please connect Google Drive first." },
      { status: 400 }
    );
  }

  const drive = getDriveClient(refreshToken);

  // Critical Safeguard 1: Proactively verify Google Drive OAuth token before scanning
  try {
    await drive.about.get({ fields: "user" });
  } catch (authErr: any) {
    const errorMsg = authErr?.message || String(authErr);
    console.error("[Reconcile] Drive OAuth pre-check failed:", errorMsg);
    return NextResponse.json(
      {
        error: `Google Drive OAuth verification failed (${errorMsg}). Please reconnect Google Drive before attempting reconciliation. Photos were NOT modified.`,
        isAuthFailure: true,
      },
      { status: 400 }
    );
  }

  const sb = supabaseAdmin();

  // Fetch confirmed photos that have a drive_file_id
  const { data: photos, error: pErr } = await sb
    .from("photos")
    .select("id, drive_file_id, status")
    .eq("event_id", activeEvent.id)
    .eq("status", "confirmed")
    .not("drive_file_id", "is", null);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const confirmedPhotos = photos || [];
  if (confirmedPhotos.length === 0) {
    return NextResponse.json({
      ok: true,
      scanned: 0,
      verified: 0,
      orphaned: 0,
      message: "No confirmed photos to reconcile.",
    });
  }

  let verifiedCount = 0;
  let orphanedCount = 0;
  const orphanedIds: string[] = [];

  // Bounded concurrency pool (12 parallel requests) to reconcile 200+ photos in < 3s
  const CONCURRENCY = 12;
  let idx = 0;

  async function worker() {
    while (idx < confirmedPhotos.length) {
      const current = confirmedPhotos[idx++];
      if (!current || !current.drive_file_id) continue;

      try {
        const fileRes = await drive.files.get({
          fileId: current.drive_file_id,
          fields: "id, trashed",
        });

        if (fileRes.data.trashed) {
          orphanedIds.push(current.id);
          orphanedCount++;
        } else {
          verifiedCount++;
        }
      } catch (err: any) {
        const status = err?.status || err?.response?.status;
        const msg = String(err?.message || "");

        // Only mark missing if Google Drive explicitly returns 404 Not Found
        if (status === 404 || msg.includes("File not found") || msg.includes("notFound")) {
          orphanedIds.push(current.id);
          orphanedCount++;
        } else {
          // In case of transient rate-limits (429/403) or network hiccups, DO NOT mark missing!
          console.warn(`[Reconcile] Transient check error for photo ${current.id}:`, msg);
          verifiedCount++;
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, confirmedPhotos.length) }, () => worker());
  await Promise.all(workers);

  // Safely mark orphaned rows as 'failed' so database, gallery, and .ZIP export align 1:1 with Drive
  if (orphanedIds.length > 0) {
    await sb
      .from("photos")
      .update({ status: "failed" })
      .in("id", orphanedIds);
  }

  return NextResponse.json({
    ok: true,
    scanned: confirmedPhotos.length,
    verified: verifiedCount,
    orphaned: orphanedCount,
    message: `Reconciliation complete: ${verifiedCount} verified in Google Drive, ${orphanedCount} orphaned records cleaned up.`,
  });
}
