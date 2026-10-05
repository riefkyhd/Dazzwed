import "server-only";
import { google, type drive_v3 } from "googleapis";
import { serverEnv } from "@/env";

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
 * Returns an authenticated Google Drive API v3 client using the stored refresh token.
 */
export function getDriveClient(): drive_v3.Drive {
  const env = serverEnv();
  if (!env.GOOGLE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_REFRESH_TOKEN is not configured in environment variables");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}
