import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { MAX_TELEMETRY_BODY_BYTES, sanitizeTelemetryMessage } from "@/lib/telemetry/sanitizer";

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
    // 1. Enforce payload body size cap (16 KB max)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_TELEMETRY_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const rawText = await req.text();
    if (rawText.length > MAX_TELEMETRY_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let raw: unknown = null;
    try {
      raw = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

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

    // 2. Sanitize PII from message
    const cleanMessage = sanitizeTelemetryMessage(message);

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
      message: cleanMessage,
      route,
      device_class: deviceClass || "unknown",
      browser: browser || "other",
      os: os || "other",
      app_version: appVersion || "0.1.0",
    });

    // 3. Retention pruning: probabilistically delete events older than 30 days (5% sample chance)
    if (Math.random() < 0.05) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      void Promise.resolve(
        sb.from("client_events").delete().lt("created_at", thirtyDaysAgo)
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telemetry handler error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
