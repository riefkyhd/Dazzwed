import { describe, expect, it, vi } from "vitest";
import { generatePhotoFilename, uploadPhotoToDrive } from "@/lib/drive/upload";
import { createRootFolder } from "@/lib/drive/folders";
import type { drive_v3 } from "googleapis";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

describe("Google Drive Photo Uploads", () => {
  it("formats photo filenames cleanly with ISO timestamp, sanitized roll code, and shot count without PII", () => {
    const fixedDate = new Date("2026-10-05T12:34:56.789Z");
    const filename = generatePhotoFilename("7K9X2B", 3, fixedDate);

    expect(filename).toBe("2026-10-05T12-34-56_7K9X2B_3.jpg");
  });

  it("handles empty or special character roll codes gracefully by falling back to roll", () => {
    const fixedDate = new Date("2026-10-05T12:00:00.000Z");
    const filename = generatePhotoFilename("!!!", 1, fixedDate);

    expect(filename).toBe("2026-10-05T12-00-00_roll_1.jpg");
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

  it("isolates guests with identical display names into separate Drive folders via unique roll code", async () => {
    const { ensureGuestFolder } = await import("@/lib/drive/folders");
    const { computeRollCodeFromGuestId } = await import("@/lib/guest/session");

    const createdFolders: { name: string; id: string }[] = [];
    const mockDrive = {
      files: {
        create: vi.fn().mockImplementation(async ({ requestBody }) => {
          const id = `folder-${requestBody.name}`;
          createdFolders.push({ name: requestBody.name, id });
          return { data: { id } };
        }),
      },
    } as unknown as drive_v3.Drive;

    const guest1Id = "11111111-1111-4111-8111-111111111111";
    const guest2Id = "22222222-2222-4222-8222-222222222222";
    const sameName = "Riefky";

    const code1 = computeRollCodeFromGuestId(guest1Id);
    const code2 = computeRollCodeFromGuestId(guest2Id);
    expect(code1).not.toBe(code2);

    const folder1 = await ensureGuestFolder(mockDrive, "root-100", guest1Id, sameName);
    const folder2 = await ensureGuestFolder(mockDrive, "root-100", guest2Id, sameName);

    expect(folder1).not.toBe(folder2);
    expect(createdFolders.some(f => f.name === `${sameName} (${code1})`)).toBe(true);
    expect(createdFolders.some(f => f.name === `${sameName} (${code2})`)).toBe(true);

    // Also verify null/empty display name falls back cleanly to Roll <code3>
    const guest3Id = "33333333-3333-4333-8333-333333333333";
    const code3 = computeRollCodeFromGuestId(guest3Id);
    await ensureGuestFolder(mockDrive, "root-100", guest3Id, null);
    expect(createdFolders.some(f => f.name === `Roll ${code3}`)).toBe(true);
  });
});
