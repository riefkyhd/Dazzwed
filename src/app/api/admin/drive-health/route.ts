import { NextResponse } from "next/server";
import { checkDriveHealth } from "@/lib/drive/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const { getAuthSession } = await import("@/lib/auth/session");
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkDriveHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 500 });
}

export async function POST() {
  const { getAuthSession } = await import("@/lib/auth/session");
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkDriveHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 500 });
}

