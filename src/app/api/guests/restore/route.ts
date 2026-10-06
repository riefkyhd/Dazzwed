import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventBySlug } from "@/lib/event-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { computeRollCodeFromGuestId, normalizeRollCode } from "@/lib/guest/session";

export const dynamic = "force-dynamic";

const body = z.object({
  eventSlug: z.string().min(2).max(63),
  rollCode: z.string().min(4).max(12),
});

const cookieName = (slug: string) => `dc_g_${slug}`;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Strict rate limit on code recovery: 5 attempts per minute per IP to prevent brute forcing
  const ipLimit = await checkRateLimit(`restore_ip:${ip}`, 5, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts, please wait a minute" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid roll code format" }, { status: 400 });
  }

  const { eventSlug, rollCode } = parsed.data;
  const normalizedCode = normalizeRollCode(rollCode);

  if (normalizedCode.length < 6) {
    return NextResponse.json({ error: "Roll code must be 6 characters" }, { status: 400 });
  }

  const ev = await getEventBySlug(eventSlug);
  if (!ev) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Invalid roll code" }, { status: 404 });
  }

  // Update last seen
  await sb.from("guests").update({ last_seen_at: new Date().toISOString() }).eq("id", matchedGuest.id);

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
