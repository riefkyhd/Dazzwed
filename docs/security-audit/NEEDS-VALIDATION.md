# Dazzwed Security Audit — Leads Needing Validation

**Target Commit:** `9bd1b41cf67587e35ebc1ea94f1401e5cffc3f82`  
**Run Status:** Complete  

---

## Unresolved Leads Status

During this audit run under the `standard` profile, all identified boundary hypotheses and potential candidates were conclusively resolved using static source verification, deterministic database transaction analysis, and local control checks:

1. **Photo Shot Allocation & Race Conditions:** Conclusively confirmed protected via `SELECT ... FOR UPDATE` row-level locks in PostgreSQL stored procedure `reserve_shot`.
2. **Chunked Upload Buffer Integrity:** Conclusively confirmed protected via chunk size bounds and pre-assembly SHA-256 integrity verification in `/api/photos/chunk`.
3. **Google Drive Refresh Token Protection:** Conclusively confirmed protected via authenticated `AES-256-GCM` encryption at rest with randomized IVs.
4. **Photo Binary Proxy Scoping:** Conclusively confirmed protected in `/api/admin/photos/[id]` via explicit `photo.events.client_id === session.clientId` check.
5. **Cross-Tenant Event Tampering:** Conclusively confirmed vulnerable as documented in `FINDINGS-DETAIL.md` (`admin-multi-tenant-cross-client-event-tampering`).
6. **QR Access Token Disclosure:** Conclusively confirmed vulnerable as documented in `FINDINGS-DETAIL.md` (`admin-qr-unauthenticated-token-disclosure`).

There are **0 unresolved leads** requiring further external validation or deployment telemetry.
