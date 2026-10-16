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
    .select("id, slug, couple_names, shots_per_guest")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!event) {
    return <div className="p-8 text-center text-zinc-400">Event not found.</div>;
  }

  // 2. Fetch Storage Guard
  const storageGuard = await getAdaptiveStorageGuard();

  // 3. Queue metrics & photos breakdown (fail-safe for schema migration)
  let photos: any[] = [];
  const { data: pData, error: pErr } = await sb
    .from("photos")
    .select("id, guest_id, status, preset_id, look_id")
    .eq("event_id", event.id);

  if (pErr) {
    const { data: fallbackPhotos } = await sb
      .from("photos")
      .select("id, guest_id, status, look_id")
      .eq("event_id", event.id);
    photos = fallbackPhotos || [];
  } else {
    photos = pData || [];
  }

  const all = photos || [];
  const confirmed = all.filter((p) => p.status === "confirmed").length;
  const failed = all.filter((p) => p.status === "failed").length;
  const pending = all.filter((p) => p.status === "pending").length;
  const total = all.length;
  const failureRatePercent = total > 0 ? (failed / total) * 100 : 0;

  // 4. Product Analytics from event_metrics and guests
  const { data: metricsRaw } = await sb
    .from("event_metrics")
    .select("metric_type, metric_key, count")
    .eq("event_id", event.id);

  const { data: guestsRaw } = await sb
    .from("guests")
    .select("id")
    .eq("event_id", event.id);

  const metrics = metricsRaw || [];
  const guests = guestsRaw || [];

  // Group recipe metrics
  const keptMap = new Map<string, number>();
  const retakeMap = new Map<string, number>();
  let totalKept = 0;
  let totalRetakes = 0;

  for (const m of metrics) {
    const count = Number(m.count) || 0;
    if (m.metric_type === "filter_kept") {
      keptMap.set(m.metric_key, (keptMap.get(m.metric_key) || 0) + count);
      totalKept += count;
    } else if (m.metric_type === "filter_retaken") {
      retakeMap.set(m.metric_key, (retakeMap.get(m.metric_key) || 0) + count);
      totalRetakes += count;
    }
  }

  // Fallback to photos table if event_metrics is empty
  if (totalKept === 0 && all.length > 0) {
    for (const p of all) {
      if (p.status !== "failed") {
        const key = p.preset_id || p.look_id || "disposable-400";
        keptMap.set(key, (keptMap.get(key) || 0) + 1);
        totalKept += 1;
      }
    }
  }

  const allRecipeKeys = Array.from(new Set([...keptMap.keys(), ...retakeMap.keys()]));
  const recipeLeaderboard = allRecipeKeys
    .map((key) => {
      const keptCount = keptMap.get(key) || 0;
      const retakeCount = retakeMap.get(key) || 0;
      const sharePercent = totalKept > 0 ? (keptCount / totalKept) * 100 : 0;
      return {
        id: key,
        name: key,
        keptCount,
        retakeCount,
        sharePercent,
      };
    })
    .sort((a, b) => b.keptCount - a.keptCount);

  // Funnel calculation
  const totalGuestsConsented = guests.length;
  const guestShotCounts = new Map<string, number>();
  for (const p of all) {
    if (p.status !== "failed") {
      guestShotCounts.set(p.guest_id, (guestShotCounts.get(p.guest_id) || 0) + 1);
    }
  }
  const guestsShotAtLeastOnce = guestShotCounts.size;
  const targetShots = event.shots_per_guest || 15;
  let guestsCompletedRoll = 0;
  for (const count of guestShotCounts.values()) {
    if (count >= targetShots) guestsCompletedRoll++;
  }

  const keepToRetakeRatio =
    totalRetakes > 0
      ? `${(totalKept / totalRetakes).toFixed(1)} : 1`
      : totalKept > 0
        ? `${totalKept} : 0`
        : "—";

  // Capture mode reliability
  let takePhotoCount = 0;
  let videoFrameCount = 0;
  for (const m of metrics) {
    if (m.metric_type === "capture_mode") {
      if (m.metric_key === "takePhoto") takePhotoCount += Number(m.count) || 0;
      if (m.metric_key === "videoFrame") videoFrameCount += Number(m.count) || 0;
    }
  }
  const totalCaptureModes = takePhotoCount + videoFrameCount;
  const takePhotoPercent = totalCaptureModes > 0 ? (takePhotoCount / totalCaptureModes) * 100 : 0;
  const videoFramePercent = totalCaptureModes > 0 ? (videoFrameCount / totalCaptureModes) * 100 : (all.length > 0 ? 100 : 0);

  // 5. Client events from client_events table
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
      productAnalytics={{
        recipeLeaderboard,
        funnel: {
          totalGuestsConsented,
          guestsShotAtLeastOnce,
          guestsCompletedRoll,
          totalKept,
          totalRetakes,
          keepToRetakeRatio,
        },
        reliability: {
          takePhotoCount,
          videoFrameCount: videoFrameCount || (all.length > 0 ? all.length : 0),
          takePhotoPercent,
          videoFramePercent: totalCaptureModes > 0 ? videoFramePercent : (all.length > 0 ? 100 : 0),
        },
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
