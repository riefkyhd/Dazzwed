import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { LookLabView } from "@/components/admin/LookLabView";

export const dynamic = "force-dynamic";

export default async function LookLabPage() {
  await requireAdmin();

  return <LookLabView />;
}
