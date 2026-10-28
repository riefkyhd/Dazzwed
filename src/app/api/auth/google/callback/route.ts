import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/drive/client";
import { createRootFolder } from "@/lib/drive/folders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // 1. Enforce superadmin session authorization
  const { getAuthSession } = await import("@/lib/auth/session");
  const session = await getAuthSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.redirect(
      `${url.origin}/admin/login?error=${encodeURIComponent("Unauthorized: Superadmin access required to bind Drive vault")}`
    );
  }

  // 2. Validate cryptographic session-bound state token (CSRF protection)
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieState = cookieStore.get("dazzwed_oauth_state")?.value;
  const queryState = url.searchParams.get("state");

  if (!queryState || !cookieState || cookieState !== queryState) {
    return NextResponse.redirect(
      `${url.origin}/admin/connect-drive?error=${encodeURIComponent("Invalid OAuth state (CSRF verification failed)")}`
    );
  }

  const { verifyOAuthStateToken } = await import("@/lib/security/encryption");
  const verifiedState = verifyOAuthStateToken(queryState);
  if (!verifiedState) {
    return NextResponse.redirect(
      `${url.origin}/admin/connect-drive?error=${encodeURIComponent("OAuth state expired or tampered")}`
    );
  }

  const eventSlug = verifiedState.slug;
  const code = url.searchParams.get("code");

  if (!code) {
    const errorDesc = url.searchParams.get("error_description") || url.searchParams.get("error") || "No code provided";
    const res = NextResponse.redirect(`${url.origin}/admin/connect-drive?error=${encodeURIComponent(errorDesc)}`);
    res.cookies.delete("dazzwed_oauth_state");
    return res;
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

    // 2. Fetch event couple names and existing root folder
    const sb = supabaseAdmin();
    const { data: event, error: eventErr } = await sb
      .from("events")
      .select("id, couple_names, drive_root_folder_id")
      .eq("slug", eventSlug)
      .single();

    if (eventErr || !event) {
      throw new Error(`Event ${eventSlug} not found in database`);
    }

    // 3. Preserve existing root folder if still valid in Drive, else create new
    let rootFolderId = event.drive_root_folder_id;
    if (rootFolderId) {
      try {
        const existing = await drive.files.get({ fileId: rootFolderId, fields: "id, trashed" });
        if (existing.data.trashed) {
          rootFolderId = await createRootFolder(drive, event.couple_names);
        }
      } catch {
        rootFolderId = await createRootFolder(drive, event.couple_names);
      }
    } else {
      rootFolderId = await createRootFolder(drive, event.couple_names);
    }

    // 4. Cache drive_root_folder_id and encrypted google_refresh_token on event
    const { encryptToken } = await import("@/lib/security/encryption");
    const { invalidateDriveTokenCache } = await import("@/lib/drive/client");
    const storedToken = refreshToken ? encryptToken(refreshToken) : null;

    await sb
      .from("events")
      .update({
        drive_root_folder_id: rootFolderId,
        google_refresh_token: storedToken,
      })
      .eq("id", event.id);

    // Invalidate in-memory token cache so active serverless workers switch immediately
    invalidateDriveTokenCache();

    // Redirect to connect-drive page with details (without leaking refreshToken in URL)
    const redirectParams = new URLSearchParams({
      connected: "1",
      folderId: rootFolderId,
      coupleNames: event.couple_names,
    });

    const res = NextResponse.redirect(`${url.origin}/admin/connect-drive?${redirectParams.toString()}`);
    res.cookies.delete("dazzwed_oauth_state");
    return res;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const res = NextResponse.redirect(`${url.origin}/admin/connect-drive?error=${encodeURIComponent(msg)}`);
    res.cookies.delete("dazzwed_oauth_state");
    return res;
  }
}
