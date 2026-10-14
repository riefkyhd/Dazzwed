import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriveClient, resolveDriveTokens } from "@/lib/drive/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyGuestSession } from "@/lib/api/verify-session";
import { checkRateLimit, getClientIp, hashClientIp } from "@/lib/rate-limit";
import { CONSENT_VERSION } from "@/constants/consentCopy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      shotId?: string;
      driveFileId?: string;
      sizeBytes?: number;
      isOriginal?: boolean;
      guestId?: string;
      eventSlug?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { shotId, driveFileId, sizeBytes, isOriginal = false, guestId, eventSlug } = body;
    const shotIdParsed = z.uuid().safeParse(shotId);
    const driveFileIdParsed = z.string().min(5).safeParse(driveFileId);

    if (!shotIdParsed.success || !driveFileIdParsed.success) {
      return NextResponse.json({ error: "Invalid shotId or driveFileId" }, { status: 400 });
    }

    const ip = getClientIp(req);
    const hashedIp = hashClientIp(ip);
    const ipLimit = await checkRateLimit(`ip:${hashedIp}`, 120, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many confirm requests from this network" },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
      );
    }

    let verifiedGuestId: string | null = null;
    if (guestId && eventSlug) {
      const guestIdParsed = z.uuid().safeParse(guestId);
      const slugParsed = z.string().min(2).max(63).safeParse(eventSlug);
      if (guestIdParsed.success && slugParsed.success) {
        verifiedGuestId = verifyGuestSession(req, slugParsed.data, guestIdParsed.data);
        if (!verifiedGuestId) {
          return NextResponse.json({ error: "Session mismatch or missing session cookie" }, { status: 403 });
        }
      }
    }

    const sb = supabaseAdmin();

    // Verify photo record and consent
    const { data: photoRecord } = await sb
      .from("photos")
      .select("id, guest_id, guests(consent_version, consent_at)")
      .eq("shot_id", shotIdParsed.data)
      .maybeSingle();

    if (!photoRecord) {
      return NextResponse.json({ error: "Photo record not found" }, { status: 404 });
    }

    const guestConsent = Array.isArray(photoRecord.guests) ? photoRecord.guests[0] : photoRecord.guests;
    if (!guestConsent?.consent_at || guestConsent.consent_version !== CONSENT_VERSION) {
      return NextResponse.json(
        { error: "Consent required or outdated", code: "CONSENT_REQUIRED" },
        { status: 403 }
      );
    }

    // Verify file exists in Google Drive
    const { refreshToken } = await resolveDriveTokens();
    const drive = getDriveClient(refreshToken || undefined);

    const fileMeta = await drive.files.get({
      fileId: driveFileIdParsed.data,
      fields: "id, name, size, mimeType, trashed, parents",
    });

    if (!fileMeta.data.id || fileMeta.data.trashed) {
      return NextResponse.json({ error: "Drive file not found or trashed" }, { status: 404 });
    }

    // Verify MIME type is image/jpeg
    if (fileMeta.data.mimeType && !fileMeta.data.mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type in storage" }, { status: 400 });
    }

    const actualSize = fileMeta.data.size ? parseInt(fileMeta.data.size, 10) : sizeBytes || 0;
    if (actualSize <= 0 || actualSize > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Invalid file size recorded" }, { status: 400 });
    }

    if (isOriginal) {
      // Update original_drive_file_id on the existing photo
      let query = sb
        .from("photos")
        .update({
          original_drive_file_id: fileMeta.data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("shot_id", shotIdParsed.data);

      if (verifiedGuestId) {
        query = query.eq("guest_id", verifiedGuestId);
      }

      const { error: updateErr } = await query;

      if (updateErr) {
        return NextResponse.json({ error: "Failed to link original photo in DB" }, { status: 500 });
      }
    } else {
      // Mark primary filtered photo confirmed in database
      let query = sb
        .from("photos")
        .update({
          status: "confirmed",
          drive_file_id: fileMeta.data.id,
          size_bytes: actualSize,
          updated_at: new Date().toISOString(),
        })
        .eq("shot_id", shotIdParsed.data);

      if (verifiedGuestId) {
        query = query.eq("guest_id", verifiedGuestId);
      }

      const { error: updateErr } = await query;

      if (updateErr) {
        return NextResponse.json({ error: "Failed to confirm photo in DB" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      status: "confirmed",
      driveFileId: fileMeta.data.id,
      sizeBytes: actualSize,
    });
  } catch (err) {
    console.error("Error in /api/photos/confirm:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
