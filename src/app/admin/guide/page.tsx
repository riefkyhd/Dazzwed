import React from "react";
import { requireAdmin } from "@/lib/supabase/auth";
import { AdminGuideView } from "@/components/admin/AdminGuideView";

export const dynamic = "force-dynamic";

export default async function AdminGuidePage() {
  await requireAdmin();

  return <AdminGuideView />;
}
