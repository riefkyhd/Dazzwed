import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdaptiveStorageGuard } from "@/lib/drive/health";
import { HealthView } from "@/components/admin/HealthView";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  await requireAdmin();

  const sb = supabaseAdmin();

  // 1. Fetch current event
  const { data: event } = await sb
    .from("events")
    .select("id, slug, couple_names")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!event) {
    return <div className="p-8 text-center text-zinc-400">Event not found.</div>;
  }

  // 2. Fetch Storage Guard
  const storageGuard = await getAdaptiveStorageGuard();

  // 3. Queue metrics from photos table
  const { data: photos } = await sb
    .from("photos")
    .select("status")
    .eq("event_id", event.id);

  const all = photos || [];
  const confirmed = all.filter((p) => p.status === "confirmed").length;
  const failed = all.filter((p) => p.status === "failed").length;
  const pending = all.filter((p) => p.status === "pending").length;
  const total = all.length;
  const failureRatePercent = total > 0 ? (failed / total) * 100 : 0;

  // 4. Client events from client_events table
  const { data: rawEvents } = await sb
    .from("client_events")
    .select("id, type, message, route, browser, os, device_class, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const events = rawEvents || [];
  const errorsCount = events.filter((e) => e.type === "error").length;
  const unhandledRejectionsCount = events.filter((e) => e.type === "unhandledrejection").length;
  const cameraFailuresCount = events.filter((e) => e.type === "camera_fail").length;
  const uploadFailuresCount = events.filter((e) => e.type === "upload_fail").length;

  // Aggregate top browsers
  const browserCounts: Record<string, number> = {};
  const deviceCounts: Record<string, number> = {};

  for (const e of events) {
    if (e.browser) browserCounts[e.browser] = (browserCounts[e.browser] || 0) + 1;
    if (e.device_class) deviceCounts[e.device_class] = (deviceCounts[e.device_class] || 0) + 1;
  }

  const topBrowsers = Object.entries(browserCounts)
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count);

  const topDevices = Object.entries(deviceCounts)
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <HealthView
      eventSlug={event.slug}
      storageGuard={storageGuard}
      queueMetrics={{
        pendingPhotos: pending,
        failedPhotos: failed,
        confirmedPhotos: confirmed,
        totalPhotos: total,
        failureRatePercent,
      }}
      clientEventStats={{
        totalEvents: events.length,
        errorsCount,
        unhandledRejectionsCount,
        cameraFailuresCount,
        uploadFailuresCount,
        topBrowsers,
        topDevices,
        recentEvents: events.slice(0, 15),
      }}
    />
  );
}
