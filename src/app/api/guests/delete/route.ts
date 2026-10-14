import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventBySlug } from "@/lib/event-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDriveClient, resolveDriveTokens } from "@/lib/drive/client";
import { verifyGuestSession } from "@/lib/api/verify-session";
import { computeRollCodeFromGuestId, normalizeRollCode } from "@/lib/guest/session";
import { checkRateLimit, getClientIp, hashClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventSlug: z.string().min(2).max(63),
  guestId: z.uuid(),
  rollCode: z.string().optional(),
});

const cookieName = (slug: string) => `dc_g_${slug}`;

/**
 * Erasure endpoint (UU PDP Right to Erasure):
 * Permanently erases the guest's roll from Google Drive and Supabase, and clears the session cookie.
 * Drive deletion is resilient: if Drive folder was already deleted or fails, Supabase wipe and cookie clear still succeed.
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { eventSlug, guestId, rollCode } = parsed.data;

    // Rate limit delete attempts
    const ip = getClientIp(req);
    const hashedIp = hashClientIp(ip);
    const limit = await checkRateLimit(`guest_delete:${hashedIp}`, 10, 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests, please wait" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    // Verify session cookie matches guestId
    const verifiedGuestId = verifyGuestSession(req, eventSlug, guestId);
    if (!verifiedGuestId) {
      return NextResponse.json(
        { error: "Session mismatch or missing session cookie" },
        { status: 403 }
      );
    }

    const ev = await getEventBySlug(eventSlug);
    if (!ev) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const sb = supabaseAdmin();
    const { data: guest, error: guestErr } = await sb
      .from("guests")
      .select("id, drive_folder_id")
      .eq("id", guestId)
      .eq("event_id", ev.id)
      .maybeSingle();

    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // If rollCode was provided, verify it matches
    if (rollCode) {
      const derivedCode = computeRollCodeFromGuestId(guest.id);
      if (normalizeRollCode(rollCode) !== derivedCode) {
        return NextResponse.json({ error: "Invalid roll code" }, { status: 403 });
      }
    }

    // 1. Resilient Google Drive Folder Deletion (deletes folder and all contained child photos in 1 call)
    if (guest.drive_folder_id) {
      try {
        const { refreshToken } = await resolveDriveTokens();
        if (refreshToken) {
          const drive = getDriveClient(refreshToken);
          await drive.files.delete({ fileId: guest.drive_folder_id });
        }
      } catch (driveErr) {
        console.warn("Drive folder deletion non-fatal error:", driveErr);
        // Resilient: do NOT fail or block deleting DB records and clearing cookies
      }
    }

    // 2. Delete all photos for this guest from Supabase
    await sb.from("photos").delete().eq("guest_id", guest.id);

    // 3. Delete guest row from Supabase
    await sb.from("guests").delete().eq("id", guest.id);

    // 4. Clear session cookie
    const res = NextResponse.json({ ok: true, deleted: true });
    res.cookies.set(cookieName(eventSlug), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("Unhandled error in /api/guests/delete:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
