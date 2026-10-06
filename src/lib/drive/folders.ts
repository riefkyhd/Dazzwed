import "server-only";
import type { drive_v3 } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

/**
 * Ensures a per-guest subfolder exists inside the root event folder.
 * Uses lazy creation and updates the cached drive_folder_id in the guests table.
 * Handles concurrent creation races gracefully.
 */
export async function ensureGuestFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  guestId: string,
  displayName: string | null,
): Promise<string> {
  const sb = supabaseAdmin();

  // First check if already cached
  const { data: currentGuest, error: fetchErr } = await sb
    .from("guests")
    .select("drive_folder_id")
    .eq("id", guestId)
    .single();

  if (fetchErr) {
    throw new Error(`Failed to query guest: ${fetchErr.message}`);
  }

  if (currentGuest?.drive_folder_id) {
    return currentGuest.drive_folder_id;
  }

  // Create subfolder in Drive
  const shortId = guestId.replace(/-/g, "").slice(0, 6);
  const cleanName = displayName?.trim().replace(/[/\\?%*:|"<>]/g, "") || "Guest";
  const folderName = `${cleanName} (${shortId})`;

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

  // Save folderId in Supabase
  await sb
    .from("guests")
    .update({ drive_folder_id: folderId })
    .eq("id", guestId);

  return folderId;
}

/**
 * Ensures an "originals" subfolder exists inside the guest's folder.
 * Used when SAVE_CLEAN_ORIGINAL is enabled to keep unfiltered files neatly organized.
 */
export async function ensureOriginalsFolder(
  drive: drive_v3.Drive,
  guestFolderId: string,
): Promise<string> {
  // Query if "originals" folder already exists inside guestFolderId
  const listRes = await drive.files.list({
    q: `'${guestFolderId}' in parents and name = 'originals' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    return listRes.data.files[0].id;
  }

  // Create "originals" subfolder
  const createRes = await drive.files.create({
    requestBody: {
      name: "originals",
      mimeType: "application/vnd.google-apps.folder",
      parents: [guestFolderId],
    },
    fields: "id",
  });

  const folderId = createRes.data.id;
  if (!folderId) {
    throw new Error("Failed to create originals subfolder in Google Drive");
  }
  return folderId;
}
