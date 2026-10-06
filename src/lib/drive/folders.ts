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

/**
 * Ensures the single shared "originals" subfolder exists inside the root event folder.
 * Caches in-memory per root folder ID so Drive list/create calls are never repeated.
 */
const originalsFolderCache = new Map<string, string>();

export async function ensureEventOriginalsFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
): Promise<string> {
  const cached = originalsFolderCache.get(rootFolderId);
  if (cached) return cached;

  // Query if "originals" folder already exists inside rootFolderId
  const listRes = await drive.files.list({
    q: `'${rootFolderId}' in parents and name = 'originals' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    const id = listRes.data.files[0].id;
    originalsFolderCache.set(rootFolderId, id);
    return id;
  }

  // Create "originals" subfolder once for the event
  const createRes = await drive.files.create({
    requestBody: {
      name: "originals",
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
  });

  const folderId = createRes.data.id;
  if (!folderId) {
    throw new Error("Failed to create originals subfolder in Google Drive");
  }
  originalsFolderCache.set(rootFolderId, folderId);
  return folderId;
}

/**
 * Backward compatibility alias for existing code.
 */
export async function ensureOriginalsFolder(
  drive: drive_v3.Drive,
  targetFolderId: string,
): Promise<string> {
  return ensureEventOriginalsFolder(drive, targetFolderId);
}

/**
 * Backward compatibility alias: in flat folder architecture, guest folder is the root folder.
 */
export async function ensureGuestFolder(
  _drive: drive_v3.Drive,
  rootFolderId: string,
  _guestId: string,
  _displayName: string | null,
): Promise<string> {
  return rootFolderId;
}

