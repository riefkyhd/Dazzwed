import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/drive/health", () => ({
  checkDriveHealth: vi.fn(),
}));

import { GET, POST } from "@/app/api/admin/drive-health/route";
import { getAuthSession } from "@/lib/auth/session";
import { checkDriveHealth } from "@/lib/drive/health";

describe("GET & POST /api/admin/drive-health (RBAC for Superadmins & Clients)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 Unauthorized if no active session exists", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const resGet = await GET();
    expect(resGet.status).toBe(401);
    const jsonGet = await resGet.json();
    expect(jsonGet.error).toBe("Unauthorized");

    const resPost = await POST();
    expect(resPost.status).toBe(401);
    const jsonPost = await resPost.json();
    expect(jsonPost.error).toBe("Unauthorized");
  });

  it("allows superadmin session and returns 200 with drive health", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      role: "superadmin",
      email: "owner@dazzwed.my.id",
      name: "Platform Owner",
    });

    vi.mocked(checkDriveHealth).mockResolvedValue({
      ok: true,
      userEmail: "dazzwed.vault@gmail.com",
      storageQuota: {
        limitBytes: 400 * 1024 * 1024 * 1024,
        usageBytes: 15 * 1024 * 1024 * 1024,
        usageInDriveBytes: 15 * 1024 * 1024 * 1024,
        usageInDriveTrashBytes: 0,
        remainingBytes: 385 * 1024 * 1024 * 1024,
      },
      testUploadOk: true,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.userEmail).toBe("dazzwed.vault@gmail.com");
  });

  it("allows client host session (e.g. Dinda & Harsya) and returns 200 without 403 Forbidden", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      role: "client",
      clientId: "client-dinda-harsya-uuid",
      email: "dinda.harsya@example.com",
      name: "Dinda & Harsya",
      maxEvents: 1,
    });

    vi.mocked(checkDriveHealth).mockResolvedValue({
      ok: true,
      userEmail: "dazzwed.vault@gmail.com",
      storageQuota: {
        limitBytes: 400 * 1024 * 1024 * 1024,
        usageBytes: 20 * 1024 * 1024 * 1024,
        usageInDriveBytes: 20 * 1024 * 1024 * 1024,
        usageInDriveTrashBytes: 0,
        remainingBytes: 380 * 1024 * 1024 * 1024,
      },
      testUploadOk: true,
    });

    // Test GET
    const resGet = await GET();
    expect(resGet.status).toBe(200);
    const jsonGet = await resGet.json();
    expect(jsonGet.ok).toBe(true);
    expect(jsonGet.testUploadOk).toBe(true);

    // Test POST
    const resPost = await POST();
    expect(resPost.status).toBe(200);
    const jsonPost = await resPost.json();
    expect(jsonPost.ok).toBe(true);
  });
});
