import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";

interface AdminLoginPageProps {
  searchParams?: Promise<{ next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const session = await getAuthSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const next = resolvedSearchParams?.next;

  if (session) {
    if (session.role === "superadmin") {
      redirect(next || "/superadmin");
    } else {
      redirect(next || "/admin");
    }
  }

  return <AdminLoginForm nextPath={next} />;
}
