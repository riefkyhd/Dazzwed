import "server-only";
import { Readable } from "node:stream";
import { getDriveClient, resolveDriveTokens } from "./client";

export interface DriveHealthResult {
  ok: boolean;
  userEmail?: string;
  storageQuota?: {
    limitBytes: number; // 0 or negative for unlimited
    usageBytes: number;
    usageInDriveBytes: number;
    usageInDriveTrashBytes: number;
    remainingBytes: number;
  };
  testUploadOk: boolean;
  error?: string;
}

export interface StorageGuardResult {
  allowed: boolean;
  tier: "high" | "original";
  percentUsed: number;
  remainingBytes: number;
  estimatedPhotosRemaining: number;
  warning?: boolean;
  message?: string;
}

let cachedGuard: { result: StorageGuardResult; expiresAt: number } | null = null;

/**
 * Evaluates Drive quota (400 GB plan) with 60s in-memory cache:
 * - Always uses "high" tier (max 4096 px long edge, JPEG q0.92, or original for native camera)
 * - Warning when usage >= 85%
 * - Halt uploads only when usage >= 98%
 */
export async function getAdaptiveStorageGuard(): Promise<StorageGuardResult> {
  const now = Date.now();
  if (cachedGuard && cachedGuard.expiresAt > now) {
    return cachedGuard.result;
  }

  const { refreshToken } = await resolveDriveTokens();
  if (!refreshToken) {
    return {
      allowed: true,
      tier: "high",
      percentUsed: 0,
      remainingBytes: 400 * 1024 * 1024 * 1024,
      estimatedPhotosRemaining: 80000,
    };
  }

  try {
    const drive = getDriveClient(refreshToken);
    const about = await drive.about.get({ fields: "storageQuota" });
    const quota = about.data.storageQuota;

    const limit = quota?.limit ? parseInt(quota.limit, 10) : 400 * 1024 * 1024 * 1024;
    const usage = quota?.usage ? parseInt(quota.usage, 10) : 0;
    const remaining = Math.max(0, limit - usage);
    const percentUsed = limit > 0 ? (usage / limit) * 100 : 0;

    let allowed = true;
    let warning = false;
    let message: string | undefined;

    if (percentUsed >= 98) {
      allowed = false;
      message = "Camera film is almost out (Drive storage is 98% full). Uploads paused to protect account.";
    } else if (percentUsed >= 85) {
      warning = true;
      message = "Google Drive storage is over 85% full. Consider reviewing Drive storage.";
    }

    // Estimate based on ~5MB per photo (or ~10MB if saving clean original)
    const estimatedPhotosRemaining = Math.floor(remaining / (5 * 1024 * 1024));

    const result: StorageGuardResult = {
      allowed,
      tier: "high",
      percentUsed,
      remainingBytes: remaining,
      estimatedPhotosRemaining,
      warning,
      message,
    };

    cachedGuard = {
      result,
      expiresAt: now + 60_000, // 60s cache
    };

    return result;
  } catch (err) {
    console.error("Storage guard quota check error, defaulting to high:", err);
    return {
      allowed: true,
      tier: "high",
      percentUsed: 0,
      remainingBytes: 400 * 1024 * 1024 * 1024,
      estimatedPhotosRemaining: 80000,
    };
  }
}

/**
 * Performs a comprehensive health check on Google Drive integration:
 * 1. Checks OAuth refresh token validity and queries storage quota.
 * 2. Uploads and immediately deletes a tiny 1-byte test file in the root folder.
 */
export async function checkDriveHealth(): Promise<DriveHealthResult> {
  const { refreshToken, rootFolderId } = await resolveDriveTokens();

  if (!refreshToken || !rootFolderId) {
    return {
      ok: false,
      testUploadOk: false,
      error: "Google Drive is not connected (missing GOOGLE_REFRESH_TOKEN or DRIVE_ROOT_FOLDER_ID)",
    };
  }

  try {
    const drive = getDriveClient(refreshToken);

    // 1. Check about & quota
    const aboutRes = await drive.about.get({
      fields: "storageQuota, user",
    });

    const user = aboutRes.data.user;
    const quota = aboutRes.data.storageQuota;

    const limit = quota?.limit ? parseInt(quota.limit, 10) : 15 * 1024 * 1024 * 1024;
    const usage = quota?.usage ? parseInt(quota.usage, 10) : 0;
    const usageInDrive = quota?.usageInDrive ? parseInt(quota.usageInDrive, 10) : 0;
    const usageTrash = quota?.usageInDriveTrash ? parseInt(quota.usageInDriveTrash, 10) : 0;

    // 2. Perform test upload/delete in root folder
    let testUploadOk = false;
    let testFileId: string | null = null;

    try {
      const stream = new Readable();
      stream.push(Buffer.from("1"));
      stream.push(null);

      const testRes = await drive.files.create({
        requestBody: {
          name: `.test-health-${Date.now()}.tmp`,
          parents: [rootFolderId],
        },
        media: {
          mimeType: "text/plain",
          body: stream,
        },
        fields: "id",
      });

      testFileId = testRes.data.id || null;
      if (testFileId) {
        testUploadOk = true;
        // Clean up test file immediately
        await drive.files.delete({ fileId: testFileId });
      }
    } catch (testErr) {
      console.error("Test upload/delete failed during Drive health check:", testErr);
      if (testFileId) {
        try {
          await drive.files.delete({ fileId: testFileId });
        } catch {
          // ignore
        }
      }
    }

    return {
      ok: testUploadOk,
      userEmail: user?.emailAddress || undefined,
      storageQuota: {
        limitBytes: limit,
        usageBytes: usage,
        usageInDriveBytes: usageInDrive,
        usageInDriveTrashBytes: usageTrash,
        remainingBytes: Math.max(0, limit - usage),
      },
      testUploadOk,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      testUploadOk: false,
      error: `Drive health check failed: ${msg}`,
    };
  }
}
