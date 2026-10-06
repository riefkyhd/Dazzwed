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
      isOriginal?: boolean;
      turnstileToken?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { eventSlug, guestId, shotId, sizeBytes, width, height, source = "inapp", isOriginal = false } = body;

    const slugParsed = z.string().min(2).max(63).safeParse(eventSlug);
    const guestIdParsed = z.uuid().safeParse(guestId);
    const shotIdParsed = z.uuid().safeParse(shotId);
    const sizeParsed = z.number().int().positive().max(50 * 1024 * 1024).safeParse(sizeBytes);

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

    // Storage guard check (warning at 85%, pause at 98%)
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

    // Initiate Google Drive Resumable Upload Session
    const { refreshToken } = await resolveDriveTokens();
    const drive = getDriveClient(refreshToken || undefined);
    const guestFolderId = await ensureGuestFolder(drive, rootFolderId, guest.id, guest.display_name);

    let targetParentFolderId = guestFolderId;
    let shotsUsed = 1;

    if (isOriginal) {
      // Clean original: upload to "originals" subfolder without reserving another shot slot
      const { ensureOriginalsFolder } = await import("@/lib/drive/folders");
      targetParentFolderId = await ensureOriginalsFolder(drive, guestFolderId);

      // Verify the parent photo exists
      const { data: existingPhoto } = await sb
        .from("photos")
        .select("id, shots_used:guests(shots_per_guest)")
        .eq("shot_id", shotIdParsed.data)
        .maybeSingle();

      if (!existingPhoto) {
        return NextResponse.json({ error: "Parent photo record not found" }, { status: 404 });
      }
    } else {
      // Filtered main photo: Server-side atomic shot reservation
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

      shotsUsed = reservation.shots_used;
    }

    const guestNameOrId = guest.display_name?.trim() || guest.id.slice(0, 8);
    const baseFilename = generatePhotoFilename(guestNameOrId, shotsUsed);
    const filename = isOriginal ? baseFilename.replace(/\.jpg$/, "_original.jpg") : baseFilename;

    // Get origin for CORS
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://dazzwed.vercel.app";

    // Obtain access token from OAuth2 client
    const { getOAuth2Client } = await import("@/lib/drive/client");
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const tokenRes = await oauth2Client.getAccessToken();
    const accessToken = tokenRes.token;

    if (!accessToken) {
      throw new Error("Failed to generate Google Drive access token from refresh token");
    }

    // Request resumable upload session from Google Drive using direct fetch
    const gDriveInitRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "image/jpeg",
        "X-Upload-Content-Length": String(sizeParsed.data),
        Origin: origin,
      },
      body: JSON.stringify({
        name: filename,
        parents: [targetParentFolderId],
      }),
    });

    if (!gDriveInitRes.ok) {
      const errText = await gDriveInitRes.text();
      console.error("Google Drive resumable session initiation failed:", gDriveInitRes.status, errText);
      return NextResponse.json({ error: "Failed to initialize Google Drive session" }, { status: 502 });
    }

    const sessionUri = gDriveInitRes.headers.get("location");
    if (!sessionUri) {
      console.error("Google Drive returned 200/201 but no Location header:", Array.from(gDriveInitRes.headers.entries()));
      return NextResponse.json({ error: "No resumable session Location returned from Drive" }, { status: 502 });
    }

    if (!isOriginal) {
      // Update photo record with dimensions & tier for the primary filtered photo
      await sb
        .from("photos")
        .update({
          width: width || null,
          height: height || null,
          source,
          tier: source === "native" ? "original" : "high",
          filtered: true,
        })
        .eq("shot_id", shotIdParsed.data);
    }

    return NextResponse.json({
      ok: true,
      shotId: shotIdParsed.data,
      sessionUri,
      tier: source === "native" ? "original" : "high",
      shotsUsed,
    });
  } catch (err) {
    console.error("Error in /api/photos/init:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
