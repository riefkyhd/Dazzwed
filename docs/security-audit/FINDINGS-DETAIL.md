# Dazzwed Security Audit (Run 2) — Findings Detail & Verification

**Target Commit:** `79e8af88b1993551c420874e6660f1694a68f3f2`  
**Run Status:** Complete  

---

## Active Confirmed Findings (0)

No confirmed vulnerabilities exist on commit `79e8af88b1993551c420874e6660f1694a68f3f2`.

---

## Refuted & Remediated Prior Findings (2)

### 1. `admin-multi-tenant-cross-client-event-tampering`
- **Prior Severity:** HIGH
- **Current Verdict:** Rejected (Remediated)
- **Claimed Root Cause:** Route handlers verified authentication via `getAdminUser()` but omitted tenant ownership checks before executing `supabaseAdmin` updates on caller-supplied event IDs.
- **Current Defense Invariant:**
  [`assertEventTenantAccess()`](file:///Users/administrator/Documents/Kiki/Dazzwed/src/lib/auth/session.ts#L168-L230) is executed prior to any event modification in:
  - `PATCH /api/admin/settings`
  - `POST` & `PATCH /api/admin/events/token`
  - `POST /api/admin/settings/reset-sessions`
  - `PUT /api/admin/events`
  When `session.role === 'client'`, if `event.client_id !== session.clientId`, the request is immediately rejected with HTTP `403 Forbidden` (`FORBIDDEN_CROSS_TENANT`).
- **Independent Verification:** Tested via automated regression test `tests/security-audit-remediation.test.ts` (passed).

### 2. `admin-qr-unauthenticated-token-disclosure`
- **Prior Severity:** HIGH
- **Current Verdict:** Rejected (Remediated)
- **Claimed Root Cause:** `GET /api/admin/qr` lacked session checks and automatically retrieved and embedded `access_token` into SVG/PNG images.
- **Current Defense Invariant:**
  [`GET /api/admin/qr`](file:///Users/administrator/Documents/Kiki/Dazzwed/src/app/api/admin/qr/route.ts#L8-L30) now calls `assertEventTenantAccess(slug)` before processing. Anonymous callers receive HTTP `401 Unauthorized`.
- **Independent Verification:** Tested live on production deployment (`https://dazzwed.vercel.app/api/admin/qr?slug=our-wedding` returns HTTP 401) and via automated test `tests/security-audit-remediation.test.ts` (passed).
