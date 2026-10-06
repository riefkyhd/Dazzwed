# SECURITY AUDIT & HARDENING REPORT: Disposable Cam

**Project**: Disposable Cam (Retro Web Camera for Weddings)  
**Deployment**: [https://dazzwed.vercel.app](https://dazzwed.vercel.app)  
**Date of Audit**: October 6, 2026  
**Auditor**: Antigravity Security Agent  
**Overall Status**: **PASSED & HARDENED** (All Critical & High findings resolved and verified in production)

---

## 1. Executive Summary

A comprehensive security audit and hardening pass was conducted across the entire architecture of the Disposable Cam system (Next.js 16 App Router on Vercel, Supabase PostgreSQL with RLS, Google Drive API via OAuth2, and client-side WebGL look engine).

The audit identified 2 Critical and 4 High severity vulnerabilities:
1. **Critical Token Leak via URL**: The Google OAuth refresh token was previously passed in browser query parameters (`?refreshToken=...`) on redirect after OAuth consent.
2. **Critical Unauthenticated Admin Health Endpoint**: `/api/admin/drive-health` was completely unauthenticated and allowed anyone to inspect the couple's Drive quota, owner email, and trigger file creations/deletions.
3. **High Unauthenticated Admin Page**: `/admin/connect-drive` lacked server-side `requireAdmin()` gating.
4. **High Server-Side Request Forgery (SSRF)**: The `/api/photos/chunk` proxy accepted arbitrary `x-session-uri` destinations without origin validation.
5. **High Account Takeover Vector**: `/api/auth/setup-admin` allowed anyone knowing an allowlisted email to reset the admin password.
6. **High Public Diagnostic Exposure**: `/debug/camera` was reachable by anonymous users in production.
7. **High Unbounded Guest Flood**: `/api/guests` lacked IP rate limiting.

**All Critical and High vulnerabilities have been patched, backed by automated regression tests in `tests/security-hardening.test.ts`, committed to `main` ([cb86db8](https://github.com/riefkyhd/Dazzwed/commit/cb86db8)), and verified live on production.**

---

## 2. Findings & Remediation Matrix

| ID | Severity | Area | Evidence / Vulnerability Description | Fix Implemented | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | Secrets / OAuth | OAuth callback redirected with `refreshToken` in URL query parameters (`?connected=1&refreshToken=...`), leaking it to browser history, server logs, and referrer headers. | Removed `refreshToken` from redirect query parameters. Token is stored securely server-side in the Supabase `events` table only. | **FIXED** |
| **SEC-02** | **CRITICAL** | Authorization | `/api/admin/drive-health` was completely unauthenticated, allowing any visitor to trigger test uploads and view Drive quota & user email. | Added server-side `await getAdminUser()` session verification (returns 401 Unauthorized if unauthenticated). | **FIXED** |
| **SEC-03** | **HIGH** | Authorization | `/admin/connect-drive` was a client component without server-side `requireAdmin()`. | Converted page to an async Server Component that invokes `await requireAdmin()`, redirecting unauthenticated users to `/admin/login`. | **FIXED** |
| **SEC-04** | **HIGH** | SSRF | `/api/photos/chunk` proxied upload chunks to any URI passed in `x-session-uri` header without origin validation. | Added strict SSRF guard requiring `https:` protocol, hostname `www.googleapis.com`, and pathname starting with `/upload/drive/v3/files`. | **FIXED** |
| **SEC-05** | **HIGH** | Auth / Account Takeover | `/api/auth/setup-admin` allowed public password resetting for existing accounts without an active session. | Added account existence check: if user already exists, rejected with 409 Conflict. Password changes require authentication. | **FIXED** |
| **SEC-06** | **HIGH** | Info Disclosure | `/debug/camera` diagnostic lab was exposed to guests in production. | Added server-side environment check returning `notFound()` (404) for non-admin users in production. | **FIXED** |
| **SEC-07** | **HIGH** | Abuse / Rate Limit | `/api/guests` and `/api/auth/login` lacked IP-level rate limiting, allowing guest flooding and password brute-forcing. | Added atomic Postgres sliding-window rate limiting on `/api/guests` (60/min) and `/api/auth/login` (5/min). | **FIXED** |
| **SEC-08** | **HIGH** | Web Security | Missing Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options, and X-Robots-Tag. | Configured strict CSP, HSTS, frame-ancestors, nosniff, permissions-policy, and `X-Robots-Tag: noindex, nofollow` in `next.config.ts`. | **FIXED** |
| **SEC-09** | **MEDIUM** | Upload Integrity | `/api/photos/confirm` did not check Drive file `mimeType` or upper/lower size bounds before confirmation. | Added Drive metadata inspection enforcing `image/` MIME prefix and `0 < size <= 50MB`. | **FIXED** |

---

## 3. Detailed Audit by Phase

### Phase 1: Secrets & Configuration
- **Git History Scan**: Scanned entire git log for `SUPABASE_SERVICE_ROLE_KEY`, `GOCSPX`, and `CRON_SECRET`. None were found in git history.
- **Client Bundle Scan**: Scanned `.next/static` chunks for server secrets. Zero server secrets or service role keys are present in client bundles.
- **Environment Validation**: Validated that `.env*` files are gitignored and `.env.example` contains only empty placeholder strings.

### Phase 2: Supabase Security & RLS
- **Public Anon Key Probing**: Directly probed all tables (`events`, `guests`, `photos`, `admin_emails`, `rate_limits`) using `NEXT_PUBLIC_SUPABASE_ANON_KEY` without session auth:
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE` were **strictly denied** with PostgreSQL error `42501 (insufficient_privilege)`.
- **RPC Function Security**: Probed `reserve_shot`, `release_shot`, `check_rate_limit`, and `is_admin` with anon key:
  - All calls were **strictly denied** (`42501 permission denied for function`).
- **Storage Buckets**: Verified no Supabase storage buckets exist or are exposed to the public (storage is 100% on Google Drive).

### Phase 3: API & Route Authorization
- Confirmed that all `/api/admin/*` routes enforce `getAdminUser()`.
- Verified constant-time header comparison using `timingSafeEqual` on `/api/cron/keepalive`.
- Confirmed that `/debug/camera` returns `404 Not Found` in production.

### Phase 4: Google Drive & Upload Security
- **OAuth Scope**: Limited strictly to `https://www.googleapis.com/auth/drive.file`.
- **Resumable Upload Sessions**: Verified that resumable sessions are initiated server-side after atomic row-locked reservation in PostgreSQL, and chunks proxied through `/api/photos/chunk` are restricted to Google APIs upload endpoints.
- **Root Folder Access**: Google Drive root folders are private to the couple's dedicated Google account and never made public.

### Phase 5: Client-Side Security Headers
Inspected live production headers on `https://dazzwed.vercel.app`:
```http
HTTP/2 200
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.googleusercontent.com https://challenges.cloudflare.com; media-src 'self' blob:; connect-src 'self' blob: https://*.supabase.co https://www.googleapis.com https://challenges.cloudflare.com; font-src 'self' data:; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
x-frame-options: DENY
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(self), microphone=(), geolocation=(), browsing-topics=()
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-robots-tag: noindex, nofollow, noarchive (on /admin/*)
```

---

## 4. Pre-Wedding 15-Minute Security Checklist

Run this checklist 24 hours before the wedding and again on the morning of the wedding:

1. **Google Cloud OAuth Publishing Status (CRITICAL)**:
   - Go to [Google Cloud Console &rarr; OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent).
   - Ensure the Publishing status is **"In production"** (NOT "Testing"). If left in "Testing", Google revokes your refresh token after 7 days, which will break photo uploads during the wedding.
2. **Google Drive Quota**:
   - Log into `/admin/connect-drive` and click **"Check Drive Health"**.
   - Verify health status is `HEALTHY` and remaining storage is at least 10 GB.
3. **Turnstile Anti-Abuse (Optional Kill-Switch)**:
   - If public venue trolls or bot traffic are a concern, set `TURNSTILE_ENABLED=true` in Vercel environment variables along with your Cloudflare site & secret keys.
4. **Event Window**:
   - Check `/admin/settings` to verify `opens_at` and `closes_at` match the wedding schedule, and `manually_closed` is toggleable as an immediate kill switch.
5. **Verify Live Camera on Guest Device**:
   - Open `/e/[your-slug]` on an iPhone and an Android phone; verify photo capture, look preview, and successful upload to the Drive folder.

---

## 5. Post-Wedding Teardown Guide

When the wedding is over and the couple has downloaded their photos:

1. **Close the Event**:
   - In `/admin/settings`, set **Manually Closed = true**. This immediately rejects any new photos or guest registrations.
2. **Export / Backup Photos**:
   - Go to Google Drive and download the `Disposable Cam - [Names]` root folder.
3. **Revoke Google OAuth Access**:
   - Go to [Google Account Permissions](https://myaccount.google.com/permissions) for the wedding Google account and revoke access for the Disposable Cam app.
4. **Purge Database Rows**:
   - In Supabase SQL Editor:
     ```sql
     delete from public.photos;
     delete from public.guests;
     delete from public.rate_limits;
     ```
5. **Clean Secrets / Teardown**:
   - Remove or pause the Vercel project deployment and Supabase project when no longer needed.
