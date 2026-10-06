# Disposable Cam: Wedding Day Incident Runbook

**System Architecture**: Next.js (App Router on Vercel) + Supabase (PostgreSQL with Row-Level Security) + Google Drive (Direct/Proxied Resumable Chunk Storage) + Client IndexedDB Local Store.

---

## 1. Quick Emergency Triage Matrix

| Symptom | Probable Cause | Immediate Action |
| :--- | :--- | :--- |
| **"Uploads Paused / Syncing" sticking for multiple guests** | Venue WiFi congested / disconnected | Reassure couple: **Photos are 100% saved in phone memory**. Do NOT close browser tab or clear browser history. Uploads auto-drain when signal recovers. |
| **Server returns HTTP 401 / Google Drive upload fails** | Google OAuth Refresh Token revoked / expired | Re-authenticate Drive at `dazzwed.vercel.app/admin/settings` or update `GOOGLE_REFRESH_TOKEN` in Vercel environment variables. |
| **"Photo limit reached" for all guests prematurely** | Venue WiFi IP exceeded burst quota (Legacy issue) | Already mitigated: venue WiFi now has 300 req/min IP allowance + 30 req/min per-guest bucket. If needed, increment in `/api/photos/init/route.ts`. |
| **Supabase free tier database paused** | Inactivity during pre-event week | Visit [supabase.com/dashboard](https://supabase.com/dashboard) -> Select Project -> Click **Restore project** (takes ~90 seconds). |
| **Black screen on guest camera** | iOS Safari / Chrome camera permission blocked | Instruct guest to tap the AA / lock icon in URL bar -> Camera -> Select "Allow" -> Reload page. |

---

## 2. Emergency Procedures

### A. Google Drive OAuth Token Re-linking
If Google Drive API rejects uploads with invalid credentials:
1. Navigate to `/admin/settings` as event admin.
2. Under **Google Drive Storage Integration**, tap **Reconnect Google Drive**.
3. Complete the Google OAuth consent flow for the destination Google account.
4. If setting up manually in Vercel Dashboard:
   - Go to **Vercel Project Settings** -> **Environment Variables**.
   - Update `GOOGLE_REFRESH_TOKEN` with the newly generated token.
   - Trigger a Redeploy (or wait 60s for serverless functions to pick up if dynamically loaded).

### B. Venue WiFi Outage & Slow Cellular Failover
1. **Zero Data Loss Guarantee**: Every photo captured by guests is written to IndexedDB **before** any network call is initiated.
2. Even in airplane mode, guests can snap up to their remaining film limit.
3. Once back within range of cellular data or working WiFi, the client background uploader automatically detects connection (`navigator.onLine` & `resetDelaysAndDrain()`) and uploads all queued photos sequentially.
4. **Guest Guidance**: "Leave your browser tab open until the counter shows all photos synced. If closed, simply reopen the wedding link anytime today."

### C. Manual Emergency Photo Export (Client-Side)
If venue internet is completely blocked until the next morning and couple requests photos immediately:
1. Have guests tap **Admin / Diagnostics** or access DevTools -> Application -> IndexedDB -> `disposable-cam` -> `shots`.
2. All captured JPEGs remain stored as high-resolution blobs.
3. Photos can also be uploaded from the guest's hotel room later that night without losing metadata or shot order.

### D. Supabase Inactive Database Wakeup
If the Supabase project was paused due to inactivity:
1. Open Supabase Dashboard.
2. Click **Unpause Project**.
3. Verify database connectivity by checking the `/admin/health` dashboard on the live website.

---

## 3. Real-Device Verification Checklist (To Run 2 Hours Before Event)

- [ ] **Admin Check**: Log into `/admin` and confirm `/admin/health` displays green status across Drive, Database, and Queue.
- [ ] **Test Photo Flow**:
  - [ ] Scan guest QR code on an iPhone (iOS 16+ Safari).
  - [ ] Take 1 photo with Disposable 400.
  - [ ] Confirm photo appears in Google Drive wedding event folder within 5 seconds.
  - [ ] Check counter decrements by 1.
- [ ] **Android Check**:
  - [ ] Open guest link on Android (Chrome).
  - [ ] Switch lens (0.5x / 1x / 2x).
  - [ ] Take 1 photo with CCD Flash (torch enabled).
  - [ ] Confirm clean sync.
- [ ] **Offline Check**:
  - [ ] Turn on Airplane Mode.
  - [ ] Take 1 photo -> Confirm "1 pending sync" indicator appears.
  - [ ] Turn off Airplane Mode -> Confirm badge returns to "Saved" within 5-10 seconds.
- [ ] **Multi-Session Returning Guest Check**:
  - [ ] Take 1 photo, note the 6-character roll code (e.g. `7K9X2B`).
  - [ ] Close the browser tab completely or open private window.
  - [ ] Visit link -> click "Already took photos? Continue my roll" -> enter code.
  - [ ] Verify roll resumes seamlessly with exact remaining shot count.

---

## 4. 500-Guest Traffic Spikes & Drive Rate Pacing
1. **Google Drive Write Pacer**:
   - Google Drive has a strict 2-3 writes/second sustained rate limit.
   - The server initiates resumable upload sessions capped at 2.5 req/s via a global token bucket (`global:drive_init_pacer`).
   - If a sudden spike occurs (e.g. bouquet toss where 50 guests snap simultaneously), excess requests receive HTTP 503 with `Retry-After: 2`.
   - **Client Behavior**: The client IndexedDB queue handles 503 automatically with jittered exponential backoff. Photos stay safely in IndexedDB and drain smoothly without dropping shots.
2. **Flat Folder Architecture**:
   - All filtered photos write directly to the event root folder, and clean originals write to a single shared `originals` subfolder.
   - Zero per-guest folder creation calls are made during the live wedding, eliminating Google Drive hierarchy rate limits.

