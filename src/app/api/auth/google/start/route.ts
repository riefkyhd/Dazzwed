import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/drive/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createOAuthStateToken } from "@/lib/security/encryption";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { getAuthSession } = await import("@/lib/auth/session");
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden: Only superadmins can connect Google Drive vault" }, { status: 403 });
  }

  const url = new URL(req.url);
  const eventSlug = url.searchParams.get("slug") || "our-wedding";

  // Check event exists
  const { data: event } = await supabaseAdmin()
    .from("events")
    .select("slug")
    .eq("slug", eventSlug)
    .maybeSingle();

  const targetSlug = event?.slug || "our-wedding";
  const stateToken = createOAuthStateToken(targetSlug);

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const oauth2Client = getOAuth2Client(redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state: stateToken,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("dazzwed_oauth_state", stateToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google/callback",
    maxAge: 600, // 10 minutes
  });

  return res;
}
