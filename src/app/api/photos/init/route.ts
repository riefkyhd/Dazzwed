import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriveClient, resolveDriveTokens } from "@/lib/drive/client";
import { ensureGuestFolder } from "@/lib/drive/folders";
import { generatePhotoFilename } from "@/lib/drive/upload";
import { getEventBySlug } from "@/lib/event-server";
import { eventStatus } from "@/lib/event";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, verifyTurnstileToken } from "@/lib/rate-limit";
import { getAdaptiveStorageGuard } from "@/lib/drive/health";

export const dynamic = "force-dynamic";

interface ReserveResult {
  outcome: "reserved" | "duplicate" | "limit_reached" | "not_found";
  photo_id: string | null;
  status: string | null;
  drive_file_id: string | null;
  shots_used: number;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      eventSlug?: string;
      guestId?: string;
      shotId?: string;
      sizeBytes?: number;
      width?: number;
      height?: number;
      source?: "inapp" | "native";
      turnstileToken?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { eventSlug, guestId, shotId, sizeBytes, width, height, source = "inapp" } = body;

    const slugParsed = z.string().min(2).max(63).safeParse(eventSlug);
    const guestIdParsed = z.uuid().safeParse(guestId);
    const shotIdParsed = z.uuid().safeParse(shotId);
    const sizeParsed = z.number().int().positive().max(25 * 1024 * 1024).safeParse(sizeBytes);

    if (!slugParsed.success || !guestIdParsed.success || !shotIdParsed.success || !sizeParsed.success) {
      return NextResponse.json({ error: "Invalid input parameters or file size too large" }, { status: 400 });
    }

    // Rate limit
    const ip = getClientIp(req);
    const turnstileOk = await verifyTurnstileToken(body.turnstileToken ?? null, ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Human verification failed" }, { status: 403 });
    }

    const ipLimit = await checkRateLimit(`ip:${ip}`, 60, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many upload requests" },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
      );
    }

    // Adaptive storage guard
    const guard = await getAdaptiveStorageGuard();
    if (!guard.allowed) {
      return NextResponse.json(
        { error: guard.message || "Storage quota full" },
        { status: 507 }
      );
    }

    // Event lookup
    const event = await getEventBySlug(slugParsed.data);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (eventStatus(event) !== "open") {
      return NextResponse.json({ error: "Event is closed for photos" }, { status: 403 });
    }

    const rootFolderId = event.drive_root_folder_id;
    if (!rootFolderId) {
      return NextResponse.json({ error: "Drive not linked" }, { status: 503 });
    }

    const sb = supabaseAdmin();
    const { data: guest } = await sb
      .from("guests")
      .select("id, display_name")
      .eq("id", guestIdParsed.data)
      .eq("event_id", event.id)
      .maybeSingle();

    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

    // Server-side atomic shot reservation
    const { data: reserveRows, error: reserveErr } = await sb.rpc("reserve_shot", {
      p_event_id: event.id,
      p_guest_id: guest.id,
      p_shot_id: shotIdParsed.data,
    });

    if (reserveErr || !reserveRows || reserveRows.length === 0) {
      return NextResponse.json({ error: "Failed to reserve shot" }, { status: 500 });
    }

    const reservation = reserveRows[0] as ReserveResult;
    if (reservation.outcome === "limit_reached") {
      return NextResponse.json({ error: "Shot limit reached", shotsUsed: reservation.shots_used }, { status: 403 });
    }
    if (reservation.outcome === "not_found") {
      return NextResponse.json({ error: "Guest/event not found" }, { status: 404 });
    }
    if (reservation.outcome === "duplicate" && reservation.status === "confirmed" && reservation.drive_file_id) {
      return NextResponse.json({ ok: true, duplicate: true, driveFileId: reservation.drive_file_id });
    }

    // Initiate Google Drive Resumable Upload Session
    const { refreshToken } = await resolveDriveTokens();
    const drive = getDriveClient(refreshToken || undefined);
    const guestFolderId = await ensureGuestFolder(drive, rootFolderId, guest.id, guest.display_name);

    const guestNameOrId = guest.display_name?.trim() || guest.id.slice(0, 8);
    const filename = generatePhotoFilename(guestNameOrId, reservation.shots_used);

    // Get origin for CORS
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://dazzwed.vercel.app";

    // Request resumable upload session from Google Drive
    const sessionRes = await (drive.files.create as any)({
      requestBody: {
        name: filename,
        parents: [guestFolderId],
      },
      media: {
        mimeType: "image/jpeg",
      },
      uploadType: "resumable",
      headers: {
        Origin: origin,
        "X-Upload-Content-Type": "image/jpeg",
        "X-Upload-Content-Length": String(sizeParsed.data),
      },
    });

    const sessionUri = sessionRes.headers?.location || sessionRes.data?.location;

    // Update photo record with dimensions & tier
    await sb
      .from("photos")
      .update({
        width: width || null,
        height: height || null,
        source,
        tier: guard.tier,
      })
      .eq("shot_id", shotIdParsed.data);

    return NextResponse.json({
      ok: true,
      shotId: shotIdParsed.data,
      sessionUri,
      tier: guard.tier,
      shotsUsed: reservation.shots_used,
    });
  } catch (err) {
    console.error("Error in /api/photos/init:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
