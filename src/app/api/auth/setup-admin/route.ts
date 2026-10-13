import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * This endpoint has been decommissioned.
 * Admin accounts must be created directly through Supabase Auth and the ADMIN_EMAILS
 * environment variable. Returning 410 Gone so clients get a clear, permanent signal.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been decommissioned." },
    { status: 410 }
  );
}
