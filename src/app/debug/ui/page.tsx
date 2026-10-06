import React from "react";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/auth";
import { UiDebugLab } from "@/components/debug/UiDebugLab";

export const dynamic = "force-dynamic";

export default async function UiDebugPage() {
  if (process.env.NODE_ENV === "production") {
    const admin = await getAdminUser();
    if (!admin) {
      notFound();
    }
  }

  return <UiDebugLab />;
}
