import "server-only";
import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";

export interface UploadPhotoParams {
  drive: drive_v3.Drive;
  folderId: string;
  fileBuffer: Buffer;
  guestNameOrShortId: string;
  shotNumber: number;
}

export interface UploadPhotoResult {
  driveFileId: string;
  sizeBytes: number;
  filename: string;
}

export function generatePhotoFilename(
  rollCodeOrShortId: string,
  shotNumber: number,
  timestamp: Date = new Date(),
): string {
  // Format: 2026-10-05T09-30-00_7K9X2B_1.jpg
  // Strictly rollCode, no PII (guest display name) in Drive filenames
  const iso = timestamp.toISOString().replace(/:/g, "-").split(".")[0];
  const cleanCode =
    rollCodeOrShortId
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30) || "roll";

  return `${iso}_${cleanCode}_${shotNumber}.jpg`;
}

/**
 * Uploads a photo buffer to Google Drive inside the target guest folder.
 */
export async function uploadPhotoToDrive({
  drive,
  folderId,
  fileBuffer,
  guestNameOrShortId,
  shotNumber,
}: UploadPhotoParams): Promise<UploadPhotoResult> {
  const filename = generatePhotoFilename(guestNameOrShortId, shotNumber);

  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: "image/jpeg",
      body: stream,
    },
    fields: "id, size",
  });

  const driveFileId = res.data.id;
  if (!driveFileId) {
    throw new Error("Google Drive upload completed without returning a file ID");
  }

  return {
    driveFileId,
    sizeBytes: fileBuffer.length,
    filename,
  };
}
