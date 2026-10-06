import React, { Suspense } from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { ConnectDriveView } from "@/components/admin/ConnectDriveView";

export const dynamic = "force-dynamic";

export default async function ConnectDrivePage() {
  const admin = await requireAdmin();

  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-400">Loading…</div>}>
      <ConnectDriveView userEmail={admin.email ?? "Admin"} />
    </Suspense>
  );
}
