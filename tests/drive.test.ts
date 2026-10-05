import { describe, expect, it, vi } from "vitest";
import { generatePhotoFilename, uploadPhotoToDrive } from "@/lib/drive/upload";
import { createRootFolder } from "@/lib/drive/folders";
import type { drive_v3 } from "googleapis";

describe("Google Drive Photo Uploads", () => {
  it("formats photo filenames cleanly with ISO timestamp, sanitized guest name, and shot count", () => {
    const fixedDate = new Date("2026-10-05T12:34:56.789Z");
    const filename = generatePhotoFilename("Tante Rina / Jakarta!", 3, fixedDate);

    expect(filename).toBe("2026-10-05T12-34-56_Tante_Rina_Jakarta_3.jpg");
  });

  it("handles empty or special character guest names gracefully by falling back to guest", () => {
    const fixedDate = new Date("2026-10-05T12:00:00.000Z");
    const filename = generatePhotoFilename("!!!", 1, fixedDate);

    expect(filename).toBe("2026-10-05T12-00-00_guest_1.jpg");
  });

  it("uploads photo buffer to Google Drive using streams", async () => {
    const fakeFileId = "file-abc-123";
    const fakeCreate = vi.fn().mockResolvedValue({
      data: { id: fakeFileId, size: "1234" },
    });

    const mockDrive = {
      files: {
        create: fakeCreate,
      },
    } as unknown as drive_v3.Drive;

    const buffer = Buffer.from("test-jpeg-binary-content");
    const result = await uploadPhotoToDrive({
      drive: mockDrive,
      folderId: "folder-xyz",
      fileBuffer: buffer,
      guestNameOrShortId: "Uncle_Bob",
      shotNumber: 5,
    });

    expect(fakeCreate).toHaveBeenCalledTimes(1);
    const callArgs = fakeCreate.mock.calls[0][0];
    expect(callArgs.requestBody.parents).toEqual(["folder-xyz"]);
    expect(callArgs.media.mimeType).toBe("image/jpeg");

    expect(result.driveFileId).toBe(fakeFileId);
    expect(result.sizeBytes).toBe(buffer.length);
  });

  it("creates root folder with standard Disposable Cam prefix", async () => {
    const fakeRootId = "root-folder-999";
    const fakeCreate = vi.fn().mockResolvedValue({
      data: { id: fakeRootId, name: "Disposable Cam - Alice & Bob" },
    });

    const mockDrive = {
      files: {
        create: fakeCreate,
      },
    } as unknown as drive_v3.Drive;

    const folderId = await createRootFolder(mockDrive, "Alice & Bob");

    expect(fakeCreate).toHaveBeenCalledWith({
      requestBody: {
        name: "Disposable Cam - Alice & Bob",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id, name",
    });
    expect(folderId).toBe(fakeRootId);
  });
});
