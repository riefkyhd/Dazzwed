import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { QrGeneratorView } from "@/components/admin/QrGeneratorView";
import { getActiveAdminEvent } from "@/lib/events/active";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQrPage() {
  await requireAdmin();

  const event = await getActiveAdminEvent();

  if (!event) {
    return <div className="p-8 text-center text-zinc-400">Event not found.</div>;
  }

  return <QrGeneratorView event={event} />;
}
