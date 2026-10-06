import { NextResponse } from "next/server";
import { checkDriveHealth } from "@/lib/drive/health";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkDriveHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 500 });
}
