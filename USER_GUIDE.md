# Unveiled — Operator, Host & Buyer Manual

> **Living Documentation:** This manual is maintained alongside the in-app Admin Guide (`src/app/admin/guide/page.tsx`). Any updates to features, privacy flows, or admin controls must be reflected here and in the in-app guide simultaneously.

---

## 1. Product Overview

**Unveiled** is a premium, web-based analog disposable camera designed for weddings and luxury celebrations. It captures genuine candid moments from guests' perspectives with curated vintage film simulations, real-time grain rendering, and automated background sync directly into the couple's private Google Drive.

### Key Highlights
- **Zero-Install Web Experience:** Guests scan a physical QR code on their table to immediately open the camera. No App Store download, no password, and no sign-up.
- **Authentic Film Aesthetics:** Real-time WebGL film looks (CPM 35, Portra 400, Tungsten 800T, Cine 250D, Classic B&W) with physical grain simulation and analog date stamps.
- **Indonesia UU PDP & GDPR Privacy Compliance:** Strict zero-activity pre-consent gate (zero cookies, storage, or telemetry before explicit guest agreement), EXIF/GPS location scrubbing, and full self-service Right to Erasure.
- **Offline Venue Resilience:** Spotty Wi-Fi in ballrooms or outdoor venues never causes photo loss. Photos are queued locally in `IndexedDB` and automatically upload in the background once signal returns.
- **Organized Google Drive Sync:** Automatically creates isolated folders labeled `Guest Name (RollCode)` containing film-graded JPEGs and raw unedited camera originals.

---

## 2. Event Host & Wedding Planner Checklist

### Phase 1: Pre-Wedding Testing & Preparation
1. **Connect Google Drive:**
   - Log in to `/admin` using your allowlisted admin email.
   - Navigate to `/admin/connect-drive` and authorize the host's Google account.
   - Verify health at `/admin/health` to confirm Drive storage quotas and folder readiness.
2. **Test Guest Experience:**
   - Open your event link (`/e/[slug]?t=[token]`) on your smartphone.
   - Test the shutter, flash pulse, look recipes, and keep/retake modal.
   - Confirm photos upload to Google Drive under the test guest folder.
3. **MANDATORY CLEANUP BEFORE PRINTING:**
   - In `/admin/settings`, click **"Rotate Token & Generate New QR"** to issue a fresh, clean token.
   - Click **"Reset All Guest Sessions"** to wipe test sessions from your test phones.

---

### Phase 2: Printing Table Cards & Signage (`/admin/qr`)
- Navigate to `/admin/qr` to access the high-resolution printable assets.
- **Vertical A4 Portrait Poster:** Click **"Print Vertical A4 Poster"**. Styled specifically with luxury gold corner filigree, the official Unveiled brand mark, and 3-step guest instructions for easel stands and entrance tables.
- **Stationery / Card Export:** Download **PNG (1200px)** or **SVG (Vector)** to provide to your stationery printer for custom table cards.

> [!WARNING]
> **CRITICAL RULE: NEVER ROTATE TOKEN AFTER PRINTING PHYSICAL CARDS**
> Once physical QR cards or posters are printed, **NEVER click "Rotate Token & Generate New QR"**. Rotating the token changes the secret link URL and will **permanently invalidate your printed cards**.
> If your wedding runs late and you need to extend the access window, use **"Update Expiration Time"** instead—this extends duration without changing the QR code or token.

---

### Phase 3: During the Wedding
- **Guest Flow:**
  1. Guest scans QR code with standard iOS or Android camera app.
  2. Bilingual consent gate opens (EN / ID). Guest enters optional name and checks required album consent.
  3. Camera viewfinder launches with a 15-shot analog film roll.
  4. Guest captures candid moments. On their first kept photo, a brief **Sync Indicator tooltip** explains that uploads happen automatically in the background.
  5. Once all 15 shots are taken, the guest is transitioned to the celebratory **Thank You** screen.
- **Spotty Signal:** If venue Wi-Fi is weak, photos are held safely in local storage and will sync automatically once the guest walks near a window or reconnects later that evening.

---

### Phase 4: After the Wedding
1. **Accessing Photos in Google Drive:**
   - Open Google Drive &rarr; `Disposable Cam - [Couple Names]`.
   - Each guest's roll is organized into its own folder:
     - `Dhifa (7EGE9X)` (if name was provided)
     - `Roll 7EGE9X` (if name was left blank)
   - Inside each folder:
     - `2026-10-16T12-30-00_7EGE9X_1.jpg` (film-graded vintage photos)
     - `originals/` (clean, uncompressed camera originals)
2. **Automated 30-Day Cleanup:**
   - Daily cron (`/api/cron/cleanup`) automatically purges anonymous telemetry logs and rate-limit IP digests after 30 days to protect guest privacy.

---

## 3. Admin Controls Reference

| Control | Location | What It Does | When to Use |
| :--- | :--- | :--- | :--- |
| **Link Duration** | `/admin/settings` | Sets how long the QR code remains active (`24h`, `48h`, `72h`, `7d`, Custom). | Set when creating or planning the event access window. |
| **Update Expiration Time** | `/admin/settings` | Extends the active access window **WITHOUT modifying the QR code or token**. | **Safe after printing.** Use when the wedding runs late. |
| **Rotate Token** | `/admin/settings` | Generates a brand-new cryptographic token and QR code; revokes previous links. | **ONLY before printing.** Use during testing or if the link leaks. |
| **Guest Camera Preview** | `/admin` | Directly opens the guest camera link with the active access token (`?t=<token>`). | Use to test or preview the camera experience from the host view. |
| **Shots Per Guest** | `/admin/settings` | Configures the number of shots on each guest's roll (default: 15). | Adjust before the event starts. |
| **Reset All Guest Sessions** | `/admin/settings` | Grants all guests another 15-shot roll without deleting previous photos. | Use during after-parties or when resetting test phones before the wedding. |

### Admin Navigation Layout (Clean Top Bar + Utility Dropdown)
The admin navigation uses a streamlined 5-link primary bar with an account popover:
- **Primary Desktop Nav (Single-Line, `>= 1024px`):** `Dashboard` (`/admin`), `Gallery` (`/admin/photos`), `QR & Print` (`/admin/qr`), `Look Lab` (`/admin/look-lab`), and `Settings` (`/admin/settings`).
- **Right Utility & Account Menu:** Quick `? Guide` pill button + Account trigger (`username ▾`) containing full admin email, `Connect Google Drive`, `System Health` diagnostics, and `Sign Out`.
- **Mobile & Tablet Drawer (`< 1024px`):** Mobile bottom navigation bar and expandable drawer keeping all admin routes accessible on touchscreens.

---

## 4. Technical Architecture & Deployment (For Buyers)

### Stack
- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security, Supabase Auth)
- **Cloud Storage:** Google Drive API v3 (OAuth 2.0 with offline refresh token)
- **Styling & Shaders:** Tailwind CSS, WebGL 1.0/2.0 fragment shaders for LUT color grading and film grain
- **Hosting:** Vercel (Edge Middleware + Serverless Functions)

### Official Branding Assets
- `/Unveiled_logo_horizontal_transparent.png`: Transparent horizontal lockup (nautilus shell emblem + gold serif "UNVEILED") optimized for dark backgrounds (Admin Navbar, Admin Login, Root page).
- `/Unveiled_logo_horizontal.png`: Ivory background lockup (`#FDFBF6`) used for OpenGraph (`og:image`) and Twitter Cards.
- `/unveiled-transparent.png`: Standalone transparent nautilus shell mark used on guest landing and camera headers.

### Environment Variables (`.env.local`)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Google Drive OAuth (Cloud Console Credentials)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REFRESH_TOKEN="" # Generated via /admin/connect-drive
DRIVE_ROOT_FOLDER_ID="" # Auto-created on first connect

# Admin & Security
ADMIN_EMAILS="host@example.com,planner@example.com"
CRON_SECRET="at-least-16-characters-long-secret"
RATE_LIMIT_HMAC_SECRET="at-least-16-characters-secret"
TURNSTILE_ENABLED="false"
```

### Initial Database Setup
Apply all migrations in `supabase/migrations/` sequentially using the Supabase CLI or SQL editor:
```bash
npx supabase db push
```

### Daily Cron Job Configuration
Configure a daily cron service (e.g., Vercel Cron or GitHub Actions) to trigger:
```http
POST https://your-domain.com/api/cron/cleanup
Authorization: Bearer <CRON_SECRET>
```
This safely removes rate limit hashes older than 24 hours and telemetry events older than 30 days.

---

## 5. Privacy & Data Protection Compliance

1. **Zero-Activity Pre-Consent Gate:**
   - Absolutely zero network requests, tracking scripts, cookies, `localStorage`, or `IndexedDB` instances are initialized until the guest explicitly clicks **"Start camera"**.
2. **Right to Erasure (UU PDP Article 39 / GDPR Article 17):**
   - Guests can withdraw consent and permanently delete their roll at any point during their session:
     - **Before shooting:** The expandable **Privacy & data notice** on the landing screen (`/e/[slug]`).
     - **Mid-roll (shots 1–14):** The quiet **Privacy & data rights** expandable footer inside the camera settings sheet (`CameraSettingsSheet`).
     - **Completed roll (shot 15):** The footer action on the celebratory **Thank You** screen (`ThankYouScreen`).
   - Calling deletion triggers `POST /api/guests/delete`, which permanently purges all guest photos and folders from Google Drive and Supabase, and wipes all local browser state (`localStorage`, `sessionStorage`, `IndexedDB`).
   - Local-only data clearing ("Clear Data on This Phone Only") is strictly prevented inside the camera to close the 15-shot reset loophole while ensuring authentic legal erasure compliance.
