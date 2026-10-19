/**
 * Zero-dependency, type-safe PKZIP Store (Method 0) Archive Generator.
 * Assembles uncompressed ZIP archives directly in the browser or Node.js runtime.
 * JPEGs are already compressed; STORE mode produces an uncompressed ZIP in <50ms
 * with zero serverless timeout and zero CPU compression overhead.
 */

// Precomputed 256-entry CRC-32 polynomial table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * Calculates standard IEEE 802.3 CRC-32 checksum for a byte array.
 */
export function calculateCrc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Converts a JavaScript Date into MS-DOS 16-bit time and date fields.
 */
export function toDosDateTime(date: Date = new Date()): { time: number; date: number } {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const year = d.getFullYear();
  const dosYear = year < 1980 ? 0 : Math.min(year - 1980, 127);
  const dosDate = ((dosYear & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  const dosTime = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
  return { time: dosTime, date: dosDate };
}

export interface ZipEntry {
  filename: string;
  data: Uint8Array;
  lastModified?: Date;
}

/**
 * Sanitizes a string for use in a ZIP filename path.
 * Strips dangerous traversal sequences (../, absolute slashes), control characters, and reserved symbols.
 */
export function sanitizeZipFilename(rawName: string, fallback = "photo.jpg"): string {
  if (!rawName || typeof rawName !== "string") return fallback;

  // Normalize slashes and remove leading slashes / drive letters
  let cleaned = rawName
    .replace(/\\/g, "/")
    .replace(/^([a-zA-Z]:|\/)+/, "")
    .replace(/\0/g, "");

  // Prevent path traversal and clean special characters
  const segments = cleaned
    .split("/")
    .map((s) =>
      s
        .replace(/[^a-zA-Z0-9_\-.]/g, "_")
        .replace(/_+/g, "_")
        .replace(/_+(\.[a-zA-Z0-9]+)$/, "$1")
        .replace(/^_+|_+$/g, "")
        .trim()
    )
    .filter((s) => s.length > 0 && s !== ".." && s !== ".");

  if (segments.length === 0) return fallback;
  return segments.join("/");
}

/**
 * Creates a valid PKZIP STORE (Method 0) Blob from a list of file entries.
 */
export function createStoredZipBlob(entries: ZipEntry[]): Blob {
  const textEncoder = new TextEncoder();
  const fileChunks: (Uint8Array | Blob)[] = [];
  const centralDirHeaders: Uint8Array[] = [];

  let currentOffset = 0;

  for (const entry of entries) {
    const sanitizedName = sanitizeZipFilename(entry.filename);
    const nameBytes = textEncoder.encode(sanitizedName);
    const dataBytes = entry.data;
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.byteLength;
    const { time: dosTime, date: dosDate } = toDosDateTime(entry.lastModified);

    // 1. Local File Header (30 bytes + filename)
    // 0x04034b50
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local header signature
    lv.setUint16(4, 20, true);          // Version needed: 2.0 (standard compatibility)
    lv.setUint16(6, 0x0800, true);      // Flags: Bit 11 set for UTF-8 filename
    lv.setUint16(8, 0, true);           // Compression: 0 = STORE (uncompressed)
    lv.setUint16(10, dosTime, true);    // Last mod time
    lv.setUint16(12, dosDate, true);    // Last mod date
    lv.setUint32(14, crc, true);        // CRC-32
    lv.setUint32(18, size, true);       // Compressed size
    lv.setUint32(22, size, true);       // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true);          // Extra field length
    localHeader.set(nameBytes, 30);

    // Append to zip payload
    fileChunks.push(localHeader);
    fileChunks.push(dataBytes);

    // 2. Central Directory Header (46 bytes + filename)
    // 0x02014b50
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);

    cv.setUint32(0, 0x02014b50, true);  // Central directory signature
    cv.setUint16(4, 20, true);          // Version made by: 2.0
    cv.setUint16(6, 20, true);          // Version needed: 2.0
    cv.setUint16(8, 0x0800, true);      // Flags: UTF-8
    cv.setUint16(10, 0, true);          // Compression: STORE
    cv.setUint16(12, dosTime, true);    // Last mod time
    cv.setUint16(14, dosDate, true);    // Last mod date
    cv.setUint32(16, crc, true);        // CRC-32
    cv.setUint32(20, size, true);       // Compressed size
    cv.setUint32(24, size, true);       // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // File name length
    cv.setUint16(30, 0, true);          // Extra field length
    cv.setUint16(32, 0, true);          // Comment length
    cv.setUint16(34, 0, true);          // Disk number start
    cv.setUint16(36, 0, true);          // Internal attributes
    cv.setUint32(38, 0, true);          // External attributes
    cv.setUint32(42, currentOffset, true); // Local header offset
    cdHeader.set(nameBytes, 46);

    centralDirHeaders.push(cdHeader);

    // Advance offset
    currentOffset += localHeader.length + size;
  }

  // Calculate central directory size
  const centralDirStartOffset = currentOffset;
  let centralDirSize = 0;
  for (const h of centralDirHeaders) {
    centralDirSize += h.length;
    fileChunks.push(h);
  }

  // 3. End of Central Directory Record (22 bytes)
  // 0x06054b50
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);

  ev.setUint32(0, 0x06054b50, true);          // EOCD signature
  ev.setUint16(4, 0, true);                   // Disk number
  ev.setUint16(6, 0, true);                   // Start disk
  ev.setUint16(8, entries.length, true);      // Entries on this disk
  ev.setUint16(10, entries.length, true);     // Total entries
  ev.setUint32(12, centralDirSize, true);     // Size of central directory
  ev.setUint32(16, centralDirStartOffset, true); // Offset of central directory
  ev.setUint16(20, 0, true);                  // Comment length

  fileChunks.push(eocd);

  return new Blob(fileChunks as unknown as BlobPart[], { type: "application/zip" });
}

/**
 * Triggers a native browser file download for a Blob.
 */
export function downloadBlobInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  // Defer cleanup so browser has time to initiate stream
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
}
