import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const cronSecret = serverEnv().CRON_SECRET;
  if (!cronSecret) return false;
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Deterministic daily cleanup cron:
 * - Deletes telemetry client_events older than 30 days
 * - Deletes rate_limits windows older than 24 hours
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Delete telemetry older than 30 days
  const { error: eventsErr } = await sb
    .from("client_events")
    .delete()
    .lt("created_at", thirtyDaysAgo);

  // 2. Delete rate limit windows older than 24 hours
  const { error: limitsErr } = await sb
    .from("rate_limits")
    .delete()
    .lt("window_start", twentyFourHoursAgo);

  if (eventsErr || limitsErr) {
    console.error("Cleanup cron error:", { eventsErr, limitsErr });
    return NextResponse.json(
      {
        ok: false,
        eventsError: eventsErr?.message,
        limitsError: limitsErr?.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    cleanedAt: new Date().toISOString(),
    retention: {
      clientEventsOlderThan: thirtyDaysAgo,
      rateLimitsOlderThan: twentyFourHoursAgo,
    },
  });
}
