import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SettingsView } from "@/components/admin/SettingsView";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  const sb = supabaseAdmin();
  const { data: event } = await sb
    .from("events")
    .select("id, slug, couple_names, shots_per_guest, opens_at, closes_at, manually_closed, theme")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

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
        theme: themeObj,
      }}
    />
  );
}
