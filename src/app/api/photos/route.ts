import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriveClient, resolveDriveTokens } from "@/lib/drive/client";
import { ensureGuestFolder } from "@/lib/drive/folders";
import { uploadPhotoToDrive } from "@/lib/drive/upload";
import { getEventBySlug } from "@/lib/event-server";
import { eventStatus } from "@/lib/event";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, verifyTurnstileToken } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB hard cap (Vercel body limit is ~4.5 MB)

interface ReserveResult {
  outcome: "reserved" | "duplicate" | "limit_reached" | "not_found";
  photo_id: string | null;
  status: string | null;
  drive_file_id: string | null;
  shots_used: number;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    const guestIdRaw = formData.get("guestId");
    const eventSlugRaw = formData.get("eventSlug");
    const shotIdRaw = formData.get("shotId");

    // 1. Basic field validation
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing or invalid file field" }, { status: 400 });
    }

    const guestIdParsed = z.uuid().safeParse(guestIdRaw);
    const shotIdParsed = z.uuid().safeParse(shotIdRaw);
    const slugParsed = z.string().min(2).max(63).safeParse(eventSlugRaw);

    if (!guestIdParsed.success || !shotIdParsed.success || !slugParsed.success) {
      return NextResponse.json({ error: "Invalid guestId, shotId, or eventSlug" }, { status: 400 });
    }

    const guestId = guestIdParsed.data;
    const shotId = shotIdParsed.data;
    const eventSlug = slugParsed.data;

    // Rate limiting & Turnstile protection
    const ip = getClientIp(req);
    const turnstileToken = formData.get("turnstileToken");
    const turnstileOk = await verifyTurnstileToken(
      typeof turnstileToken === "string" ? turnstileToken : null,
      ip,
    );
    if (!turnstileOk) {
      return NextResponse.json({ error: "Human verification failed" }, { status: 403 });
    }

    const ipLimit = await checkRateLimit(`ip:${ip}`, 60, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many upload requests from this network" },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
      );
    }

    const guestLimit = await checkRateLimit(`guest:${guestId}`, 30, 60);
    if (!guestLimit.allowed) {
      return NextResponse.json(
        { error: "Too many upload attempts for this guest" },
        { status: 429, headers: { "Retry-After": String(guestLimit.retryAfter) } },
      );
    }

    // 2. MIME type & size check
    if (file.type !== "image/jpeg") {
      return NextResponse.json({ error: "Only image/jpeg is allowed" }, { status: 415 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 3 MB limit" }, { status: 413 });
    }

    // 3. Event lookup and open window validation
    const event = await getEventBySlug(eventSlug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const status = eventStatus(event);
    if (status !== "open") {
      return NextResponse.json({ error: "Event is closed for photos", status }, { status: 403 });
    }

    const rootFolderId = event.drive_root_folder_id;
    if (!rootFolderId) {
      return NextResponse.json(
        { error: "Google Drive is not linked to this event yet" },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }

    const sb = supabaseAdmin();

    // 4. Verify guest belongs to this event
    const { data: guest, error: guestErr } = await sb
      .from("guests")
      .select("id, display_name, drive_folder_id")
      .eq("id", guestId)
      .eq("event_id", event.id)
      .maybeSingle();

    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found for this event" }, { status: 404 });
    }

    // 5. Server-side atomic shot reservation
    const { data: reserveRows, error: reserveErr } = await sb.rpc("reserve_shot", {
      p_event_id: event.id,
      p_guest_id: guest.id,
      p_shot_id: shotId,
    });

    if (reserveErr || !reserveRows || reserveRows.length === 0) {
      console.error("reserve_shot RPC error:", reserveErr);
      return NextResponse.json({ error: "Failed to reserve shot" }, { status: 500 });
    }

    const reservation = reserveRows[0] as ReserveResult;

    if (reservation.outcome === "limit_reached") {
      return NextResponse.json(
        { error: "Shot limit reached", shotsUsed: reservation.shots_used },
        { status: 403 },
      );
    }

    if (reservation.outcome === "not_found") {
      return NextResponse.json({ error: "Guest or event not found" }, { status: 404 });
    }

    // Idempotency: if duplicate and already confirmed in Drive, return existing file ID
    if (reservation.outcome === "duplicate" && reservation.status === "confirmed" && reservation.drive_file_id) {
      return NextResponse.json({
        ok: true,
        status: "confirmed",
        driveFileId: reservation.drive_file_id,
        duplicate: true,
      });
    }

    // 6. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 7. Upload to Google Drive into per-guest folder
    let drive;
    try {
      const { refreshToken } = await resolveDriveTokens();
      drive = getDriveClient(refreshToken || undefined);
    } catch (e) {
      // Missing refresh token or Drive config -> release reservation and 503
      await sb.rpc("release_shot", { p_shot_id: shotId });
      return NextResponse.json(
        { error: "Drive client unavailable", details: String(e) },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }

    try {
      // Ensure per-guest subfolder exists
      const guestFolderId = await ensureGuestFolder(
        drive,
        rootFolderId,
        guest.id,
        guest.display_name,
      );

      const guestNameOrId = guest.display_name?.trim() || guest.id.slice(0, 8);
      const uploadRes = await uploadPhotoToDrive({
        drive,
        folderId: guestFolderId,
        fileBuffer,
        guestNameOrShortId: guestNameOrId,
        shotNumber: reservation.shots_used,
      });

      // 8. Mark reservation as confirmed in database
      await sb
        .from("photos")
        .update({
          status: "confirmed",
          drive_file_id: uploadRes.driveFileId,
          size_bytes: uploadRes.sizeBytes,
          updated_at: new Date().toISOString(),
        })
        .eq("shot_id", shotId);

      return NextResponse.json({
        ok: true,
        status: "confirmed",
        photoId: reservation.photo_id,
        driveFileId: uploadRes.driveFileId,
        shotsUsed: reservation.shots_used,
      });
    } catch (uploadError) {
      console.error("Google Drive upload error:", uploadError);

      // Release the pending reservation so the guest is not penalized for a failed upload
      await sb.rpc("release_shot", { p_shot_id: shotId });

      return NextResponse.json(
        { error: "Upload to storage failed, please retry" },
        { status: 503, headers: { "Retry-After": "3" } },
      );
    }
  } catch (err) {
    console.error("Unhandled error in /api/photos:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
