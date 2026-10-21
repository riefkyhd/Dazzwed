# Architecture & Attack Surface Analysis

**Target**: Dazzwed (Unveiled)  
**Commit**: `9bd1b41cf67587e35ebc1ea94f1401e5cffc3f82`  
**Profile**: `standard`  

---

## 1. Product & Security Model
Dazzwed is a multi-tenant digital disposable camera platform for weddings. Guests scan physical QR codes at event venues, take analog film-simulated pictures directly in mobile browsers, and upload them to a centralized Google Drive vault in real-time.

### Principals & Privilege Hierarchy
- **Anonymous Public User**: Can view landing page `/` and public static assets.
- **Wedding Guest**: Scans `/e/[slug]?t=[access_token]`. Must supply a valid event token. On registration (`POST /api/guests`), receives a scoped `dz_guest_session` UUID cookie. May reserve up to `shots_per_guest` exposures via atomic `reserve_shot` RPC and upload image chunks.
- **Client Host (The Couple)**: Authenticated via `/api/auth/login` (`role: client`). Bound to their `client_id` in database. Can manage their assigned event(s), rotate tokens, toggle photos (`hide`/`unhide`), trigger PKZIP downloads, and run drive health diagnostics.
- **Platform Superadmin**: Authenticated via `/api/auth/login` (`role: superadmin`). Unrestricted platform console (`/superadmin`), connects global Google Drive OAuth vault (`/admin/connect-drive`), provisions client accounts, adjusts package quotas.
- **Cron / System Tasks**: Invocations to `/api/cron/*` protected by bearer secret headers.

---

## 2. Tech Stack & Runtimes
- **Framework**: Next.js 16 (App Router with Turbopack, React 19).
- **Backend / Database**: Supabase (PostgreSQL with Row Level Security, custom PL/pgSQL functions, and PGlite local harness).
- **Storage**: Google Drive API v3 (resumable multi-chunk uploads, AES-256-GCM token encryption).
- **Authentication**: Custom cryptographic HMAC SHA-256 session tokens (`dazzwed_auth_session`) with scrypt password hashing and instant database status revocation.

---

## 3. Trust Boundaries & Core Controls
1. **TB1: Guest Link & Token Ingress (`/e/[slug]?t=`)**: Enforces constant-time `validateEventToken` comparison against `public.events.access_token`. Rejects mutated or expired tokens immediately even if a browser session cookie exists.
2. **TB2: Guest Quota & Shot Reservation (`/api/photos/init`)**: Enforced at the database transaction layer via `public.reserve_shot` function with `FOR UPDATE` row-level locks, preventing concurrency race conditions or client-side quota bypasses.
3. **TB3: Photo Ingress & Resumable Chunk Processing (`/api/photos/chunk`)**: Validates chunk size bounds, cryptographic SHA-256 payload integrity, and limits chunk uploads to actively pending reservations.
4. **TB4: Multi-Tenant RBAC & Client Host Scoping (`/api/admin/*`, `/superadmin/*`)**: Resolves session role (`client` vs `superadmin`). Validates active client status in PostgreSQL on every request. Scopes database queries to `client_id`.
5. **TB5: Google Drive Credential & Vault Isolation**: Platform refresh tokens are encrypted at rest using AES-256-GCM. Client hosts can execute non-destructive connection health checks (`/api/admin/drive-health`), but OAuth connection endpoints (`/api/auth/google/start`) are strictly restricted to Superadmins.

---

## 4. Prior Coverage & Exclusions
Initial clean security audit run (`run-1`). No prior coverage ledgers exist.

---

## 5. Companion Selection
- `WEB-PROTOCOL-AND-AUTH.md`: Covers session management, OAuth callback flow, token rotation, and timing side-channel protections.
- `DATA-ISOLATION-AND-LIFECYCLE.md`: Covers multi-tenant client isolation, photo deletion/hiding, and drive reconciliation.
- `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`: Covers storage guard thresholds (85% warning, 98% halt), chunk upload size limits, and rate-limiting.
- `CLIENT-SIDE.md`: Covers camera state persistence, IndexedDB offline queues, and token reflection in QR stationery.
- `CLOUD-AND-DEPLOYMENT.md`: Covers Vercel serverless environment variables, Supabase service role keys, and Google Drive scopes.
