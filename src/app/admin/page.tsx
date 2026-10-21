import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DashboardView } from "@/components/admin/DashboardView";

import { getAdaptiveStorageGuard } from "@/lib/drive/health";
import { getActiveAdminEvent } from "@/lib/events/active";

import { EmptyEventOnboardingView } from "@/components/admin/EmptyEventOnboardingView";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const sb = supabaseAdmin();

  // 1. Fetch active event dynamically
  const event = await getActiveAdminEvent();

  const session = await getAuthSession();
  const isSuperadmin = session?.role === "superadmin";

  if (!event) {
    return (
      <EmptyEventOnboardingView
        clientName={session?.name}
        clientEmail={session?.email}
        isSuperadmin={isSuperadmin}
      />
    );
  }

  // 2. Fetch guests count, all photos metrics, storage guard, and recent photos concurrently in parallel
  const [
    { count: guestsCount },
    { data: allPhotos },
    storageGuard,
    { data: recentRaw },
  ] = await Promise.all([
    sb
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id),
    sb
      .from("photos")
      .select("id, status, size_bytes, tier, source")
      .eq("event_id", event.id),
    getAdaptiveStorageGuard(),
    sb
      .from("photos")
      .select("id, shot_id, status, size_bytes, created_at, guest_id, tier, source, guests(display_name)")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const confirmedPhotos = (allPhotos || []).filter((p) => p.status === "confirmed");
  const confirmedCount = confirmedPhotos.length;
  const failedCount = (allPhotos || []).filter((p) => p.status === "failed").length;
  const pendingCount = (allPhotos || []).filter((p) => p.status === "pending").length;
  const totalSizeBytes = confirmedPhotos.reduce(
    (acc, p) => acc + (p.size_bytes || 0),
    0,
  );
  const avgSizeBytes = confirmedCount > 0 ? Math.round(totalSizeBytes / confirmedCount) : 0;

  // Tier breakdown
  const tierMix = {
    original: confirmedPhotos.filter((p) => p.tier === "original").length,
    high: confirmedPhotos.filter((p) => p.tier === "high").length,
    standard: confirmedPhotos.filter((p) => p.tier === "standard").length,
    lite: confirmedPhotos.filter((p) => p.tier === "lite").length,
  };

  interface RawPhotoItem {
    id: string;
    shot_id: string;
    status: string;
    size_bytes: number | null;
    created_at: string;
    guest_id: string;
    tier?: string;
    source?: string;
    guests?: { display_name?: string | null } | null;
  }

  const recentPhotos = (recentRaw as unknown as RawPhotoItem[] || []).map((r) => ({
    id: r.id,
    guestName: r.guests?.display_name || `Guest (${r.guest_id.slice(0, 6)})`,
    shot_id: r.shot_id,
    status: r.status,
    size_bytes: r.size_bytes,
    created_at: r.created_at,
    tier: r.tier || "high",
    source: r.source || "inapp",
  }));

  return (
    <DashboardView
      isSuperadmin={isSuperadmin}
      event={event}
      metrics={{
        totalGuests: guestsCount || 0,
        confirmedCount,
        failedCount,
        pendingCount,
        totalSizeBytes,
        avgSizeBytes,
        tierMix,
        estimatedPhotosRemaining: storageGuard.estimatedPhotosRemaining,
        currentTier: storageGuard.tier,
        limitBytes: storageGuard.limitBytes,
        percentUsed: storageGuard.percentUsed,
        remainingBytes: storageGuard.remainingBytes,
        storageWarning: storageGuard.warning,
        storageMessage: storageGuard.message,
      }}
      recentPhotos={recentPhotos}
    />
  );
}
