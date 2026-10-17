import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { QrGeneratorView } from "@/components/admin/QrGeneratorView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQrPage() {
  await requireAdmin();

  const sb = supabaseAdmin();
  const { data: event, error } = await sb
    .from("events")
    .select("slug, couple_names, shots_per_guest, access_token, theme")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !event) {
    return <div className="p-8 text-center text-zinc-400">Event not found.</div>;
  }

  return <QrGeneratorView event={event} />;
}
