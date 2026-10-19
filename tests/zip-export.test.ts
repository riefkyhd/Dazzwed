import { describe, it, expect } from "vitest";
import {
  calculateCrc32,
  toDosDateTime,
  sanitizeZipFilename,
  createStoredZipBlob,
  ZipEntry,
} from "@/lib/export/zip";

describe("PKZIP Store Export Library", () => {
  describe("calculateCrc32", () => {
    it("computes correct CRC-32 for known strings", () => {
      const encoder = new TextEncoder();
      // Standard CRC-32 of empty string is 0x00000000
      expect(calculateCrc32(new Uint8Array(0))).toBe(0);

      // Standard CRC-32 of "123456789" is 0xCBF43926 (3421780262)
      const data = encoder.encode("123456789");
      expect(calculateCrc32(data)).toBe(0xcbf43926);
    });

    it("computes deterministic CRC-32 for binary data", () => {
      const bin = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const crc1 = calculateCrc32(bin);
      const crc2 = calculateCrc32(bin);
      expect(crc1).toBe(crc2);
      expect(crc1).toBeGreaterThan(0);
    });
  });

  describe("toDosDateTime", () => {
    it("converts Date to valid MS-DOS 16-bit time and date", () => {
      const date = new Date(2026, 9, 19, 14, 30, 22); // Oct 19, 2026, 14:30:22
      const { time, date: dosDate } = toDosDateTime(date);

      expect(time).toBeGreaterThan(0);
      expect(dosDate).toBeGreaterThan(0);

      // Year relative to 1980: 2026 - 1980 = 46.
      // dosDate year is bits 9..15: (46 << 9)
      const year = (dosDate >> 9) + 1980;
      expect(year).toBe(2026);

      // Month: bits 5..8
      const month = (dosDate >> 5) & 0x0f;
      expect(month).toBe(10);

      // Day: bits 0..4
      const day = dosDate & 0x1f;
      expect(day).toBe(19);

      // Hour: bits 11..15
      const hours = (time >> 11) & 0x1f;
      expect(hours).toBe(14);

      // Minutes: bits 5..10
      const minutes = (time >> 5) & 0x3f;
      expect(minutes).toBe(30);
    });

    it("handles fallback gracefully for invalid or missing dates", () => {
      const { time, date } = toDosDateTime(new Date("invalid"));
      expect(time).toBeGreaterThanOrEqual(0);
      expect(date).toBeGreaterThanOrEqual(0);
    });
  });

  describe("sanitizeZipFilename", () => {
    it("strips path traversal and preserves safe alphanumeric characters", () => {
      expect(sanitizeZipFilename("../../etc/passwd")).toBe("etc/passwd");
      expect(sanitizeZipFilename("/absolute/path/photo.jpg")).toBe("absolute/path/photo.jpg");
      expect(sanitizeZipFilename("C:\\Windows\\System32\\file.jpg")).toBe("Windows/System32/file.jpg");
    });

    it("replaces special illegal characters with clean underscores", () => {
      expect(sanitizeZipFilename('Nadia & Rizky : Shot #1?.jpg')).toBe("Nadia_Rizky_Shot_1.jpg");
    });

    it("preserves guest folder structure with parentheses and spaces like Google Drive", () => {
      expect(sanitizeZipFilename("Dhifa (7K9X2B)/originals/01_7K9X2B_a8f2_raw.jpg")).toBe(
        "Dhifa (7K9X2B)/originals/01_7K9X2B_a8f2_raw.jpg"
      );
      expect(sanitizeZipFilename("Roll 7K9X2B/01_7K9X2B_a8f2_film.jpg")).toBe(
        "Roll 7K9X2B/01_7K9X2B_a8f2_film.jpg"
      );
    });

    it("handles empty or falsy inputs with default fallback", () => {
      expect(sanitizeZipFilename("")).toBe("photo.jpg");
      expect(sanitizeZipFilename("   ")).toBe("photo.jpg");
      expect(sanitizeZipFilename(null as any)).toBe("photo.jpg");
    });
  });

  describe("createStoredZipBlob", () => {
    it("assembles a valid PKZIP binary structure with local headers, central directory, and EOCD", async () => {
      const encoder = new TextEncoder();
      const file1Data = encoder.encode("Hello Dazzwed Wedding Photo 1");
      const file2Data = encoder.encode("Hello Dazzwed Wedding Photo 2 with more bytes");

      const entries: ZipEntry[] = [
        { filename: "Film/001_Nadia_film.jpg", data: file1Data, lastModified: new Date(2026, 9, 19, 12, 0) },
        { filename: "Original/001_Nadia_raw.jpg", data: file2Data, lastModified: new Date(2026, 9, 19, 12, 1) },
      ];

      const zipBlob = createStoredZipBlob(entries);
      expect(zipBlob).toBeInstanceOf(Blob);
      expect(zipBlob.type).toBe("application/zip");

      const buffer = await zipBlob.arrayBuffer();
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);

      // 1. First Local File Header signature: 0x04034b50
      expect(view.getUint32(0, true)).toBe(0x04034b50);

      // Check compression method is 0 (STORE)
      expect(view.getUint16(8, true)).toBe(0);

      // Check uncompressed and compressed sizes match
      expect(view.getUint32(18, true)).toBe(file1Data.byteLength);
      expect(view.getUint32(22, true)).toBe(file1Data.byteLength);

      // Check CRC matches file1
      expect(view.getUint32(14, true)).toBe(calculateCrc32(file1Data));

      // 2. Locate End of Central Directory (EOCD): 0x06054b50 at the end (22 bytes from end)
      const eocdOffset = buffer.byteLength - 22;
      expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);

      // Number of entries on disk and total entries should both be 2
      expect(view.getUint16(eocdOffset + 8, true)).toBe(2);
      expect(view.getUint16(eocdOffset + 10, true)).toBe(2);

      // Central directory offset
      const cdOffset = view.getUint32(eocdOffset + 16, true);
      expect(cdOffset).toBeGreaterThan(0);

      // 3. Central Directory Header signature: 0x02014b50
      expect(view.getUint32(cdOffset, true)).toBe(0x02014b50);

      // Second Central Directory Header signature
      const cd1FilenameLen = view.getUint16(cdOffset + 28, true);
      const cd2Offset = cdOffset + 46 + cd1FilenameLen;
      expect(view.getUint32(cd2Offset, true)).toBe(0x02014b50);
    });

    it("handles empty entries list safely", async () => {
      const zipBlob = createStoredZipBlob([]);
      const buffer = await zipBlob.arrayBuffer();
      const view = new DataView(buffer);

      // EOCD only (22 bytes)
      expect(buffer.byteLength).toBe(22);
      expect(view.getUint32(0, true)).toBe(0x06054b50);
      expect(view.getUint16(8, true)).toBe(0);
      expect(view.getUint16(10, true)).toBe(0);
    });

    it("is 100% extractable and valid according to standard unzip CLI", async () => {
      const { execSync } = await import("node:child_process");
      const { writeFileSync, unlinkSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");

      const encoder = new TextEncoder();
      const entries: ZipEntry[] = [
        {
          filename: "Film/001_Nadia_test.jpg",
          data: encoder.encode("Test JPEG payload 1"),
          lastModified: new Date("2026-10-19T10:00:00Z"),
        },
        {
          filename: "Original/001_Nadia_test.jpg",
          data: encoder.encode("Test JPEG payload 2"),
          lastModified: new Date("2026-10-19T10:01:00Z"),
        },
      ];

      const zipBlob = createStoredZipBlob(entries);
      const buffer = Buffer.from(await zipBlob.arrayBuffer());
      const tmpPath = join(tmpdir(), `test-dazzwed-${Date.now()}.zip`);

      try {
        writeFileSync(tmpPath, buffer);
        // unzip -t tests the integrity of the archive
        const output = execSync(`unzip -t "${tmpPath}"`, { encoding: "utf8" });
        expect(output).toContain("No errors detected in compressed data");
        expect(output).toContain("Film/001_Nadia_test.jpg");
        expect(output).toContain("Original/001_Nadia_test.jpg");
      } finally {
        try {
          unlinkSync(tmpPath);
        } catch {}
      }
    });
  });
});
