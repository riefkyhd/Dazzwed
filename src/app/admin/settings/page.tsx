import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SettingsView } from "@/components/admin/SettingsView";
import { getActiveAdminEvent } from "@/lib/events/active";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSettingsPage() {
  await requireAdmin();
  const { getAuthSession } = await import("@/lib/auth/session");
  const session = await getAuthSession();
  const userRole = session?.role || "superadmin";

  const event = await getActiveAdminEvent();

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-zinc-400">
        No event found.
      </div>
    );
  }

  const themeObj = (event.theme && typeof event.theme === "object" ? event.theme : {}) as {
    accentColor?: string;
    accentFg?: string;
    bgColor?: string;
    note?: string;
    activeLookId?: string;
    sessionResetAt?: string;
  };

  return (
    <SettingsView
      initialEvent={{
        id: event.id,
        slug: event.slug,
        couple_names: event.couple_names,
        shots_per_guest: event.shots_per_guest,
        opens_at: event.opens_at,
        closes_at: event.closes_at,
        manually_closed: event.manually_closed,
        status: event.status,
        package_tier: event.package_tier,
        package_max_guests: event.package_max_guests,
        package_max_shots_per_guest: event.package_max_shots_per_guest,
        access_token: event.access_token,
        token_expires_at: event.token_expires_at,
        token_duration_hours: event.token_duration_hours ?? 72,
        theme: themeObj,
      }}
      userRole={userRole}
    />
  );
}
