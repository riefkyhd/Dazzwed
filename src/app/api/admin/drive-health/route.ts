import { NextResponse } from "next/server";
import { checkDriveHealth } from "@/lib/drive/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkDriveHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 500 });
}
