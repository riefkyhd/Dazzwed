import React from "react";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/auth";
import { CameraDebugView } from "@/components/debug/CameraDebugView";

export const dynamic = "force-dynamic";

export default async function CameraDebugPage() {
  // If in production, require admin access; otherwise 404
  if (process.env.NODE_ENV === "production") {
    const admin = await getAdminUser();
    if (!admin) {
      notFound();
    }
  }

  return <CameraDebugView />;
}
