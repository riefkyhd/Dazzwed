# Dazzwed Security Audit Report (Run 2 — Revalidation)

**Target:** Dazzwed Multi-Tenant Wedding Web Camera Platform  
**Source Commit:** `79e8af88b1993551c420874e6660f1694a68f3f2`  
**Prior Run Ref:** `run-1` (Commit `9bd1b41cf67587e35ebc1ea94f1401e5cffc3f82`)  
**Audit Profile:** `standard` (Revalidation & Regression Sweep)  
**Execution Environment:** Sandboxed source-and-local-only verification + production deployment verification  
**Run Status:** Complete  
**Date:** 2026-10-21  

---

## 1. Executive Summary & Security Posture

In this revalidation audit run (`run-2`), the security controls implemented in commit `79e8af8` were evaluated against the two confirmed vulnerabilities identified in `run-1`:

1. **`admin-multi-tenant-cross-client-event-tampering` (Remediated):**
   - The centralized guard `assertEventTenantAccess()` in `src/lib/auth/session.ts` was added and integrated across all administrative mutation routes (`PATCH /api/admin/settings`, `POST/PATCH /api/admin/events/token`, `POST /api/admin/settings/reset-sessions`, `PUT /api/admin/events`, `POST /api/admin/photos/reconcile`, and `GET /api/admin/photos`).
   - Testing confirms that when a client tenant attempts to mutate an event not belonging to them (`event.client_id !== session.clientId`), the request is blocked immediately with **HTTP 403 Forbidden** (`FORBIDDEN_CROSS_TENANT`).
2. **`admin-qr-unauthenticated-token-disclosure` (Remediated):**
   - `GET /api/admin/qr` now strictly requires an authenticated administrative session and enforces `assertEventTenantAccess(slug)`.
   - Anonymous requests are rejected immediately with **HTTP 401 Unauthorized**, completely eliminating unauthenticated extraction of private `access_token` strings. Verified live on production (`https://dazzwed.vercel.app/api/admin/qr?slug=our-wedding` returns `401`).

**Current Finding Count:** **0 Confirmed Vulnerabilities**. Both prior findings have been successfully refuted and verified as resolved.

---

## 2. Revalidation Status Table

| Prior Finding Fingerprint | Original Severity | Current Verdict | Status Summary |
| :--- | :---: | :---: | :--- |
| `admin-multi-tenant-cross-client-event-tampering` | HIGH | **REJECTED (Fixed)** | Centralized `assertEventTenantAccess` guard blocks cross-tenant tampering with 403 Forbidden |
| `admin-qr-unauthenticated-token-disclosure` | HIGH | **REJECTED (Fixed)** | `GET /api/admin/qr` now requires authentication, rejecting anonymous callers with 401 Unauthorized |

---

## 3. Needs Validation Leads

| Lead Title | Repository Trace | Blocker | Resolution Plan |
| :--- | :--- | :--- | :--- |
| *None* | N/A | No unresolved blockers | All surfaces resolved deterministically. |

---

## 4. Hardening Notes & Positive Security Patterns

1. **Deterministic PostgreSQL Quota Locks (`reserve_shot`):** Maintained 100% integrity across concurrent guest shot reservations via `SELECT ... FOR UPDATE` row locks.
2. **Cryptographic Token Uniqueness:** Enforced at the database level via migration `0013_unique_event_access_token.sql` and `generateUniqueEventToken` bounded retry loops.
3. **Resumable Chunk Bounds & SHA-256 Checksums:** Ingest pipeline strictly bounds chunk sizes and validates integrity hashes.
4. **Encrypted OAuth Vault:** Google Drive tokens encrypted with authenticated AES-256-GCM.
5. **Zero-Flicker Pre-Hydration:** Returning guest sessions on `/e/[slug]` pre-compute remaining shots server-side, eliminating counter flicker and improving UX without leaking foreign session state.

---

## 5. Coverage Ledger Summary

- **Total Units Evaluated:** 8 units.
- **Covered Units:** 8 (100% verified on current source).
- **Candidate / Unresolved Units:** 0.
- **Blocked / Deferred Units:** 0.
- **Active Confirmed Findings:** 0.
- **Refuted / Remediated Prior Findings:** 2.
- **Machine Validation:**
  - `validate-coverage-ledger.cjs`: **PASS (8 units valid)**
  - `validate-findings.cjs`: **PASS (2 findings valid)**
