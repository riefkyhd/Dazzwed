import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriveClient, resolveDriveTokens } from "@/lib/drive/client";
import { ensureGuestFolder, ensureOriginalsFolder } from "@/lib/drive/folders";
import { generatePhotoFilename } from "@/lib/drive/upload";
import { getEventBySlug } from "@/lib/event-server";
import { eventStatus } from "@/lib/event";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, hashClientIp, verifyTurnstileToken } from "@/lib/rate-limit";
import { getAdaptiveStorageGuard } from "@/lib/drive/health";
import { computeRollCodeFromGuestId } from "@/lib/guest/session";
import { verifyGuestSession } from "@/lib/api/verify-session";
import { CONSENT_VERSION } from "@/constants/consentCopy";

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
      lookId?: string;
      lookVersion?: number;
      presetId?: string;
      captureSource?: "takePhoto" | "videoFrame";
      retakenPresetIds?: string[];
      turnstileToken?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      eventSlug,
      guestId,
      shotId,
      sizeBytes,
      width,
      height,
      source = "inapp",
      isOriginal = false,
      lookId = "disposable-400",
      lookVersion = 1,
      presetId,
      captureSource,
      retakenPresetIds,
    } = body;

    const slugParsed = z.string().min(2).max(63).safeParse(eventSlug);
    const guestIdParsed = z.uuid().safeParse(guestId);
    const shotIdParsed = z.uuid().safeParse(shotId);
    const sizeParsed = z.number().int().positive().max(50 * 1024 * 1024).safeParse(sizeBytes);

    if (!slugParsed.success || !guestIdParsed.success || !shotIdParsed.success || !sizeParsed.success) {
      return NextResponse.json({ error: "Invalid input parameters or file size too large" }, { status: 400 });
    }

    // Session cookie verification: ensure the request comes from the guest who owns the cookie.
    // This is a second identity binding on top of the DB guest-belongs-to-event check below.
    const verifiedGuestId = verifyGuestSession(req, slugParsed.data, guestIdParsed.data);
    if (!verifiedGuestId) {
      return NextResponse.json({ error: "Session mismatch or missing session cookie" }, { status: 403 });
    }

    // Rate limit
    const ip = getClientIp(req);
    const turnstileOk = await verifyTurnstileToken(body.turnstileToken ?? null, ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Human verification failed" }, { status: 403 });
    }

    // Global Google Drive Write Pacer: 2.5 sustained session initializations per second
    // (Translates to ~150 requests/min globally across all guests to respect Google Drive 2-3 writes/sec)
    const globalPacer = await checkRateLimit("global:drive_init_pacer", 150, 60);
    if (!globalPacer.allowed) {
      return NextResponse.json(
        { error: "Upload traffic spike detected. Queued and smoothing out writes." },
        { status: 503, headers: { "Retry-After": "2" } }
      );
    }

    // Rate limit: Per-guest bucket (30 req/min) + Venue WiFi aggregate bucket (300 req/min)
    const guestLimit = await checkRateLimit(`guest:${guestIdParsed.data}`, 30, 60);
    if (!guestLimit.allowed) {
      return NextResponse.json(
        { error: "Too many upload requests for this guest" },
        { status: 429, headers: { "Retry-After": String(guestLimit.retryAfter) } }
      );
    }

    const hashedIp = hashClientIp(ip);
    const ipLimit = await checkRateLimit(`ip:${hashedIp}`, 300, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Venue network upload limit reached. Retrying soon." },
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
    if (event.token_expires_at && new Date() >= new Date(event.token_expires_at)) {
      return NextResponse.json({ error: "Event access window has expired", code: "EVENT_EXPIRED" }, { status: 403 });
    }

    const rootFolderId = event.drive_root_folder_id;
    if (!rootFolderId) {
      return NextResponse.json({ error: "Drive not linked" }, { status: 503 });
    }

    const sb = supabaseAdmin();
    const { data: guest, error: guestErr } = await sb
      .from("guests")
      .select("id, display_name, consent_version, consent_at")
      .eq("id", guestIdParsed.data)
      .eq("event_id", event.id)
      .maybeSingle();

    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Strict consent enforcement: reject if consent missing or outdated
    if (!guest.consent_at || guest.consent_version !== CONSENT_VERSION) {
      return NextResponse.json(
        { error: "Consent required or outdated", code: "CONSENT_REQUIRED" },
        { status: 403 }
      );
    }

    // Initiate Google Drive Resumable Upload Session
    const { refreshToken } = await resolveDriveTokens();
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Google Drive is not connected. Please connect Drive in Admin Settings." },
        { status: 503 }
      );
    }
    const drive = getDriveClient(refreshToken);

    // Ensure per-guest folder exists: `${cleanName} (${rollCode})`
    // Isolates folders even when guests have the same name
    const guestFolderId = await ensureGuestFolder(
      drive,
      rootFolderId,
      guest.id,
      guest.display_name,
    );

    let targetParentFolderId = guestFolderId;
    let shotsUsed = 1;

    if (isOriginal) {
      // Clean original: upload to "originals" subfolder inside guest folder
      targetParentFolderId = await ensureOriginalsFolder(drive, guestFolderId);

      // Verify the parent photo exists
      const { data: existingPhoto } = await sb
        .from("photos")
        .select("id, original_drive_file_id, shots_used:guests(shots_per_guest)")
        .eq("shot_id", shotIdParsed.data)
        .maybeSingle();

      if (!existingPhoto) {
        return NextResponse.json({ error: "Parent photo record not found" }, { status: 404 });
      }

      // If original is already uploaded and recorded, return duplicate immediately
      if (existingPhoto.original_drive_file_id) {
        return NextResponse.json({ ok: true, duplicate: true, driveFileId: existingPhoto.original_drive_file_id });
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

    const rollCode = computeRollCodeFromGuestId(guest.id);
    const baseFilename = generatePhotoFilename(rollCode, shotsUsed);
    const filename = isOriginal ? baseFilename.replace(/\.jpg$/, "_original.jpg") : baseFilename;

    // Get origin for CORS
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://dazzwed.vercel.app";

    // Obtain access token from OAuth2 client
    const { getOAuth2Client } = await import("@/lib/drive/client");
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    let accessToken: string | null = null;
    try {
      const tokenRes = await oauth2Client.getAccessToken();
      accessToken = tokenRes.token ?? null;
    } catch (tokenErr) {
      console.error("Google Drive OAuth token refresh failed (invalid_grant/expired):", tokenErr);
      return NextResponse.json(
        {
          error: "Google Drive authorization expired or revoked. Please reconnect Drive in Admin Settings.",
          code: "DRIVE_AUTH_EXPIRED",
        },
        { status: 503, headers: { "Retry-After": "60" } }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Could not obtain Google Drive access token. Please verify Drive credentials in Admin Settings.",
          code: "DRIVE_AUTH_EXPIRED",
        },
        { status: 503, headers: { "Retry-After": "60" } }
      );
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
      const cleanPresetId = typeof presetId === "string" && presetId.trim().length > 0
        ? presetId.trim().slice(0, 64)
        : (typeof lookId === "string" ? lookId.slice(0, 64) : "disposable-400");
      const cleanSource = captureSource === "takePhoto" ? "takePhoto" : "videoFrame";

      // Update photo record with dimensions & tier for the primary filtered photo
      const { error: updateErr } = await sb
        .from("photos")
        .update({
          width: width || null,
          height: height || null,
          source,
          tier: source === "native" ? "original" : "high",
          filtered: true,
          look_id: lookId,
          look_version: lookVersion,
          preset_id: cleanPresetId,
        })
        .eq("shot_id", shotIdParsed.data);

      if (updateErr) {
        await sb
          .from("photos")
          .update({
            width: width || null,
            height: height || null,
            source,
            tier: source === "native" ? "original" : "high",
            filtered: true,
            look_id: lookId,
            look_version: lookVersion,
          })
          .eq("shot_id", shotIdParsed.data);
      }

      // Non-blocking zero-PII aggregate counter increments (Promise.allSettled fire-and-forget)
      const metricPromises: Promise<unknown>[] = [
        Promise.resolve(
          sb.rpc("increment_event_metric", {
            p_event_id: event.id,
            p_metric_type: "filter_kept",
            p_metric_key: cleanPresetId,
            p_delta: 1,
          })
        ),
        Promise.resolve(
          sb.rpc("increment_event_metric", {
            p_event_id: event.id,
            p_metric_type: "capture_mode",
            p_metric_key: cleanSource,
            p_delta: 1,
          })
        ),
      ];

      if (Array.isArray(retakenPresetIds)) {
        for (const retakenId of retakenPresetIds) {
          if (typeof retakenId === "string" && retakenId.trim().length > 0) {
            metricPromises.push(
              Promise.resolve(
                sb.rpc("increment_event_metric", {
                  p_event_id: event.id,
                  p_metric_type: "filter_retaken",
                  p_metric_key: retakenId.trim().slice(0, 64),
                  p_delta: 1,
                })
              )
            );
          }
        }
      }

      // Fire-and-forget: 0ms added to guest camera upload response
      void Promise.allSettled(metricPromises).catch(() => {});
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
