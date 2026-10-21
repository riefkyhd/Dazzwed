# Dazzwed Security Audit — Detailed Findings & Reproductions

**Target Commit:** `9bd1b41cf67587e35ebc1ea94f1401e5cffc3f82`  
**Profile:** Standard  

---

## 1. `admin-multi-tenant-cross-client-event-tampering`

### Overview
- **Title:** Cross-Tenant Event Tampering and Access Token Rotation via Missing Client Authorization
- **Verdict:** Confirmed
- **Overall Severity:** HIGH
- **Demonstrated Likelihood:** Medium
- **Demonstrated Impact:** High
- **Confidence:** High

### Ordered Source Trace
1. **Entrypoint:**
   `src/app/api/admin/settings/route.ts:34` (`PATCH`)
   Authenticated HTTP PATCH endpoint accepts arbitrary event ID and configuration updates from caller.
2. **Propagation:**
   `src/app/api/admin/settings/route.ts:57` (`PATCH`)
   Queries target event using `supabaseAdmin` service role without checking `client_id` against caller session.
3. **Sink:**
   `src/app/api/admin/settings/route.ts:98` (`PATCH`)
   Executes update on `events` table by event ID without tenant ownership authorization.

### Key Evidence
- `src/app/api/admin/settings/route.ts:35`: Authenticates user session via `getAdminUser()` but fails to verify `event.client_id` matches `session.clientId`.
- `src/app/api/admin/events/token/route.ts:42`: Updates token duration and expiration on arbitrary `eventId` without client ownership check.
- `src/app/api/admin/events/token/route.ts:108`: Rotates `access_token` on arbitrary `eventId` without client ownership check.
- `src/app/api/admin/settings/reset-sessions/route.ts:50`: Updates theme `sessionResetAt` timestamp on arbitrary `eventId` without client ownership check.

### Target-Neutral Reproduction & Execution Harness
- **Attacker Perspective:** A malicious or compromised client tenant user authenticated with role `client` targeting another wedding organizer's event.
- **Preconditions:**
  - Caller possesses a valid authenticated session cookie (`dazzwed_auth_session`) with role `client`.
  - Target event belongs to a different client tenant (`client_id != session.clientId`).
- **Payloads:**
  ```json
  POST /api/admin/events/token HTTP/1.1
  Host: dazzwed.vercel.app
  Cookie: dazzwed_auth_session=<client_a_session_cookie>
  Content-Type: application/json

  {
    "eventId": "00000000-0000-0000-0000-000000000002"
  }
  ```
  ```json
  PATCH /api/admin/settings HTTP/1.1
  Host: dazzwed.vercel.app
  Cookie: dazzwed_auth_session=<client_a_session_cookie>
  Content-Type: application/json

  {
    "id": "00000000-0000-0000-0000-000000000002",
    "status": "archived",
    "couple_names": "Tampered Event"
  }
  ```
- **Observed Result:**
  The server responds with `HTTP 200 OK`. The database record for event `00000000-0000-0000-0000-000000000002` is modified, rotating the access token and closing the wedding camera.

### Remediation
Enforce tenant client ownership at the start of each mutation endpoint:
```typescript
import { getAuthSession } from "@/lib/auth/session";

const session = await getAuthSession();
if (session && session.role === "client") {
  const { data: ownsEvent } = await sb
    .from("events")
    .select("id")
    .eq("id", targetEventId)
    .eq("client_id", session.clientId)
    .maybeSingle();

  if (!ownsEvent) {
    return NextResponse.json(
      { error: "Access denied: event belongs to another client", code: "FORBIDDEN" },
      { status: 403 }
    );
  }
}
```

---

## 2. `admin-qr-unauthenticated-token-disclosure`

### Overview
- **Title:** Unauthenticated Event Access Token Disclosure via Public QR Generation Route
- **Verdict:** Confirmed
- **Overall Severity:** HIGH
- **Demonstrated Likelihood:** Medium
- **Demonstrated Impact:** High
- **Confidence:** High

### Ordered Source Trace
1. **Entrypoint:**
   `src/app/api/admin/qr/route.ts:8` (`GET`)
   Unauthenticated HTTP GET request handler accepts slug query parameter without checking session.
2. **Propagation:**
   `src/app/api/admin/qr/route.ts:16` (`GET`)
   Queries `public.events` for `access_token` using `supabaseAdmin` service role when token is not provided.
3. **Sink:**
   `src/app/api/admin/qr/route.ts:33` (`GET`)
   Returns rendered SVG image containing guest URL with secret `access_token` parameter to unauthenticated caller.

### Key Evidence
- `src/app/api/admin/qr/route.ts:8`: GET handler lacks `getAdminUser()` or authentication middleware check.
- `src/app/api/admin/qr/route.ts:20`: Retrieves confidential `access_token` directly from database on behalf of unauthenticated caller.
- `src/app/api/admin/qr/route.ts:29`: Constructs guest URL embedding secret access token: `${origin}/e/${slug}${tokenQuery}`.

### Target-Native Reproduction & Execution Harness
- **Attacker Perspective:** An unauthenticated remote attacker attempting to access a private wedding camera roll knowing only the public couple slug.
- **Preconditions:**
  - Target event has an `access_token` configured in `public.events`.
  - Target event slug is known (e.g. `our-wedding`).
- **Invocation:**
  ```http
  GET /api/admin/qr?slug=our-wedding&format=svg HTTP/1.1
  Host: dazzwed.vercel.app
  ```
- **Observed Result:**
  Returns `HTTP 200 OK` with `Content-Type: image/svg+xml`. The SVG body contains the secret token:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" ...>
    ...
    <!-- embedded QR encodes: https://dazzwed.vercel.app/e/our-wedding?t=4A9F2B8C -->
  </svg>
  ```

### Remediation
Add session authentication to `src/app/api/admin/qr/route.ts`:
```typescript
import { getAdminUser } from "@/lib/supabase/auth";

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // proceed with QR generation
}
```
