import { NextResponse } from "next/server";
import { checkDriveHealth } from "@/lib/drive/health";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { getAuthSession } = await import("@/lib/auth/session");
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden: Superadmin access required" }, { status: 403 });
  }

  const health = await checkDriveHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 500 });
}
