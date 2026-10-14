import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventBySlug } from "@/lib/event-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, hashClientIp } from "@/lib/rate-limit";
import { computeRollCodeFromGuestId, normalizeRollCode } from "@/lib/guest/session";
import { CONSENT_VERSION } from "@/constants/consentCopy";

export const dynamic = "force-dynamic";

const body = z.object({
  eventSlug: z.string().min(2).max(63),
  rollCode: z.string().min(4).max(12),
  consentVersion: z.string(),
  consentAlbum: z.boolean(),
  consentTelemetry: z.boolean().optional().default(false),
});

const cookieName = (slug: string) => `dc_g_${slug}`;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const hashedIp = hashClientIp(ip);

  // 1. IP rate limit on code recovery: max 10 attempts per minute per hashed IP
  const ipLimit = await checkRateLimit(`restore_ip:${hashedIp}`, 10, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts, please wait a minute" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  // 2. Lockout on repeated failed restore attempts from this IP: max 5 failed attempts per 15 minutes
  const failIpLimit = await checkRateLimit(`restore_fail_ip:${hashedIp}`, 5, 900);
  if (!failIpLimit.allowed) {
    return NextResponse.json(
      { error: "Too many failed recovery attempts from this network. Please try again in 15 minutes." },
      { status: 429, headers: { "Retry-After": String(failIpLimit.retryAfter) } }
    );
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid roll code or consent parameters" }, { status: 400 });
  }

  const { eventSlug, rollCode, consentVersion, consentAlbum, consentTelemetry } = parsed.data;

  // Strict consent check: must match current CONSENT_VERSION and consentAlbum must be true
  if (consentVersion !== CONSENT_VERSION || !consentAlbum) {
    return NextResponse.json(
      { error: "Consent required to restore and use roll", code: "CONSENT_REQUIRED" },
      { status: 400 }
    );
  }

  const normalizedCode = normalizeRollCode(rollCode);
  if (normalizedCode.length < 6) {
    return NextResponse.json({ error: "Roll code must be 6 characters" }, { status: 400 });
  }

  const ev = await getEventBySlug(eventSlug);
  if (!ev) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // 3. Event-wide anomaly guard against distributed brute force: max 30 failed attempts per 10 minutes
  const failEventLimit = await checkRateLimit(`restore_fail_event:${ev.id}`, 30, 600);
  if (!failEventLimit.allowed) {
    return NextResponse.json(
      { error: "Recovery traffic spike detected for this event. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(failEventLimit.retryAfter) } }
    );
  }

  const sb = supabaseAdmin();

  // Find all guests for this event
  const { data: guests, error: guestsErr } = await sb
    .from("guests")
    .select("id, display_name")
    .eq("event_id", ev.id);

  if (guestsErr || !guests) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Match guest whose derived roll code matches
  const matchedGuest = guests.find((g) => computeRollCodeFromGuestId(g.id) === normalizedCode);

  if (!matchedGuest) {
    // Record failed attempt in rate limits to enforce escalating lockout
    await checkRateLimit(`restore_fail_ip:${hashedIp}`, 5, 900);
    await checkRateLimit(`restore_fail_event:${ev.id}`, 30, 600);
    return NextResponse.json({ error: "Invalid roll code" }, { status: 404 });
  }

  // Update consent and last seen on restored guest
  const nowIso = new Date().toISOString();
  const updateRes = await sb
    .from("guests")
    .update({
      last_seen_at: nowIso,
      consent_version: consentVersion,
      consent_at: nowIso,
      consent_telemetry: consentTelemetry,
    })
    .eq("id", matchedGuest.id);

  if (updateRes.error) {
    console.error("Restore update consent error:", updateRes.error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Count active photos
  const { count } = await sb
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", matchedGuest.id)
    .neq("status", "failed");

  const res = NextResponse.json({
    ok: true,
    guestId: matchedGuest.id,
    name: matchedGuest.display_name,
    rollCode: normalizedCode,
    shotsPerGuest: ev.shots_per_guest,
    shotsUsed: count ?? 0,
    consentTelemetry,
  });

  // Re-issue cookie so future reloads recognize the guest
  res.cookies.set(cookieName(eventSlug), matchedGuest.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });

  return res;
}
