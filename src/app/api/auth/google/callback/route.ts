import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/drive/client";
import { createRootFolder } from "@/lib/drive/folders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const eventSlug = url.searchParams.get("state") || "our-wedding";

  if (!code) {
    const errorDesc = url.searchParams.get("error_description") || url.searchParams.get("error") || "No code provided";
    return NextResponse.redirect(`${url.origin}/admin/connect-drive?error=${encodeURIComponent(errorDesc)}`);
  }

  try {
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const oauth2Client = getOAuth2Client(redirectUri);

    // 1. Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return NextResponse.redirect(
        `${url.origin}/admin/connect-drive?error=${encodeURIComponent("No refresh token returned. Ensure you clicked consent on the dedicated wedding Google account.")}`,
      );
    }

    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // 2. Fetch event couple names
    const sb = supabaseAdmin();
    const { data: event, error: eventErr } = await sb
      .from("events")
      .select("id, couple_names")
      .eq("slug", eventSlug)
      .single();

    if (eventErr || !event) {
      throw new Error(`Event ${eventSlug} not found in database`);
    }

    // 3. Create root folder in Google Drive
    const rootFolderId = await createRootFolder(drive, event.couple_names);

    // 4. Cache drive_root_folder_id and google_refresh_token on event
    await sb
      .from("events")
      .update({
        drive_root_folder_id: rootFolderId,
        google_refresh_token: refreshToken,
      })
      .eq("id", event.id);

    // Redirect to connect-drive page with details
    const redirectParams = new URLSearchParams({
      connected: "1",
      refreshToken,
      folderId: rootFolderId,
      coupleNames: event.couple_names,
    });

    return NextResponse.redirect(`${url.origin}/admin/connect-drive?${redirectParams.toString()}`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${url.origin}/admin/connect-drive?error=${encodeURIComponent(msg)}`);
  }
}
