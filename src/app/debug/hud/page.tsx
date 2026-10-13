import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

/**
 * In production, gate the debug HUD behind admin authentication.
 * This page redirects to ?debug=1 which enables the on-screen camera
 * diagnostic HUD — not suitable for unauthenticated access in production.
 */
export default async function DebugHudPage() {
  if (process.env.NODE_ENV === "production") {
    const admin = await getAdminUser();
    if (!admin) notFound();
  }
  redirect("/e/our-wedding?debug=1");
}
