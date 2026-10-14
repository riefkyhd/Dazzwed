import "server-only";
import type { drive_v3 } from "googleapis";

/**
 * Creates the root folder for the event in Google Drive.
 * Must be created through the API because the drive.file scope only grants access
 * to files and folders created by the app itself.
 */
export async function createRootFolder(
  drive: drive_v3.Drive,
  coupleNames: string,
): Promise<string> {
  const name = `Disposable Cam - ${coupleNames.trim()}`;
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, name",
  });

  const folderId = res.data.id;
  if (!folderId) {
    throw new Error("Failed to create root folder in Google Drive: no ID returned");
  }
  return folderId;
}

import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeRollCodeFromGuestId } from "@/lib/guest/session";

const guestFolderCache = new Map<string, string>();
const originalsFolderCache = new Map<string, string>();

/**
 * Ensures a per-guest subfolder exists inside the root event folder.
 * Subfolder is named `${cleanName} (${rollCode})` so even guests with identical names
 * get isolated folders distinguished by their unique 6-character roll code (e.g. "Riefky (7K9X2B)").
 * Caches drive_folder_id in Supabase guests table and memory cache.
 */
export async function ensureGuestFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  guestId: string,
  displayName: string | null,
): Promise<string> {
  const memCached = guestFolderCache.get(guestId);
  if (memCached) return memCached;

  const sb = supabaseAdmin();

  // First check if already cached in Supabase
  const { data: currentGuest, error: fetchErr } = await sb
    .from("guests")
    .select("drive_folder_id")
    .eq("id", guestId)
    .maybeSingle();

  if (!fetchErr && currentGuest?.drive_folder_id) {
    guestFolderCache.set(guestId, currentGuest.drive_folder_id);
    return currentGuest.drive_folder_id;
  }

  // Create subfolder in Drive with unique roll code: e.g. "Roll 7K9X2B"
  // Guest display name is excluded from Drive folder names to strictly avoid PII leakage
  const rollCode = computeRollCodeFromGuestId(guestId);
  const folderName = `Roll ${rollCode}`;

  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
  });

  const folderId = res.data.id;
  if (!folderId) {
    throw new Error("Failed to create guest subfolder in Google Drive");
  }

  guestFolderCache.set(guestId, folderId);

  // Save folderId in Supabase
  await sb
    .from("guests")
    .update({ drive_folder_id: folderId })
    .eq("id", guestId);

  return folderId;
}

/**
 * Ensures an "originals" subfolder exists inside the guest's folder (or target folder).
 * Caches in-memory per parent folder ID so Drive list/create calls are never repeated.
 */
export async function ensureOriginalsFolder(
  drive: drive_v3.Drive,
  targetFolderId: string,
): Promise<string> {
  const cached = originalsFolderCache.get(targetFolderId);
  if (cached) return cached;

  // Query if "originals" folder already exists inside targetFolderId
  const listRes = await drive.files.list({
    q: `'${targetFolderId}' in parents and name = 'originals' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    const id = listRes.data.files[0].id;
    originalsFolderCache.set(targetFolderId, id);
    return id;
  }

  // Create "originals" subfolder inside targetFolderId
  const createRes = await drive.files.create({
    requestBody: {
      name: "originals",
      mimeType: "application/vnd.google-apps.folder",
      parents: [targetFolderId],
    },
    fields: "id",
  });

  const folderId = createRes.data.id;
  if (!folderId) {
    throw new Error("Failed to create originals subfolder in Google Drive");
  }
  originalsFolderCache.set(targetFolderId, folderId);
  return folderId;
}

/**
 * Alias for ensuring originals folder inside root or specified folder.
 */
export async function ensureEventOriginalsFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
): Promise<string> {
  return ensureOriginalsFolder(drive, rootFolderId);
}

