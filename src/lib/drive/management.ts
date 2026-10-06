import "server-only";
import type { drive_v3 } from "googleapis";
import { getDriveClient, resolveDriveTokens } from "./client";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Finds or lazily creates a "Hidden Photos" folder inside the root Drive folder.
 */
export async function ensureHiddenFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
): Promise<string> {
  // Search for existing hidden folder in root
  const query = `'${rootFolderId}' in parents and name = 'Hidden Photos' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listRes = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const existing = listRes.data.files?.[0];
  if (existing?.id) {
    return existing.id;
  }

  // Create Hidden Photos subfolder
  const createRes = await drive.files.create({
    requestBody: {
      name: "Hidden Photos",
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
  });

  if (!createRes.data.id) {
    throw new Error("Failed to create Hidden Photos folder in Google Drive");
  }

  return createRes.data.id;
}

/**
 * Moves a file in Google Drive to the "Hidden Photos" folder and marks the photo as 'hidden' in Supabase.
 */
export async function hidePhoto(photoId: string): Promise<void> {
  const sb = supabaseAdmin();
  const { refreshToken, rootFolderId } = await resolveDriveTokens();

  const { data: photo, error: fetchErr } = await sb
    .from("photos")
    .select("id, drive_file_id, status, guest_id")
    .eq("id", photoId)
    .single();

  if (fetchErr || !photo) {
    throw new Error(`Photo not found: ${fetchErr?.message || photoId}`);
  }

  // If photo has a Google Drive file, move it to Hidden Photos
  if (photo.drive_file_id && rootFolderId && refreshToken) {
    try {
      const drive = getDriveClient(refreshToken);
      const hiddenFolderId = await ensureHiddenFolder(drive, rootFolderId);

      const fileMeta = await drive.files.get({
        fileId: photo.drive_file_id,
        fields: "parents",
      });

      const previousParents = (fileMeta.data.parents || []).join(",");

      await drive.files.update({
        fileId: photo.drive_file_id,
        addParents: hiddenFolderId,
        removeParents: previousParents || undefined,
        fields: "id, parents",
      });
    } catch (driveErr) {
      console.error(`Failed to move file ${photo.drive_file_id} to Hidden folder:`, driveErr);
      // We still update the database status so the photo is marked hidden
    }
  }

  const { error: updateErr } = await sb
    .from("photos")
    .update({ status: "hidden", updated_at: new Date().toISOString() })
    .eq("id", photoId);

  if (updateErr) {
    throw new Error(`Failed to mark photo hidden in DB: ${updateErr.message}`);
  }
}

/**
 * Restores a hidden photo to 'confirmed' status and moves it back to the guest folder if available.
 */
export async function unhidePhoto(photoId: string): Promise<void> {
  const sb = supabaseAdmin();
  const { refreshToken, rootFolderId } = await resolveDriveTokens();

  const { data: photo, error: fetchErr } = await sb
    .from("photos")
    .select("id, drive_file_id, status, guest_id, guests(drive_folder_id)")
    .eq("id", photoId)
    .single();

  if (fetchErr || !photo) {
    throw new Error(`Photo not found: ${fetchErr?.message || photoId}`);
  }

  if (photo.drive_file_id && rootFolderId && refreshToken) {
    try {
      const drive = getDriveClient(refreshToken);
      const targetFolderId =
        (photo as unknown as { guests?: { drive_folder_id?: string | null } })?.guests?.drive_folder_id ||
        rootFolderId;

      const fileMeta = await drive.files.get({
        fileId: photo.drive_file_id,
        fields: "parents",
      });
      const previousParents = (fileMeta.data.parents || []).join(",");

      await drive.files.update({
        fileId: photo.drive_file_id,
        addParents: targetFolderId,
        removeParents: previousParents || undefined,
        fields: "id, parents",
      });
    } catch (driveErr) {
      console.error(`Failed to restore file ${photo.drive_file_id} to guest folder:`, driveErr);
    }
  }

  const { error: updateErr } = await sb
    .from("photos")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", photoId);

  if (updateErr) {
    throw new Error(`Failed to restore photo status: ${updateErr.message}`);
  }
}

/**
 * Deletes a photo permanently from Google Drive (if uploaded) and deletes the database record.
 */
export async function deletePhoto(photoId: string): Promise<void> {
  const sb = supabaseAdmin();
  const { refreshToken } = await resolveDriveTokens();

  const { data: photo, error: fetchErr } = await sb
    .from("photos")
    .select("id, drive_file_id")
    .eq("id", photoId)
    .single();

  if (fetchErr || !photo) {
    throw new Error(`Photo not found: ${fetchErr?.message || photoId}`);
  }

  if (photo.drive_file_id && refreshToken) {
    try {
      const drive = getDriveClient(refreshToken);
      await drive.files.delete({ fileId: photo.drive_file_id });
    } catch (driveErr) {
      console.error(`Failed to delete file ${photo.drive_file_id} from Drive:`, driveErr);
      // Proceed to delete record from DB regardless
    }
  }

  const { error: delErr } = await sb.from("photos").delete().eq("id", photoId);
  if (delErr) {
    throw new Error(`Failed to delete photo from DB: ${delErr.message}`);
  }
}
