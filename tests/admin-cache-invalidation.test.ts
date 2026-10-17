import { describe, it, expect } from "vitest";
import * as qrPage from "@/app/admin/qr/page";
import * as settingsPage from "@/app/admin/settings/page";
import * as settingsRoute from "@/app/api/admin/settings/route";
import * as tokenRoute from "@/app/api/admin/events/token/route";
import * as resetRoute from "@/app/api/admin/settings/reset-sessions/route";

describe("Admin Settings & QR Cache Invalidation Architecture", () => {
  it("exports force-dynamic and revalidate = 0 on /admin/qr page to prevent stale cache snapshots", () => {
    expect(qrPage.dynamic).toBe("force-dynamic");
    expect(qrPage.revalidate).toBe(0);
  });

  it("exports force-dynamic and revalidate = 0 on /admin/settings page", () => {
    expect(settingsPage.dynamic).toBe("force-dynamic");
    expect(settingsPage.revalidate).toBe(0);
  });

  it("exports force-dynamic on admin settings, token, and session reset mutation routes", () => {
    expect(settingsRoute.dynamic).toBe("force-dynamic");
    expect(tokenRoute.dynamic).toBe("force-dynamic");
    expect(resetRoute.dynamic).toBe("force-dynamic");
  });
});
