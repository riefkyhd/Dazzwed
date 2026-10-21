import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { QrGeneratorView } from "@/components/admin/QrGeneratorView";
import { getActiveAdminEvent } from "@/lib/events/active";
import { EmptyEventOnboardingView } from "@/components/admin/EmptyEventOnboardingView";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQrPage() {
  await requireAdmin();

  const event = await getActiveAdminEvent();

  if (!event) {
    const session = await getAuthSession();
    return (
      <EmptyEventOnboardingView
        clientName={session?.name}
        clientEmail={session?.email}
        isSuperadmin={session?.role === "superadmin"}
      />
    );
  }

  return <QrGeneratorView event={event} />;
}
