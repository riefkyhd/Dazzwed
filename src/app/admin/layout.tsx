import React from "react";
import { getAdminUser } from "@/lib/supabase/auth";
import { AdminNavbar } from "@/components/admin/AdminNavbar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();

  return (
    <div className="min-h-screen bg-[#0C0A09] text-zinc-100 font-sans selection:bg-amber-400 selection:text-black">
      {user && user.email && <AdminNavbar userEmail={user.email} />}
      <main className="w-full">{children}</main>
    </div>
  );
}
