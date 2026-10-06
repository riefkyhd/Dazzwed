import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const telemetrySchema = z.object({
  type: z.enum(["error", "unhandledrejection", "camera_fail", "upload_fail", "warning", "info"]),
  message: z.string().min(1).max(1000),
  route: z.string().max(255),
  eventSlug: z.string().max(63).optional(),
  guestId: z.uuid().optional(),
  deviceClass: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
  browser: z.string().max(100).optional(),
  os: z.string().max(100).optional(),
  appVersion: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = telemetrySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const ip = getClientIp(req);
    // Rate limit per IP to prevent spam (max 30 telemetry events per min per IP)
    const limit = await checkRateLimit(`telemetry:${ip}`, 30, 60);
    if (!limit.allowed) {
      return NextResponse.json({ ok: false, rateLimited: true }, { status: 429 });
    }

    const { type, message, route, eventSlug, guestId, deviceClass, browser, os, appVersion } = parsed.data;

    const sb = supabaseAdmin();
    let eventId: string | null = null;

    if (eventSlug) {
      const { data: event } = await sb
        .from("events")
        .select("id")
        .eq("slug", eventSlug)
        .maybeSingle();
      if (event) eventId = event.id;
    }

    await sb.from("client_events").insert({
      event_id: eventId,
      guest_id: guestId || null,
      type,
      message,
      route,
      device_class: deviceClass || "unknown",
      browser: browser || "other",
      os: os || "other",
      app_version: appVersion || "0.1.0",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telemetry handler error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
