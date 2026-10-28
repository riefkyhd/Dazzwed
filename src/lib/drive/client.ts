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

// In-memory cache for resolved Drive tokens (5 min TTL)
let cachedTokens: {
  refreshToken: string | null;
  rootFolderId: string | null;
  expiresAt: number;
} | null = null;

/**
 * Invalidates in-memory Drive token and access token caches (e.g. after OAuth reconnection).
 */
export function invalidateDriveTokenCache(): void {
  cachedTokens = null;
  cachedAccessToken = null;
  tokenRefreshPromise = null;
}

/**
 * Resolves the Google Drive refresh token and root folder ID,
 * checking in-memory cache first, then database events record, then environment variables.
 */
export async function resolveDriveTokens(): Promise<{
  refreshToken: string | null;
  rootFolderId: string | null;
}> {
  const now = Date.now();
  if (cachedTokens && cachedTokens.expiresAt > now) {
    return {
      refreshToken: cachedTokens.refreshToken,
      rootFolderId: cachedTokens.rootFolderId,
    };
  }

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
      if (event.google_refresh_token) {
        const { decryptToken } = await import("@/lib/security/encryption");
        refreshToken = decryptToken(event.google_refresh_token);
      }
      if (event.drive_root_folder_id) rootFolderId = event.drive_root_folder_id;
    }
  } catch (err) {
    console.error("Failed to query Drive tokens from DB:", err);
  }

  // Fallback to environment variables if database didn't have them
  if (!refreshToken) refreshToken = env.GOOGLE_REFRESH_TOKEN || null;
  if (!rootFolderId) rootFolderId = env.DRIVE_ROOT_FOLDER_ID || null;

  cachedTokens = {
    refreshToken,
    rootFolderId,
    expiresAt: now + 5 * 60 * 1000,
  };

  return { refreshToken, rootFolderId };
}

// In-memory cache for Google OAuth access tokens (50 min TTL) + deduplication promise
let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let tokenRefreshPromise: Promise<string | null> | null = null;

/**
 * Returns a valid Google OAuth access token, caching for 50 minutes and deduplicating
 * concurrent token requests so parallel thumbnail loads never hit OAuth 429 rate limits.
 */
export async function getDriveAccessToken(refreshToken: string): Promise<string | null> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = (async () => {
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const tokenRes = await oauth2Client.getAccessToken();
      const token = tokenRes.token || null;
      if (token) {
        cachedAccessToken = {
          token,
          expiresAt: Date.now() + 50 * 60 * 1000,
        };
      }
      return token;
    } catch (err) {
      console.error("Failed to retrieve Drive access token:", err);
      return null;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
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

