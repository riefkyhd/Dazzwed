import React from "react";
import { getAdminUser } from "@/lib/supabase/auth";
import { AdminNavbar } from "@/components/admin/AdminNavbar";
import { getActiveAdminEvent, listAdminEvents } from "@/lib/events/active";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  const [activeEvent, allEvents] = await Promise.all([
    getActiveAdminEvent(),
    listAdminEvents(),
  ]);

  return (
    <div className="min-h-screen bg-[#0C0A09] text-zinc-100 font-sans selection:bg-amber-400 selection:text-black">
      {user && user.email && (
        <AdminNavbar
          userEmail={user.email}
          currentEvent={activeEvent ? {
            id: activeEvent.id,
            slug: activeEvent.slug,
            couple_names: activeEvent.couple_names,
            status: activeEvent.status,
            package_tier: activeEvent.package_tier,
            package_max_guests: activeEvent.package_max_guests,
            package_max_shots_per_guest: activeEvent.package_max_shots_per_guest,
          } : undefined}
          allEvents={allEvents.map((ev) => ({
            id: ev.id,
            slug: ev.slug,
            couple_names: ev.couple_names,
            status: ev.status,
            package_tier: ev.package_tier,
            package_max_guests: ev.package_max_guests,
            package_max_shots_per_guest: ev.package_max_shots_per_guest,
          }))}
        />
      )}
      <main className="w-full pb-24 md:pb-8">{children}</main>
    </div>
  );
}
