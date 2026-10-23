import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventBySlug } from "@/lib/event-server";
import { eventStatus } from "@/lib/event";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, hashClientIp } from "@/lib/rate-limit";
import { computeRollCodeFromGuestId } from "@/lib/guest/session";
import { CONSENT_VERSION } from "@/constants/consentCopy";
import { validateEventToken } from "@/lib/event-token";

export const dynamic = "force-dynamic";

const body = z.object({
  eventSlug: z.string().min(2).max(63),
  name: z.string().max(60).nullish(),
  guestId: z.uuid().nullish(),
  consentVersion: z.string(),
  consentAlbum: z.boolean(),
  consentTelemetry: z.boolean().optional().default(false),
  eventToken: z.string().nullish(),
});

const cookieName = (slug: string) => `dc_g_${slug}`;
const clean = (s?: string | null) => {
  if (s === undefined) return undefined;
  const v = (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
  return v || null;
};

/**
 * Create or resume a guest with explicit Indonesia UU PDP consent.
 * Guest name is mandatory (>= 2 chars) for new registrations. Consent is strictly enforced.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const hashedIp = hashClientIp(ip);
  // IP rate limit on guest creation (generous for shared wedding venue Wi-Fi: 60/min)
  const ipLimit = await checkRateLimit(`guest_ip:${hashedIp}`, 60, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many guest creation attempts, please wait" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { eventSlug, guestId: bodyGuestId, consentVersion, consentAlbum, consentTelemetry, eventToken } = parsed.data;

  // Strict consent check: must match current CONSENT_VERSION and consentAlbum must be true
  if (consentVersion !== CONSENT_VERSION || !consentAlbum) {
    return NextResponse.json(
      { error: "Consent required to use camera and save photos", code: "CONSENT_REQUIRED" },
      { status: 400 }
    );
  }

  const name = clean(parsed.data.name);

  const ev = await getEventBySlug(eventSlug);
  if (!ev) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  // Event lifecycle status enforcement
  if (ev.status === "paused") {
    return NextResponse.json(
      { error: "Event photo uploads are currently paused for an intermission", code: "EVENT_PAUSED" },
      { status: 403 }
    );
  }
  if (ev.status === "archived") {
    return NextResponse.json(
      { error: "Event camera has been concluded and archived", code: "EVENT_ARCHIVED" },
      { status: 403 }
    );
  }

  const status = eventStatus(ev);
  if (status !== "open") return NextResponse.json({ error: "closed", status }, { status: 403 });

  // Verify access window expiration
  if (ev.token_expires_at && new Date() >= new Date(ev.token_expires_at)) {
    return NextResponse.json(
      { error: "Event access window has expired", code: "EVENT_EXPIRED" },
      { status: 403 }
    );
  }

  const sb = supabaseAdmin();

  // Enforce package guest cap if set
  if (typeof ev.package_max_guests === "number" && ev.package_max_guests > 0) {
    const { count: currentGuestCount } = await sb
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", ev.id);

    if (currentGuestCount !== null && currentGuestCount >= ev.package_max_guests) {
      return NextResponse.json(
        { error: "Guest registration quota for this event has been reached", code: "PACKAGE_GUEST_LIMIT_REACHED" },
        { status: 403 }
      );
    }
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieId = cookieHeader
    .split(/;\s*/)
    .map((c) => c.split("="))
    .find(([k]) => k === cookieName(eventSlug))?.[1];

  // If not resuming with an existing verified session cookie, require valid eventToken
  const isResumingWithCookie = Boolean(cookieId && z.string().uuid().safeParse(cookieId).success);
  if (!isResumingWithCookie) {
    if (!validateEventToken(eventToken, ev.access_token)) {
      return NextResponse.json(
        { error: "Invalid or missing event access token", code: "INVALID_EVENT_TOKEN" },
        { status: 403 }
      );
    }
  }

  const candidate = [cookieId, bodyGuestId].find((v) => v && z.uuid().safeParse(v).success);

  const sessionResetAt = (ev.theme && typeof ev.theme === "object" && "sessionResetAt" in ev.theme)
    ? (ev.theme as { sessionResetAt?: string | null }).sessionResetAt
    : null;

  let guest: {
    id: string;
    display_name: string | null;
    created_at?: string;
    consent_version?: string;
    consent_at?: string;
    consent_telemetry?: boolean;
  } | null = null;

  if (candidate) {
    const { data } = await sb
      .from("guests")
      .select("id,display_name,created_at,consent_version,consent_at,consent_telemetry")
      .eq("id", candidate)
      .eq("event_id", ev.id)
      .maybeSingle();

    const isExpired = !!(data && sessionResetAt && new Date(data.created_at) < new Date(sessionResetAt));
    if (data && !isExpired) {
      guest = data;
      const nowIso = new Date().toISOString();
      const patchWithConsent: Record<string, unknown> = {
        last_seen_at: nowIso,
        consent_version: consentVersion,
        consent_at: nowIso,
        consent_telemetry: consentTelemetry,
      };

      if (name !== undefined && name !== null) {
        const trimmed = name.trim().slice(0, 50);
        if (trimmed.length >= 2) {
          patchWithConsent.display_name = trimmed;
          guest.display_name = trimmed;
        }
      }
      guest.consent_version = consentVersion;
      guest.consent_at = nowIso;
      guest.consent_telemetry = consentTelemetry;

      const updateRes = await sb.from("guests").update(patchWithConsent).eq("id", data.id);
      if (updateRes.error) {
        console.error("Update guest consent error:", updateRes.error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
      }
    }
  }

  if (!guest) {
    const trimmedName = (name ?? "").trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Guest name is required (at least 2 characters) to start a film roll", code: "GUEST_NAME_REQUIRED" },
        { status: 400 }
      );
    }
    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Guest name must be at most 50 characters", code: "GUEST_NAME_TOO_LONG" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const insertRes = await sb
      .from("guests")
      .insert({
        event_id: ev.id,
        display_name: trimmedName,
        consent_version: consentVersion,
        consent_at: nowIso,
        consent_telemetry: consentTelemetry,
      })
      .select("id,display_name,created_at,consent_version,consent_at,consent_telemetry")
      .single();

    if (insertRes.error || !insertRes.data) {
      console.error("Insert guest error:", insertRes.error);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    guest = insertRes.data;
  }

  const { count } = await sb
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guest.id)
    .neq("status", "failed");

  const rollCode = computeRollCodeFromGuestId(guest.id);

  const res = NextResponse.json({
    guestId: guest.id,
    name: guest.display_name,
    rollCode,
    shotsPerGuest: ev.shots_per_guest,
    shotsUsed: count ?? 0,
    sessionResetAt,
    consentTelemetry: guest.consent_telemetry ?? false,
  });

  res.cookies.set(cookieName(eventSlug), guest.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });

  return res;
}
