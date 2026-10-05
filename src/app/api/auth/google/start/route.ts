import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/drive/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventSlug = url.searchParams.get("slug") || "our-wedding";

  // Check event exists
  const { data: event } = await supabaseAdmin()
    .from("events")
    .select("slug")
    .eq("slug", eventSlug)
    .maybeSingle();

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const oauth2Client = getOAuth2Client(redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state: event?.slug || "our-wedding",
  });

  return NextResponse.redirect(authUrl);
}
