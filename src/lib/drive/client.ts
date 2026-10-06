import "server-only";
import { google, type drive_v3 } from "googleapis";
import { serverEnv } from "@/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Returns an OAuth2 client configured with client ID, secret, and optional redirect URI.
 */
export function getOAuth2Client(redirectUri?: string) {
  const env = serverEnv();
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

/**
 * Resolves the Google Drive refresh token and root folder ID,
 * checking environment variables first, then falling back to the database events record.
 */
export async function resolveDriveTokens(): Promise<{
  refreshToken: string | null;
  rootFolderId: string | null;
}> {
  const env = serverEnv();
  let refreshToken: string | null = null;
  let rootFolderId: string | null = null;

  // First check database (the live source of truth from OAuth authorization)
  try {
    const { data: event } = await supabaseAdmin()
      .from("events")
      .select("google_refresh_token, drive_root_folder_id")
      .not("google_refresh_token", "is", null)
      .limit(1)
      .maybeSingle();

    if (event) {
      if (event.google_refresh_token) refreshToken = event.google_refresh_token;
      if (event.drive_root_folder_id) rootFolderId = event.drive_root_folder_id;
    }
  } catch (err) {
    console.error("Failed to query Drive tokens from DB:", err);
  }

  // Fallback to environment variables if database didn't have them
  if (!refreshToken) refreshToken = env.GOOGLE_REFRESH_TOKEN || null;
  if (!rootFolderId) rootFolderId = env.DRIVE_ROOT_FOLDER_ID || null;

  return { refreshToken, rootFolderId };
}

/**
 * Returns an authenticated Google Drive API v3 client using the stored refresh token.
 */
export function getDriveClient(explicitToken?: string): drive_v3.Drive {
  const env = serverEnv();
  const token = explicitToken || env.GOOGLE_REFRESH_TOKEN;
  if (!token) {
    throw new Error("GOOGLE_REFRESH_TOKEN is not configured in environment variables");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: token,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}
