import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase/auth", () => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/drive/client", () => ({
  resolveDriveTokens: vi.fn(),
  getDriveClient: vi.fn(),
  getOAuth2Client: vi.fn(),
}));

import { GET } from "@/app/api/admin/photos/[id]/route";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveDriveTokens, getDriveClient, getOAuth2Client } from "@/lib/drive/client";
import { Readable } from "node:stream";

describe("GET /api/admin/photos/[id] Image Proxy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 if user is not authenticated as admin", async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/photos/drive-123");
    const res = await GET(req, { params: Promise.resolve({ id: "drive-123" }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 if photo UUID is not found in database", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@example.com" } as any);
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const orMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ or: orMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(supabaseAdmin).mockReturnValue({ from: fromMock } as any);

    const uuid = "11111111-1111-1111-1111-111111111111";
    const req = new Request(`http://localhost/api/admin/photos/${uuid}`);
    const res = await GET(req, { params: Promise.resolve({ id: uuid }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Photo not found");
  });

  it("returns 503 if Google Drive is not linked", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@example.com" } as any);
    vi.mocked(resolveDriveTokens).mockResolvedValue({ refreshToken: null, rootFolderId: null });

    const req = new Request("http://localhost/api/admin/photos/drive-abc");
    const res = await GET(req, { params: Promise.resolve({ id: "drive-abc" }) });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("Google Drive is not linked");
  });

  it("streams resized =s800 thumbnail with immutable caching headers", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@example.com" } as any);
    vi.mocked(resolveDriveTokens).mockResolvedValue({ refreshToken: "mock-refresh-token", rootFolderId: "root-123" });

    const mockDrive = {
      files: {
        get: vi.fn().mockResolvedValue({
          data: {
            id: "drive-abc",
            thumbnailLink: "https://lh3.googleusercontent.com/test=s220",
          },
        }),
      },
    };
    vi.mocked(getDriveClient).mockReturnValue(mockDrive as any);

    const mockOAuth2 = {
      setCredentials: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue({ token: "mock-access-token" }),
    };
    vi.mocked(getOAuth2Client).mockReturnValue(mockOAuth2 as any);

    // Mock fetch for Google CDN thumbnail
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    );
    global.fetch = fetchMock;

    try {
      const req = new Request("http://localhost/api/admin/photos/drive-abc?size=grid");
      const res = await GET(req, { params: Promise.resolve({ id: "drive-abc" }) });

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://lh3.googleusercontent.com/test=s800",
        expect.objectContaining({
          headers: { Authorization: "Bearer mock-access-token" },
        })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("sets Content-Disposition attachment on download=1", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@example.com" } as any);
    vi.mocked(resolveDriveTokens).mockResolvedValue({ refreshToken: "mock-refresh-token", rootFolderId: "root-123" });

    const nodeStream = Readable.from(["fake-image-bytes"]);
    const mockDrive = {
      files: {
        get: vi.fn().mockResolvedValue({
          data: nodeStream,
        }),
      },
    };
    vi.mocked(getDriveClient).mockReturnValue(mockDrive as any);

    const req = new Request("http://localhost/api/admin/photos/drive-abc?size=original&download=1");
    const res = await GET(req, { params: Promise.resolve({ id: "drive-abc" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  });

  it("returns 404 with Cache-Control: no-store when file was deleted from Google Drive", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@example.com" } as any);
    vi.mocked(resolveDriveTokens).mockResolvedValue({ refreshToken: "mock-refresh-token", rootFolderId: "root-123" });

    const notFoundError = new Error("File not found: 1sTj6--CL46M0h5vqiFadozmafaQsBW3k");
    (notFoundError as any).status = 404;

    const mockDrive = {
      files: {
        get: vi.fn().mockRejectedValue(notFoundError),
      },
    };
    vi.mocked(getDriveClient).mockReturnValue(mockDrive as any);

    const req = new Request("http://localhost/api/admin/photos/drive-deleted-123");
    const res = await GET(req, { params: Promise.resolve({ id: "drive-deleted-123" }) });

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json();
    expect(json.code).toBe("DRIVE_FILE_NOT_FOUND");
    expect(json.error).toBe("File removed from Google Drive");
  });
});
