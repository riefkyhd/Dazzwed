# Dazzwed Architecture and Trust Boundaries (Run 2 — Revalidation)

**Target:** Dazzwed (Next.js 16 + React 19 + Supabase + Google Drive)  
**Source Commit:** `79e8af88b1993551c420874e6660f1694a68f3f2`  
**Prior Run:** `run-1` (Commit `9bd1b41cf67587e35ebc1ea94f1401e5cffc3f82`)  
**Objective:** Independent revalidation of prior confirmed findings after multi-tenant guard implementation.  

---

## 1. Core Architectural Principals

1. **Anonymous / Semi-Anonymous Guest:** Attendees scanning physical QR posters at wedding venues. Possess ephemeral UUID guest cookies and localized 6-character roll codes.
2. **Client Host (Tenant):** Authenticated wedding couples or event planners (`session.role === 'client'`). Scope is strictly confined to events where `events.client_id = session.clientId`.
3. **Superadmin (Platform Owner):** Platform administrator managing all clients, platform quotas, and root Google Drive vault connections (`session.role === 'superadmin'`).
4. **Cloud Database (Supabase / PostgreSQL):** Stores relational state, row-level concurrency locks (`SELECT FOR UPDATE`), client accounts, and encrypted credentials.
5. **Archival Cloud Vault (Google Drive):** Stores original and stylized photo binaries organized into hierarchical guest folders.

---

## 2. Core Trust Boundaries (Revalidated)

- **Boundary 1: Administrative Multi-Tenant Isolation:**
  - *Prior State (Run 1):* Missing client ownership checks in mutation endpoints allowed cross-tenant IDOR tampering.
  - *Current State (Run 2):* Handled centrally by `assertEventTenantAccess()` in `src/lib/auth/session.ts`. Enforced across `PATCH /api/admin/settings`, `POST/PATCH /api/admin/events/token`, `POST /api/admin/settings/reset-sessions`, `PUT /api/admin/events`, `POST /api/admin/photos/reconcile`, and `GET /api/admin/photos`.
- **Boundary 2: QR Asset Generation and Access Token Exposure:**
  - *Prior State (Run 1):* `GET /api/admin/qr` was completely unauthenticated and disclosed cleartext `access_token` in rendered QR images.
  - *Current State (Run 2):* Enforces `assertEventTenantAccess(slug)`, returning 401 for anonymous callers and 403 for cross-tenant access.
- **Boundary 3: Guest Ingress & Access Token Check:**
  - Event tokens verified via timing-safe comparison in `src/lib/event-token.ts`.
- **Boundary 4: Photo Shot Quota & Race-Condition Lock:**
  - Database row-level locks via `reserve_shot` in PostgreSQL.
- **Boundary 5: Resumable Upload Integrity:**
  - SHA-256 chunk hash bounds before binary assembly in `/api/photos/chunk`.
- **Boundary 6: OAuth Credential Vault Security:**
  - AES-256-GCM encryption with randomized IVs and authentication tags.
