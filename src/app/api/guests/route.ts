import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventBySlug } from "@/lib/event-server";
import { eventStatus } from "@/lib/event";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({
  eventSlug: z.string().min(2).max(63),
  name: z.string().max(200).nullish(),
  guestId: z.uuid().nullish(),
});

const cookieName = (slug: string) => `dc_g_${slug}`;
const clean = (s?: string | null) => {
  const v = (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
  return v || null;
};

/**
 * Create or resume an anonymous guest. The guest id is also kept in an httpOnly cookie, so
 * clearing localStorage alone resumes the same guest (and the same shot quota) rather than a fresh one.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  // IP rate limit on guest creation (generous for shared wedding venue Wi-Fi: 60/min)
  const ipLimit = await checkRateLimit(`guest_ip:${ip}`, 60, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many guest creation attempts, please wait" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { eventSlug, guestId: bodyGuestId } = parsed.data;
  const name = clean(parsed.data.name);

  const ev = await getEventBySlug(eventSlug);
  if (!ev) return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  const status = eventStatus(ev);
  if (status !== "open") return NextResponse.json({ error: "closed", status }, { status: 403 });

  const sb = supabaseAdmin();
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieId = cookieHeader
    .split(/;\s*/)
    .map((c) => c.split("="))
    .find(([k]) => k === cookieName(eventSlug))?.[1];
  const candidate = [cookieId, bodyGuestId].find((v) => v && z.uuid().safeParse(v).success);

  let guest: { id: string; display_name: string | null } | null = null;
  if (candidate) {
    const { data } = await sb
      .from("guests")
      .select("id,display_name")
      .eq("id", candidate)
      .eq("event_id", ev.id)
      .maybeSingle();
    if (data) {
      guest = data;
      const patch: { last_seen_at: string; display_name?: string } = { last_seen_at: new Date().toISOString() };
      if (name && !data.display_name) {
        patch.display_name = name;
        guest.display_name = name;
      }
      await sb.from("guests").update(patch).eq("id", data.id);
    }
  }
  if (!guest) {
    const { data, error } = await sb
      .from("guests")
      .insert({ event_id: ev.id, display_name: name })
      .select("id,display_name")
      .single();
    if (error || !data) return NextResponse.json({ error: "server_error" }, { status: 500 });
    guest = data;
  }

  const { count } = await sb
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guest.id)
    .neq("status", "failed");

  const res = NextResponse.json({
    guestId: guest.id,
    name: guest.display_name,
    shotsPerGuest: ev.shots_per_guest,
    shotsUsed: count ?? 0,
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
