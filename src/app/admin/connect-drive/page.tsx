import React, { Suspense } from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { ConnectDriveView } from "@/components/admin/ConnectDriveView";

export const dynamic = "force-dynamic";

export default async function ConnectDrivePage() {
  const { requireSuperadmin } = await import("@/lib/auth/session");
  const admin = await requireSuperadmin();
  const { getActiveAdminEvent } = await import("@/lib/events/active");
  const activeEvent = await getActiveAdminEvent();

  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-400">Loading…</div>}>
      <ConnectDriveView
        userEmail={admin.email ?? "Admin"}
        activeSlug={activeEvent?.slug ?? "wedding"}
        activeCoupleNames={activeEvent?.couple_names ?? "Wedding"}
      />
    </Suspense>
  );
}
