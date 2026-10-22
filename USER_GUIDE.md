# Unveiled — Operator, Host & Buyer Manual

> **Living Documentation:** This manual is maintained alongside the in-app Admin Guide (`src/app/admin/guide/page.tsx`). Any updates to features, privacy flows, or admin controls must be reflected here and in the in-app guide simultaneously.

---

## 1. Product Overview

**Unveiled** is a premium, web-based analog disposable camera designed for weddings and luxury celebrations. It captures genuine candid moments from guests' perspectives with curated analog film profiles, real-time grain rendering, and automated background sync directly into the couple's private Google Drive.

### Key Highlights
- **Zero-Install Web Experience:** Guests scan a physical QR code on their table to immediately open the camera. No App Store download, no password, and no sign-up.
- **Curated Film Looks:** Real-time WebGL color grades (Classic Chrome, Reala Ace 100, Rangefinder 35, Portra 400, Tungsten 800T, Cinema 250D, Classic Neg, Tri-X 400 B&W) with physical grain simulation and analog date stamps.
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
- **Hero-Sized QR Code & Unified Vector Architecture:** The table signage features an enlarged hero QR code (560px × 560px inside a 660px framed card, occupying 55% of the total poster width) designed for instant scanning across banquet tables up to 2 meters away. Both the on-screen preview, direct browser print, and file downloads are powered by a unified vector SVG engine that eliminates CSS flexbox/grid distortion and ensures 100% visual parity across all mediums.
- **Download Poster (PNG):** Downloads a 300 DPI ultra-high-resolution print file (`2480px × 3508px`, ISO 216 A4 ratio) featuring the luxury cream paper background, smooth rounded double gold borders, official Unveiled brand emblem, couple names, hero QR card, 3-step guest instructions, and private album footer note—ready for camera roll, USB stick, or photo lab printing.
- **Download Poster (SVG):** Downloads the complete scalable vector A4 poster file for large-format physical signage printing, easel banners, or professional Canva/Adobe Illustrator editing.
- **Print A4 Poster:** Sends the vector SVG directly to the browser print dialog (`210mm × 297mm`), guaranteeing zero CSS grid line stretching, zero flexbox pagination overflow, and crisp vector typography on "Save as PDF" or physical printers.
- **Bare QR Code Export:** Download standalone raw **QR PNG (1200px)** or **QR SVG (Vector)** if your stationery designer is creating custom wedding cards or bespoke paper suites.


> [!WARNING]
> **CRITICAL RULE: NEVER ROTATE TOKEN AFTER PRINTING PHYSICAL CARDS**
> Once physical QR cards or posters are printed, **NEVER click "Rotate Token & Generate New QR"**. Rotating the token changes the secret link URL and will **permanently invalidate your printed cards**.
> If your wedding runs late and you need to extend the access window, use **"Update Expiration Time"** instead—this extends duration without changing the QR code or token.

---

### Phase 3: During the Wedding
- **Guest Flow:**
  1. Guest scans QR code with standard iOS or Android camera app.
  2. Bilingual consent gate opens (EN / ID). The guest sees the active link validity status ("THIS LINK IS VALID UNTIL [DATE]" / "THIS LINK EXPIRES IN [HOURS]"), enters an optional name, and checks required album consent.
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
     - `2026-10-16T12-30-00_7EGE9X_1.jpg` (film-graded analog photos)
     - `originals/` (clean, uncompressed camera originals)
2. **One-Click Bulk Photo Export (.ZIP):**
   - In `/admin/photos` (or via the dashboard quick action button), click **"Download All (.ZIP)"**.
   - Select scope (**All Event Photos** or **Current Filtered View**).
   - Select folder categorization:
     - **📁 Per Guest Folders (Google Drive Structure)** (default & recommended) — When unzipped, photos are neatly organized into folders for each guest: `Guest Name (RollCode)/` (or `Roll RollCode/`) with clean captures placed in an `originals/` subfolder, exactly matching your Google Drive hierarchy.
     - **📦 By Variant** — Groups photos into top-level `Film/` and `Original/` folders across all guests.
   - Select your export variant:
     - **✦+◯ Both Film & Originals (.ZIP)** (recommended).
     - **✦ Film Developed Photos (.ZIP)** (graded with recipes, grain & date stamps).
     - **◯ Clean Originals (.ZIP)** (unfiltered RAW sensor captures).
   - The browser streams full-resolution media directly from Google Drive with 4-worker bounded concurrency, displays live percentage progress with an instant Cancel button, and packages the files into an uncompressed PKZIP archive in `<50ms` upon completion.
3. **Automated 30-Day Cleanup:**
   - Daily cron (`/api/cron/cleanup`) automatically purges anonymous telemetry logs and rate-limit IP digests after 30 days to protect guest privacy.

---

## 3. Admin Controls Reference

| Control | Location | What It Does | When to Use |
| :--- | :--- | :--- | :--- |
| **Download All Photos (.ZIP)** | `/admin/photos` & `/admin` | Zero-timeout client-side PKZIP STORE engine (Method 0) that downloads all full-resolution event photos directly in the browser as a single `.zip` archive without serverless timeouts. Supports **Per Guest Folders** (Google Drive style where unzipping categorizes photos into `Name (RollCode)/` with `originals/` subfolder) or **By Variant** (`Film/` & `Original/`). Choose between **Film Developed**, **Clean RAW Originals**, or **Both**. Features bounded concurrency (4 parallel workers), live progress, fail-soft missing file skip, and an instant Cancel button. | Download the complete wedding master album with one click to local storage or external SSD. |
| **Link Duration** | `/admin/settings` | Sets how long the QR code remains active (`24h`, `48h`, `72h`, `7d`, Custom). | Set when creating or planning the event access window. |
| **Update Expiration Time** | `/admin/settings` | Extends the active access window **WITHOUT modifying the QR code or token**. | **Safe after printing.** Use when the wedding runs late. |
| **Rotate Token** | `/admin/settings` | Generates a brand-new cryptographic token and QR code; revokes previous links. | **ONLY before printing.** Use during testing or if the link leaks. |
| **Guest Camera Preview** | `/admin` | Directly opens the guest camera link with the active access token (`?t=<token>`). | Use to test or preview the camera experience from the host view. |
| **Shots Per Guest** | `/admin/settings` | Configures the number of shots on each guest's roll (e.g. 15 or 30). Updates in real time on active phones (with automatic roll extension toasts and auto-reopening the camera for guests who completed their roll). | Adjust anytime before or during the wedding. |
| **Reset All Guest Sessions** | `/admin/settings` | Grants all guests another 15-shot roll without deleting previous photos. | Use during after-parties or when resetting test phones before the wedding. |
| **Editorial Gallery & Lightbox** | `/admin/photos` & `/admin/guests` | Direct photo gallery streamed from Google Drive. Toggle between the contact-sheet grid and guest rolls list, filter by roll or film look, trigger 1-click batch ZIP exports with real-time photo counts, and inspect photos in the full-screen lightbox with swipe navigation, Film vs. Original comparison, and 1-click downloads. | Review wedding captures, download favorites, or inspect RAW originals. |
| **Google Pixel 10 Self-Timer (`3s / 5s / 10s`) & Instant Settings Sync** | `/e/[slug]` & `/admin/settings` | Authentic Google Pixel 10 countdown cadence rendered strictly on the bottom Shutter Button progress ring and digits, leaving the viewfinder 100% clean and framing unobstructed. Features sustained 1 beat/sec (>3s), 2 double-time fast beats/sec (3s & 2s), and a steady final beat on 1s with audible ticks and gentle haptics. Hardware torch pulsing is omitted during countdown to eliminate subject glare reflex and protect camera sensor AE/AWB, reserving the physical LED exclusively for actual 0s capture when Flash is ON. Multi-layer Next.js cache invalidation guarantees `/admin/qr` and A4 posters reflect event title/subtitle/quota updates in 0ms without manual page refreshes. | Group portraits, wedding table photos, and immediate print preview sync. |
| **Flash Intensity Control (Soft Fill vs Standard)** | `/e/[slug]` | Dedicated flash intensity setting in Camera Tools. 'Soft Fill' (default) provides flattering, gentle illumination with automatic negative EV highlight protection on rear camera and 65% warm-ivory screen glow on front camera; 'Standard' provides full-power direct flash. Shutter latency is reduced to 0ms overhead with eliminated cooldown delays. | Natural, non-blinding night & indoor captures without harsh overexposure. |

### Admin Navigation Layout (Clean Top Bar + Utility Dropdown)
The admin navigation uses a streamlined 5-link primary bar with an account popover:
- **Primary Desktop Nav (Single-Line, `>= 1024px`):** `Dashboard` (`/admin`), `Gallery` (`/admin/photos` & `/admin/guests`), `QR & Print` (`/admin/qr`), `Look Lab` (`/admin/look-lab`), and `Settings` (`/admin/settings`).
- **Right Utility & Account Menu:** Quick `? Guide` pill button + Account trigger (`username ▾`) containing full admin email, `Connect Google Drive`, `System Health` diagnostics, and `Sign Out`.
- **Mobile & Tablet App Bar (`< 1024px`):** Fixed bottom app navigation bar and expandable drawer with ergonomic 44px touch targets, dynamic safe-area insets (`env(safe-area-inset-bottom)`), and full tablet bottom padding clearance (`pb-24 lg:pb-8`) to prevent content overlap across all touchscreens.
- **Global Master Vault Auto-Provisioning & Guest Identity:** Once Google Drive is authorized on the platform level, all newly created and existing events automatically auto-provision their dedicated root folders on-the-fly upon the first capture, eliminating repetitive per-event OAuth sign-ins while supporting optional dedicated couple vault switches. Guest display names are immutably preserved across background session syncs, page reloads, and camera resumptions.

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
     - **Before shooting:** The expandable **Privacy & data notice** on the landing screen (`/e/[slug]`) (action button rendered dynamically when an active roll session exists, e.g., returning guests wishing to withdraw before continuing).
     - **Mid-roll (shots 1–14):** The quiet **Privacy & data rights** expandable footer inside the camera settings sheet (`CameraSettingsSheet`).
     - **Completed roll (shot 15):** The footer action on the celebratory **Thank You** screen (`ThankYouScreen`).
   - Calling deletion triggers `POST /api/guests/delete`, which permanently purges all guest photos and folders from Google Drive and Supabase, and wipes all local browser state (`localStorage`, `sessionStorage`, `IndexedDB`).
   - Local-only data clearing ("Clear Data on This Phone Only") is strictly prevented inside the camera to close the 15-shot reset loophole while ensuring authentic legal erasure compliance.
3. **Zero-Overhead, Zero-PII Product Analytics:**
   - Anonymous aggregate counts (`filter_kept`, `filter_retaken`, `capture_mode`) are piggybacked directly onto standard photo upload payloads (`/api/photos/init`).
   - Counter increments run non-blockingly on the server (`increment_event_metric`), adding `0ms` of latency to the guest camera experience.
   - Zero PII is retained: No individual guest profiles, device fingerprints, or IP addresses are linked to metrics. Pre-consent tracking is strictly impossible because the camera cannot be entered without explicit consent submission.

---

## 6. Camera Hardware & Multi-Lens Architecture

1. **Universal `0.5x / 1x / 2x / 3x` Multi-Lens Support (Samsung Galaxy S23 FE, Google Pixel, iPhone):**
   - **Split Physical Sensors (Samsung Galaxy S23 FE):** Android Chrome exposes individual Camera2 physical sensors. Unveiled's camera engine maps:
     - **`0.5x`:** Routes to the true optical Ultra-Wide sensor (`camera2 2`).
     - **`1x`:** Routes to the Primary Wide sensor (`camera2 0`), enabling continuous autofocus and hardware torch flash.
     - **`2x`:** Applies native browser zoom constraints or clean digital sensor crop on the primary sensor.
     - **`3x`:** Directly switches to the 3x optical telephoto lens (`camera2 3`) or hardware zoom.
   - **Logical Multi-Cameras (Google Pixel):** Supports smooth native track zoom across `[0.5x, 8.0x]`, dynamically switching between sensor levels without restarting the camera stream.
   - **Startup Self-Correction:** When launching the camera at 1x, the engine verifies sensor capabilities (e.g. continuous focus and torch support) to ensure the 1x viewfinder never accidentally opens the ultra-wide lens.

2. **iOS Safari (iPhone 13 / 15) Capture Memory Protection:**
   - **WebKit Canvas Ceiling Safeguard:** On iOS Safari, canvases larger than ~2560px can trigger silent memory allocation failures. Captures on iOS are clamped to a safe `2560px` longest edge (yielding 5.2 MP QHD print quality) with automatic fallback to data URL decoding if WebKit's native `canvas.toBlob()` returns null.
   - **IndexedDB `ArrayBuffer` Serialization:** Raw `Blob` storage directly in IndexedDB triggers WebKit `DataCloneError` in certain Safari versions. Photos are stored as binary `ArrayBuffer` representations in IndexedDB and reconstructed upon retrieval.
   - **Zero-Drop Photo Guarantee:** When a guest taps **"Keep Photo"**, the shot counter decrements optimistically, and the upload queue is fed immediately. If archival high-resolution rendering encounters a background timeout, the high-speed preview frame is automatically salvaged and uploaded so no captured memory is ever lost.

3. **iOS WebKit Direct WebGL Video Capture & Dual Black-Photo Elimination (iPhone 13 / 15):**
   - **Active Viewfinder `<video>` Placement:** iOS WebKit power management suspends GPU hardware video frame decoding when `<video>` elements are sized at `1px x 1px` or detached off-screen. The live camera `<video>` is positioned directly inside the active viewfinder container behind the WebGL canvas (`position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.001; pointer-events: none; z-index: 0;` with canvas at `z-index: 1`), ensuring iOS WebKit never suspends video frame decoding.
   - **In-DOM WebGL Viewfinder Snapshot with `preserveDrawingBuffer: true`:** On iOS Safari WebKit, offscreen WebGL contexts cannot reliably bind hardware video textures from active WebRTC streams. The active in-DOM WebGL viewfinder canvas is configured with `preserveDrawingBuffer: true`, allowing synchronous snapshots to a static 2D canvas at shutter press that are immune to WebKit compositor frame clears.
   - **Dual Black-Blob Sanity Guard (`isBlobBlankOrBlack`):** When the user taps **"Keep Photo"**, `CameraScreen` inspects the rendered JPEG blob using downscaled pixel sampling with `new Image()` and `createImageBitmap` fallback. If the rendered blob is ever solid black `(<=10)`, it is immediately rejected and the verified high-definition `previewBitmap` (which is already displayed in the review modal) is converted and uploaded to Google Drive, mathematically guaranteeing that a black photo can never be saved to the guest's roll or the event archive.

4. **Persistent Multi-Lens Cache & Zero Pop-In Camera Flip Transition:**
   - **Persistent Module-Level Cache:** Device capabilities and rear optical lenses (`cachedBackLenses` and `cachedKnownDevices`) are proactively enumerated and cached across the lifetime of the session. When flipping between the front selfie camera and the rear camera, lens definitions are never wiped to empty.
   - **Hardware-Confirmed Mounting (`actualFacing`):** The floating lens toggle is synchronized with the confirmed active hardware stream (`actualFacing === "environment"`) rather than premature UI intent. This completely eliminates the jarring pop-in bug on iPhone 13 and multi-sensor Android devices where `1x-3x` briefly flashed before the ultra-wide `0.5x` button snapped into view.

---

## 7. Editorial Admin Gallery & Analog Emulation Science

1. **Authentic Quartz Databack Emulation vs. Professional Emulsions:**
   - **Consumer Point-and-Shoot Cameras:** Emulsions that emulate retro 90s/00s compact analog cameras (`disposable-400`, `ccd-flash`, `retro-90s-flash`, `cpm-35`, `portra-400`, `cinestill-800t`, `tri-x-400`, `ilford-hp5-plus`, `super-8mm-vintage`, `kodak-ektar-100`) include authentic quartz LCD databacks (`dateStamp.enabled: true`) burned onto the negative.
   - **Professional SLR, Editorial, Fine-Art & Cinema Formats:** Professional editorial and documentary emulsions (`editorial-flash`, `airy-romantic`, `warm-vintage`, `classic-chrome`, `reala-ace`, `classic-neg`, `golden-200`, `instant-film` polaroid, `fuji-eterna-250d` motion picture, `neutral`) do not burn databacks (`dateStamp.enabled: false`) by design, mirroring authentic professional analog equipment.
   - **Untouched RAW Originals:** Clean original sensor captures (`mode === "original"`) never contain databacks, preserving pristine digital negatives.

2. **High-Concurrency Google Drive Token Caching & Resilient Gallery Loading:**
   - **In-Memory OAuth Token Singleton (`getDriveAccessToken`):** Google OAuth access tokens are cached in memory for 50 minutes with active in-flight request deduplication (`tokenRefreshPromise`). When an admin loads a gallery of 30+ photos simultaneously, all thumbnail requests share a single warm bearer token instead of firing 30 concurrent token refreshes to Google, eliminating `429 Too Many Requests` rate limiting.
   - **Event Token Cache:** Database event refresh tokens are cached for 5 minutes, eliminating redundant database queries on grid renders.
   - **Transient Load Retries:** Photo cards in `PhotosManagementView` automatically retry up to 2 times with exponential jitter if a network blip occurs before displaying a missing file indicator.

3. **Progressive Lightbox Rendering, Aspect-Ratio Containment & Unified Container Spacing:**
   - **Full Aspect-Ratio Viewport Containment (`AdminPhotoLightbox`):** Solves percentage height resolution bugs (`CSS 2.1 §10.5`) by wrapping the photo stage in a definite `w-full h-full min-h-0 min-w-0` flex container with `max-h-full max-w-full w-auto h-auto object-contain` rules and inline styles. Portrait 3:4, 4:3, square, and 16:9 photos fit 100% complete without vertical clipping, cropping, or artificial zooming across widescreen desktop (>= 1440px), tablets, and mobile phones in both portrait and landscape orientations. Includes click-outside backdrop dismissal, touch swipe gestures, and keyboard navigation.
   - **Clean Unmount Progressive Loading:** The instant low-resolution thumbnail base layer (=s800) automatically unmounts as soon as the HD lightbox image (=s1600) finishes decoding. This completely eliminates double images, subpixel edge bleed, and ghosting outlines.
   - **Unified Container Spacing:** Top navigation (`AdminNavbar`) and main admin views (`PhotosManagementView`, `DashboardView`, etc.) are standardized to `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` for pixel-perfect edge alignment on widescreen displays.

4. **Fujifilm Color Science Emulations: Classic Chrome & Reala Ace 100:**
   - **Classic Chrome (`classic-chrome`):** Homage to Kodachrome 64 and mid-century documentary reportage. Features subdued global saturation (~84%), steep crushed shadow toe (`toe: 0.012`), sculpted micro-contrast (`localContrast: 0.08`), signature cyan-teal sky rotation (-15° at 225°), olive/army foliage greens, deep terracotta/brick reds, and cool slate shadow tints.
   - **Reala Ace 100 (`reala-ace`):** Fujicolor Super HG Reala 100 simulation utilizing digital 4th cyan-layer emulsion mechanics. Eliminates fluorescent and mixed lighting yellow-green casts, preserving delicate tonal graduation, open clean shadows (`toe: 0.026`), extended highlight shoulder rolloff (`shoulder: 0.89`), luminous porcelain/peach portrait skin tones, and ultra-fine RMS 4 grain.

5. **Editorial & Fine-Art Wedding Emulations (Flash, Airy 400H, Vintage Heritage & Retro 90s):**
   - **Editorial Flash (`editorial-flash`, dial: `VOG`):** High-fashion Vogue/GQ wedding editorial aesthetic (Juergen Teller / Helmut Newton). Features hard direct flash falloff (`strength: 0.48, radius: 0.44`), high contrast punch (`contrast: 1.22`), pure obsidian blacks (`toe: 0.00`), hard specular shoulder (`0.82`), porcelain/alabaster skin tones, and subdued global saturation (`0.86`) with strict neutral white preservation.
   - **Airy Romantic 400H (`airy-romantic`, dial: `AIRY`):** Fine-art medium format wedding look (Fuji Pro 400H + Contax 645 Zeiss 80mm f/2 pushed +1.5 stops, Jose Villa style). Features lifted matte black toe (`toe: 0.048`), gentle contrast (`contrast: 0.98`), ethereal highlight lace bloom (`strength: 0.26, radius: 0.022`), pastel mint/sage foliage (+10° toward cyan), and luminous porcelain-peach skin.
   - **Warm Vintage Heritage (`warm-vintage`, dial: `VNTG`):** Destination wedding heritage portraiture (Axioo / Iluminen aesthetic under warm tungsten chandeliers and golden ambient light). Features rich golden-amber highlight warmth (`0.24`), chocolate-espresso warm shadow lift (`shadowTint: [0.012, 0.008, 0.002]`), warm honey skin, olive-cypress foliage, and red-gold candlelit halation glow (`0.18`).
   - **Retro 90s Flash (`retro-90s-flash`, dial: `90S`):** Authentic 1990s compact point-and-shoot 35mm flash (Olympus Stylus Epic / Yashica T4 / Kodak Gold 200). Features small-bulb xenon flash falloff (`strength: 0.44`), lifted hazy shadows with violet-blue chemical undertone (`shadowTint: [0.008, 0.004, 0.012]`), punchy chartreuse/lime greens (-8°) and mustard yellows, tactile 35mm grain (`amount: 0.15`), and glowing quartz date stamp.

---

## 8. Instant 0ms Navigation Architecture & Streaming Dark-Room Skeletons

1. **Next.js App Router Prefetching & Route-Level `loading.tsx` Boundaries:**
   - Next.js App Router routes with dynamic server queries (`force-dynamic`) normally block client navigation until the server responds unless a `loading.tsx` boundary is defined.
   - Every admin route (`/admin`, `/admin/photos`, `/admin/guests`, `/admin/health`, `/admin/qr`, `/admin/look-lab`, `/admin/settings`, `/admin/guide`, `/admin/connect-drive`) and the guest camera entry (`/e/[slug]`) is equipped with a dedicated `loading.tsx` boundary.
   - All links in `AdminNavbar` specify `<Link prefetch={true}>`, allowing Next.js to pre-cache the static layout shells and transition between pages in `0ms` on click.

2. **Optimistic Active Tab Feedback (`optimisticPath`):**
   - In traditional SPAs, tab navigation suffers perceived lag while waiting for the router URL to update (`usePathname()`).
   - `AdminNavbar` maintains an `optimisticPath` state that updates the gold active indicator pill instantaneously on click (`onClick={() => setOptimisticPath(target)}`), resetting automatically once Next.js router synchronization completes.

3. **Tailored Dark-Room Skeleton Component Library (`src/components/ui/Skeleton.tsx`):**
   - Built with Unveiled's warm dark-room palette (`bg-stone-900/80`, `border-stone-800/60`, warm amber pulses):
     - `KpiCardSkeleton`: Summary stat metrics with title, count, and footer status placeholders.
     - `GalleryGridSkeleton`: Responsive 2-to-4 column contact-sheet grid of `aspect-[3/4]` card skeletons.
     - `TableSkeleton`: Configurable row and column table skeleton for guest rolls and event logs.
     - `ChartPanelSkeleton`: Analytical leaderboard and funnel cards for `/admin/health`.
     - `FormCardSkeleton`: Multi-row input form skeletons for settings, QR configuration, and drive sync.

4. **Concurrent Query Parallelization (`Promise.all`):**
   - Independent server queries across `/admin`, `/admin/photos`, `/admin/health`, and `/e/[slug]` are executed concurrently in `Promise.all` batches instead of sequential waterfalls.
   - For example, in `/admin/health`, Storage Guard, photo roll stats, event metrics, guest counts, and client telemetry queries run in parallel, cutting data streaming completion time in half.

5. **Guest Mobile Camera Landing Skeleton (`/e/[slug]/loading.tsx`):**
   - Mobile-first, dark-room camera viewport placeholder (`100dvh`, `bg-black`, `aspect-[3/4]` viewfinder outline, gold corner framing marks, shutter button pulse) displayed instantaneously when wedding guests scan table QR cards on congested ballroom Wi-Fi, completely eliminating white-screen flashes.

---

## 9. Google Pixel 10 Self-Timer Cadence & Flash Intensity Management

1. **Google Pixel 10 Self-Timer Cadence (`3s / 5s / 10s`) (`timer-cadence.ts` & `CameraScreen.tsx`):**
   - **4-Stage Cycle:** Tapping the timer button in the top toolbar cycles cleanly through `Off (0s) -> 3s -> 5s -> 10s -> Off (0s)`.
   - **Unobstructed Viewfinder Framing:** All countdown numbers and the circular progress sweep are rendered strictly inside the tactile bottom `ShutterButton`. The camera viewfinder preview remains completely clean without distracting overlays or pulsing borders.
   - **Seconds > 3 (`10s..4s` and `5s..4s` — Sustained 1 Beat/Sec):** Fires 880Hz audio ticks and gentle haptic pulses at 1 beat per second while the shutter button progress ring advances.
   - **Seconds 3 and 2 (Accelerated Double-Time Cadence — 2 Beats/Sec):** Double-pulse rhythm (at `0ms` and `420ms`) with 1100Hz dual audio ticks to signal imminent capture.
   - **Final Second 1 (Stillness & Auto-Exposure Stability):** Crisp final audio tick and haptic at `+0ms`. The ambient lighting remains 100% stable before shutter capture, giving the camera ISP's Auto-Exposure (AE) and Auto-White-Balance (AWB) ample time to settle completely.
   - **Hardware Torch Exclusivity (See `docs/TIMER_FLASH_NOTES.md`):** Hardware LED torch blipping is intentionally omitted during countdown ticks to prevent WebRTC 100% saturation glare on subjects. The hardware torch is reserved exclusively for actual photo capture at `0s` when Camera Flash is set to `ON`.
   - **Instant Capture at `0s`:** Triggers the deterministic pre-flash metering & Godox Xenon strobe pass if Camera Flash is `ON`.
   - **Instant Cancellation:** Tapping the shutter button during countdown immediately cancels all timers and zeroes the countdown with 0ms delay.

2. **Flash Intensity Management (`Soft Fill` vs `Standard Full`):**
   - **Soft Fill (Default):** Flattering, natural fill light. On the rear camera, uses a snappy 75ms pulse and automatically applies a highlight-protecting negative EV offset (`-0.7 EV`), preventing harsh washed-out faces. On the front camera, illuminates with a gentle warm-ivory screen glow (`#fff8ea` at 65% opacity) mimicking Apple True Tone fill flash.
   - **Standard Full:** Traditional direct flash illumination (140ms rear torch pulse, 90% white front screen flash) for pitch-dark environments.
   - **Settings Control:** Guests can select their preferred intensity in Camera Tools (`CameraSettingsSheet.tsx`), persisted locally in `localStorage` (`dazzwed_flash_intensity`).

3. **Multi-Layer Settings & QR Cache Invalidation:**
   - **Server-Side Path Revalidation (`revalidatePath`):** Saving changes in `/api/admin/settings`, `/api/admin/events/token`, or `/api/admin/settings/reset-sessions` invalidates `/admin` and `/e/[slug]` layout caches on Supabase update.
   - **Dynamic Un-Cached Pages:** `/admin/qr/page.tsx` and `/admin/settings/page.tsx` export `dynamic = "force-dynamic"` and `revalidate = 0`.
   - **Client-Side Next.js Router Cache Flush (`router.refresh()`):** Calling `router.refresh()` in `SettingsView.tsx` flushes the browser's prefetched `<Link>` cache immediately upon save, so clicking from `/admin/settings` to `/admin/qr` displays updated event taglines and couple names with zero stale cache lag.

---

## 10. Deterministic Flash Sync, Single-Step Capture Transition & "Godox Xenon Strobe" Aesthetic

1. **Deterministic Pre-Flash Metering & Convergence State Machine (`caps.ts` & `useCamera.ts`):**
   - **Atomic Constraint Lock (`applyFlashConstraints`):** Merges `torch: true` and `exposureCompensation: -0.5 EV` into a single atomic `advanced: [{ ... }]` dictionary. This resolves hardware HAL driver cancellation on Android Camera2, which previously dropped either the flash or exposure compensation if requested sequentially.
   - **Enforced 240ms Hardware Warmup Floor:** Because physical smartphone LEDs take ~80–120ms to illuminate from a cold state, the convergence loop enforces a minimum 240ms warmup floor before evaluating the $\Delta < 5\%$ luminance stability exit condition. This completely prevents premature capture on initial dark or un-illuminated frames.
   - **Guaranteed Post-Readout Release (+ 60ms Guard Tick):** The hardware torch stays energized throughout off-screen canvas/bitmap frame readout. Only after video stream texture binding and pixel copying to memory have completely resolved (+ 60ms safety guard tick) is the torch deactivated and exposure compensation restored to 0 EV, eliminating dark frames and sensor Auto-Exposure blindness spikes.
   - **Front Camera True Tone Screen Flash:** Full-screen warm-ivory (`#fff8ea`) retina glow held through a 240ms convergence window before frame capture.

2. **Single-Step Unified Capture Transition (`CameraScreen.tsx` & `ReviewModal.tsx`):**
   - **Elimination of 3-Stage Visual Hopping:** Replaces the jarring sequence (frozen live frame -> unbaked preview canvas -> delayed developed image pop 300ms later) with one unified transition.
   - **Under-Curtain Archival Development:** When the shutter snaps, a 160ms mechanical shutter curtain (`opacity: 95%`) closes while `renderShot()` executes directly on the captured frame at high resolution (2048px–2560px in ~90–120ms).
   - **Direct 100% Developed Mount:** `ReviewModal` mounts directly with `photoBlob` already 100% developed. The developing chemical emulsion fog (`opacity` transition over 500ms) smoothly brings the image to full brightness, delivering authentic analog darkroom delight with zero preview-to-image popping or color jumps.

3. **"Godox Xenon Strobe" Direct-Flash Grading Pass (`pipeline.ts` & `render.ts`):**
   - **Radial Inverse-Square Flash Falloff:** Center light source slightly elevated above lens axis (`cx = 0.50, cy = 0.46`). The central subject zone ($r < 0.40$) remains full brightness, while background and outer corners smoothly attenuate by ~32% with a deeper shadow floor via Hermite smoothstep.
   - **Soft-Knee Xenon Highlight Roll-off:** Highlights with luminance $L > 0.78$ pass through a soft-knee compressed shoulder curve preventing harsh digital sensor clipping, infused with warm ivory specular tint (+3% R, +1.5% G, -2% B) matching physical 5600K Xenon quartz tube discharge.
   - **5600K Xenon Color Balance & Midtone Punch:** Neutralizes smartphone LED yellow-green spike in linear space while adding +10% midtone local contrast punch for editorial high-fashion pop (Juergen Teller / Helmut Newton style).
   - **Specular Jewelry Halation:** Specular highlights ($L > 0.88$) receive subtle micro-halation bloom without muddying the rest of the frame.
   - **Preserved Clean RAW Capture:** The Godox Xenon Strobe pass is baked into `filteredBlob`, while `originalBlob` remains the pure, un-graded sensor capture (`intensity: 0`, `flashUsed: false`) so the Admin Gallery's `Film vs. Original` comparison toggle remains 100% accurate.

---

## 11. Native Smartphone Gravity-Based Icon Rotation & True Landscape Archival Capture (`4:3` / `16:9`)

1. **Gravity Accelerometer Tilt Detection (`useDeviceTilt.ts` & `CameraScreen.tsx`):**
   - **Portrait Orientation Lock Compatibility:** Unlike browser `screen.orientation` which fails when a user has system Portrait Lock enabled, Dazzwed reads real-time gravity vectors from `DeviceMotionEvent.accelerationIncludingGravity`:
     - **Portrait Upright (`0°`):** `|y| > |x|` (standard holding angle).
     - **Landscape Left (`90°`):** `x > 4.5 m/s²` with `|x| > |y| * 1.3` (phone tilted CCW, top pointing left).
     - **Landscape Right (`-90°`):** `x < -4.5 m/s²` with `|x| > |y| * 1.3` (phone tilted CW, top pointing right).
   - **Cross-Platform Sensor Normalization (Android vs iOS CoreMotion):**
     - **Android Flagships (Pixel / Samsung / Vivo / Oppo / Xiaomi):** Standard W3C accelerometer frame where upward reaction force on Landscape Left produces `rawX > 4.5 m/s²` mapping directly to `90°` (`rotate(90deg)` clockwise). Modern Android Chrome (v155+) implements `DeviceMotionEvent.requestPermission`, so `isIOSPlatform()` strictly discriminates Android via user agent (`/Android/i.test(ua)`) to guarantee Android never undergoes spurious coordinate inversion.
     - **iOS WebKit (iPhone 13+):** Apple CoreMotion measures reaction force relative to the screen frame, inverting the coordinate sign convention compared to W3C (`rawX` is negative on Landscape Left). Dazzwed normalizes iOS vectors (`x = -rawX`, `y = -rawY`, `z = -rawZ`) so both platforms output identical upright orientation angles.
   - **Deadzone Hysteresis & Flat-Surface Filter:** Requires holding angles to sustain for $\ge 200\text{ms}$ to prevent jitter around 45° thresholds. When resting flat on a table (`|z| > 7.0 m/s²`), the last stable angle is preserved.
   - **Safari Transient User Activation (iOS 13+):** WebKit strictly requires direct user interaction (`click` or `touchend`) to request motion permission and will reject with `NotAllowedError` if invoked on page load or `touchstart`. Dazzwed automatically requests motion permission:
     1. During the user's form submission ("Start Camera") on the Landing Screen.
     2. On the guest's first tap/touch on the camera viewfinder or controls.
     3. Via an elegant amber pill (`[🔄 Tap to enable tilt rotation]`) if the user opens the camera directly without prior permissions.

2. **Zero Layout Reflow Invariant:**
   - The camera container structure NEVER rearranges, reflows, or creates horizontal side rails. The top bar, viewfinder box, lens dock, and bottom shutter dock remain permanently fixed in their ergonomic mobile positions.
   - **In-Place Icon Pivoting (`300ms cubic-bezier(0.22, 1, 0.36, 1)`):**
     - Top bar action icons (Flash mode, Aspect ratio, Vintage self-timer, Sync indicator, Settings trigger)
     - Lens selector pills: numbers (`0.5`, `1x`, `2`, `3`) pivot inside stationary circular buttons
     - Bottom shutter dock: Film roll thumbnail + remaining shots counter badge, and Flip camera button
     - Self-timer countdown badge (`3s`, `2s`, `1s`)

3. **True Landscape Archival Capture (`geometry.ts`, `pipeline.ts` & `render.ts`):**
   - **GPU Shader Texture Rotation (`u_rotation`):** When capturing in landscape orientation (`tiltAngle === 90 || tiltAngle === -90`), the WebGL Look Engine rotates sensor texture coordinates by -90° (CCW) or +90° (CW) in the shader pass.
   - **True Landscape Output Dimensions:** Outputs true horizontal images where `width > height` (e.g., `1920 × 1440` on iOS or `2560 × 1920` on desktop/Android for 4:3, `1920 × 1080` / `2560 × 1440` for 16:9), applied equally to both the developed `filteredBlob` and raw `originalBlob`.
   - **Front-Facing Camera Landscape Upright Geometry & Mirror Symmetry (`pipeline.ts` & `render.ts`):**
     On mobile devices (iOS & Android), the front camera sensor is mounted facing the user. In landscape orientation, an unmirrored user's head is located at sensor coordinate `s = 0` (Landscape Left / 90°, right long edge of phone) or `s = 1` (Landscape Right / -90°, left long edge of phone). Dazzwed's WebGL Look Engine (`mapCropUv`) and 2D canvas fallback (`drawRotatedSource`) map sensor coordinates with physical sensor awareness:
     - **Landscape Left (90°):** Front camera maps `normUv.y = 0` (top/head) to `s = 0` (`cropped.y = 0`, upright!) and `normUv.x = 0` (left) to `t = 0` (`cropped.x = 0`), ensuring selfies are saved 100% upright and naturally mirrored without vertical inversion.
     - **Landscape Right (-90°):** Front camera maps `normUv.y = 0` (top/head) to `s = 1` (`1.0 - cropped.y`, upright!) and `normUv.x = 0` (left) to `t = 1` (`1.0 - cropped.x`).
     - **Rear Camera:** Retains outward sensor mapping (`1.0 - cropped.y` for 90°, `cropped.y` for -90°), keeping rear camera captures 100% upright across both directions.
   - **Corner-Accurate Date Stamp:** Analog orange date stamp and emulsion effects are rendered directly on the landscape canvas, properly anchored to the true bottom-right corner.
   - **WebKit iOS Memory Safety & Synchronous Sensor Readout:** On iOS MobileSafari (iPhone 13+), WebKit suspends background video frame decoding when covered by opaque overlays or when preview loops pause. Dazzwed captures a full-resolution 2D canvas snapshot (`snapCanvas`) synchronously from the live `<video>` stream *before* shutter curtain closure and freezing, ensuring WebGL never samples empty frames. Furthermore, archival rendering on iOS devices is safely clamped to `1920px` max edge and all temporary canvases are immediately deallocated (`width = height = 0`), preventing WebKit GPU memory ceiling (256MB) crashes and unexpected page reloads on retake.

4. **Expanded Landscape Review Modal Presentation (`ReviewModal.tsx`):**
   - Automatically detects landscape dimensions (`width > height` or `aspect === "4:3"`).
   - Adapts the hero print container to `aspectRatio: "4 / 3"` or `"16 / 9"` with `max-w-xl`, presenting photos with zero letterboxing or distortion.
   - **Container-Aligned Action Buttons:** Action buttons ("Retake" & "Keep Photo") always follow their horizontal bottom dock without rotating, preserving clean typography, full touch targets, and natural horizontal reading alignment.
   - **Unified Shutter Transition:** The tactile shutter curtain stays closed during the brief 160ms archival development and opens directly to the final developed photo with zero unrotated preview jumps or black frames.

---

## 12. Stage 1 SaaS Multi-Event Isolation, Event Switcher & Anti-Tamper Quota Locks

1. **Multi-Event Data Isolation:**
   - Multiple client weddings, parties, and corporate celebrations (e.g. past `"Tasyakuran 2026"` vs. current `"Wedding"`) can run concurrently on a single Dazzwed instance with complete data isolation.
   - Each event row in `public.events` maintains its own:
     - Unique URL slug (`/e/[slug]`)
     - Independent rotating cryptographic access token (`access_token`, `token_expires_at`, `token_duration_hours`)
     - Dedicated Google Drive root folder (`drive_root_folder_id`)
     - Isolated guest table rows (`event_id` foreign key) and photo streams (`event_id` foreign key)
     - Custom branding theme, welcome notes, and active color recipe defaults.

2. **Admin Event Switcher & Event Creation:**
   - The Admin navigation bar (`AdminNavbar.tsx`) features an **Event Switcher** pill displaying the active event name and status badge (`ACTIVE` green, `PAUSED` yellow, `ARCHIVED` zinc).
   - Clicking the pill opens a menu of all registered events, allowing instantaneous switching with Next.js router revalidation.
   - The **`+ New Event`** modal lets administrators spin up a new wedding or event in seconds, configuring couple names, URL slug, and roll shot capacity.

3. **Event Lifecycle States:**
   - **`active`:** Full guest entry, real-time photo reservations, and background uploads enabled.
   - **`paused`:** Used for wedding speeches, dinner intermissions, or temporary maintenance. Guests navigating to `/e/[slug]` receive a friendly intermission screen (`"Intermission — Camera Paused"`), and photo upload APIs (`/api/photos/init`) reject new reservations with `403 EVENT_PAUSED`.
   - **`archived`:** Concluded event state. Guests are presented with a celebratory conclusion screen, and all guest creation (`/api/guests`) and upload APIs are closed (`403 EVENT_ARCHIVED`).

4. **Package Tiers & Server-Side Anti-Tamper Quota Locks:**
   - Events are assigned a package tier:
     - `pocket_roll`: Designed for small gatherings (max 50 guests, 15 shots/guest).
     - `classic_35mm`: Standard wedding package (max 150 guests, 25 shots/guest).
     - `grand_archive`: High-capacity luxury wedding (max 500 guests, 50 shots/guest).
     - `owner_unlimited`: Unrestricted administrative / studio tier.
   - **Server-Side Enforcement:**
     - `/api/admin/settings`: Settings updates for `shots_per_guest` are strictly clamped at `package_max_shots_per_guest`. Client hosts cannot exceed their purchased entitlement.
     - `/api/guests`: Enforces `package_max_guests`. If registrations reach the package limit, further creations are blocked with `403 PACKAGE_GUEST_LIMIT_REACHED`.


---

## 13. Stage 2 Multi-Tenant SaaS — Platform Owner Console (`/superadmin`), Client Accounts & Strict RBAC

1. **Dual-Role Tenant Architecture (`superadmin` vs. `client`):**
   - **Platform Owner (`superadmin`):** Authenticated via master email allowlist (`ADMIN_EMAILS`) or signed owner session. Holds unrestricted platform-level control across all events, platform infrastructure (Google Drive OAuth, System Health diagnostics), and client accounts.
   - **Client Host (`client`):** Authenticated via client email + 8-character human-readable access code (or password) stored in `public.clients`. Scoped exclusively to wedding events assigned to their `client_id`.

2. **Platform Owner Console (`/superadmin`):**
   - Accessible exclusively to Platform Owners via direct URL or via the User Account dropdown menu in the top navigation bar.
   - **Platform KPI Overview:** Real-time counters displaying Active Clients vs. Total Clients, Total Platform Event Rolls, Total Photos Synced to Google Drive, and Total Registered Guests.
   - **Client Account Provisioning:**
     - Create new client accounts with Name, Email, Max Allowed Event Rolls (e.g., 1 for single wedding, 2–3 for engagement + wedding packages), and internal notes.
     - Automatically generates an 8-character uppercase access code (e.g., `DZ-9K4M2L`).
   - **1-Click WhatsApp Invitation Generator:**
     - Generates a pre-formatted bilingual onboarding message containing the login portal URL (`/admin/login`), client email, and access code, ready to send directly to couples or Wedding Organizers via WhatsApp.
   - **Instant Suspension & Revocation:**
     - Clicking "Suspend" on any client immediately revokes access across both web sessions and API requests. The signed cookie session validator checks `public.clients.status === 'active'` on every request, providing zero-delay security enforcement.
   - **Event Assignment & Package Tier Overrides:**
     - Assign unassigned / platform-owned events to any client account.
     - Override package tier entitlements (`pocket_roll`, `classic_35mm`, `grand_archive`, `owner_unlimited`), guest caps, and max shots per guest with immediate server-side enforcement.

3. **Client Host Portal Scoping (`/admin`):**
   - **Strict Event Scoping:** `getActiveAdminEvent()` and `listAdminEvents()` query strictly by `WHERE client_id = session.clientId`. Client hosts cannot view, query, or switch into events belonging to other clients or unassigned owner events.
   - **Tailored Event Switcher:**
     - If a client has only 1 event and `max_events === 1`, the switcher displays a clean static event title and status badge with no dropdown or unauthorized `+ New Event` button.
     - If a client holds a multi-event package (`max_events > 1`), they can toggle between their own events, while new event creation is strictly capped by their package limit.
   - **Owner-Only Route & Navigation Shielding:**
     - System infrastructure controls (`/admin/connect-drive`, `/admin/health`, `/api/admin/drive/**`, `/api/admin/drive-health`) are completely stripped from client navigation bars and mobile drawers.
     - Direct HTTP requests to infrastructure and superadmin routes are rejected with `403 Forbidden: Superadmin access required`.
   - **Clear Storage Status Card:**
     - Replaces technical Drive OAuth details with a straightforward "Google Drive Storage: Connected" card, confirming that guest photos are safely saved in real time to the event drive folder.

4. **Tenant Ownership Enforcement on Photos (`/api/admin/photos/[id]/**`):**
   - Individual photo routes (streaming `/image`, deletion `/delete`, hide `/hide`, unhide `/unhide`, and bulk `.ZIP` exports) verify tenant ownership before returning or mutating data.
   - If a client requests a photo ID belonging to another client or unassigned event, the route rejects the request with `403 Forbidden: Access denied to photo`.

---

## 14. Event-Day Upload Queue Invincibility — 500-Guest Spike Protection, Phone-Lock Auto-Resume & Sync UX Guard

1. **Mission-Critical Event Reliability:**
   - At peak reception moments (cake cutting, bouquet toss, first dance), hundreds of guests simultaneously snap and upload photos over fluctuating ballroom cellular networks.
   - To guarantee zero lost photos and eliminate server overload, the entire capture-to-drive pipeline is hardened against rate limits, lockouts, and client lifecycle interruptions.

2. **Server-Side Jittered Exponential Backoff (`withDriveRetry`):**
   - All Google Drive API interactions (folder hierarchy creation, root lookups, and resumable session initializations) are wrapped in `withDriveRetry`.
   - **Rate-Limit Spike Mitigation:** Catches HTTP `429 Too Many Requests` and HTTP `403` rate-limit errors (`userRateLimitExceeded`, `rateLimitExceeded`, `usageLimits`), retrying with randomized jitter:
     $$\text{delay} = 400\text{ms} \times 2^{\text{attempt}} + \text{random}(0..350\text{ms})$$
     preventing synchronized retry spikes (thundering-herd effect).
   - **Fail-Fast on Disk Full:** If Google Drive returns HTTP `403` with `storageQuotaExceeded`, the operation immediately aborts without retries, avoiding cascading timeouts when an event Google account reaches storage limits.
   - **Folder Caching:** In-memory caching for `(rootFolderId, guestId)` mappings prevents redundant Google Drive API round-trips for repeat guest shots.

3. **Guaranteed Local Commit & Phone-Lock Auto-Resume (`IndexedDB`):**
   - **Local-First Storage:** When a guest taps "Keep Photo", both the filtered film photo and full-resolution original are committed directly to `IndexedDB` **before** any network call begins. Even if the guest immediately locks their phone or the browser is killed, the capture remains safe on the device.
   - **Lifecycle Re-Engagement:** Queue processing automatically triggers on:
     - `visibilitychange` (when returning to the camera tab or waking the screen).
     - `pageshow` (restoring from Safari WebKit page cache).
     - `online` (regaining connectivity after cellular drops or airplane mode).
     - 12-second foreground heartbeat interval to prevent stalled background workers.
   - **Self-Healing Stale Locks:** If an upload process is interrupted mid-flight (e.g., phone screen auto-lock), locks older than 45 seconds are automatically returned to `queued` state.
   - **Slow Network In-Flight Protection:** To prevent duplicate parallel uploads on slow Edge/3G connections, items actively being uploaded in the current JavaScript runtime (`activeInFlightIds`) are protected from premature timeout resets, with a 45-second `AbortController` cleanly tearing down stalled HTTP requests before retrying.

4. **Sync Status UX & Tab Safety:**
   - **Real-Time Top Bar Sync Pill:** The camera top bar features an unobtrusive sync indicator:
     - Pulsing amber dot with pending photo count during active background uploads.
     - Smooth transition to a green `"✓"` confirmation pill (displaying for 3 seconds) the moment the queue clears.
     - Pulsing rose indicator if cloud sync is temporarily paused.
   - **Detailed Status Sheet:** Tapping the sync pill opens the full-screen `SyncStatusSheet` with bilingual status descriptions and reassuring offline explanations.
   - **Accidental Closure Guard (`beforeunload`):** If a guest attempts to close or reload the browser while photos are actively syncing, the browser prompts with a confirmation modal, preventing accidental loss before cloud delivery completes.
   - **Dual-Master Bandwidth Optimization:** If an event tier has `dual_master_enabled: false`, the app skips capturing and uploading the secondary unfiltered original, cutting client bandwidth usage and Drive API calls by 50%.

---

## 15. 3-Zone Luxury Editorial Header, Context Switcher & Quiet Account Menu

1. **Spatial Breadcrumb Architecture:**
   - In accordance with Vercel and Linear design principles, the Admin navigation bar is organized into three distinct, balanced zones:
     - **Zone 1 (Left):** Unveiled Brand Mark + subtle `/` slash divider + ghost `EventSwitcher` (anchoring current event context on the left, directly preceding the event-scoped navigation).
     - **Zone 2 (Center):** 5 single-line primary navigation tabs (`Dashboard`, `Gallery`, `QR & Print`, `Look Lab`, `Settings`) with clear high-contrast active states.
     - **Zone 3 (Right):** Minimal `32x32px` Guide icon button + unified User Account Dropdown.

2. **Ghost Context Switcher (`EventSwitcher.tsx`):**
   - Replaces the bulky rectangular status badges and serif font clashes in the top bar with clean geometric sans typography (`font-medium text-xs sm:text-sm text-zinc-200`).
   - A refined `6px` status dot displays event health:
     - Emerald (`bg-emerald-400`): Active event
     - Amber (`bg-amber-400`): Paused intermission
     - Zinc (`bg-zinc-500`): Concluded archive
   - Full text badges (`ACTIVE`, `PAUSED`, `ARCHIVED`) are reserved for the open dropdown list.
   - Dropdown menu is positioned left-aligned with the trigger for natural breadcrumb expansion.

3. **Quiet Account Menu & Zero Cartoon Emojis:**
   - Replaces the standalone yellow button and truncated email address pill with a compact circular initial avatar (with a warm gold ring for Platform Owners) and role label.
   - The popover cleanly houses:
     - Full account email and role badge (`Platform Owner` or `Host Admin`).
     - **Platform Owner Console (`/superadmin`)** with a crisp vector shield icon (**zero cartoon emojis**).
     - **Drive & System Health (`/admin/health`)** and **Google Drive Vault (`/admin/connect-drive`)**.
     - **Admin User Guide** shortcut.
     - Divider + **Sign Out** action in rose accent.

---

## 16. Luxury Editorial Redesign Across Superadmin, Dashboard & Settings

1. **Platform Owner Console (`/superadmin`):**
   - **3-Zone Header:** Mirrors `AdminNavbar` with Zone 1 breadcrumbs (`UNVEILED / Platform Console`), Zone 2 segmented filter (`All Clients`, `Active`, `Suspended`), and Zone 3 actions (`Wedding Admin` ghost button + `+ New Client Account` amber CTA).
   - **Editorial KPI Metric Strip:** 4 platform metric cards (`Active Clients`, `Event Rolls`, `Photos Synced`, `Registered Guests`) housed in `bg-white/[0.02] border border-white/[0.07]` darkroom surfaces with `32x32px` icon wells and monospace numerical counts.
   - **Client Directory:** Replaced crowded tables with tactile client cards. Client names rendered in crisp medium sans, credentials presented in a quiet monospace `DZ-XXXXXX` pill with 1-click copy feedback, and a clean WhatsApp invitation generator with zero cartoon emojis.
   - **Interactive Tier Selection:** Replaced plain `<select>` dropdowns in client event management with interactive visual radio cards (`Pocket Roll`, `Classic 35mm`, `Grand Archive`, `Owner Unlimited`).

2. **Event Dashboard (`DashboardView.tsx`):**
   - **Header Banner:** Features luxury display serif typography, a `6px` live camera status dot (emerald for open/active, rose for closed/paused), monospace event slug link, and a balanced `h-8` quick-action cluster (`Print QR Card` primary gold CTA, `Download All` ghost button, `Guest Camera` ghost button).
   - **KPI Metric Strip:** 4 top cards (`Confirmed Photos`, `Guests Registered`, `Drive Usage`, `Upload Health`) with `32x32px` icon wells and monospace metrics.
   - **Drive Vault Card & Navigation:** Quiet Google Drive status banner and refined quick-link cards with Lucide vector arrow indicators.
   - **Recent Photo Uploads Table:** Clean darkroom table with status dots, monospace timestamps, and ghost action buttons.

3. **Event Settings (`SettingsView.tsx`):**
   - **5 Calm Darkroom Sections:**
     1. *Event Identity & Theme:* Event subtitle, couple names, exposures per roll (with package entitlement lock), theme accent/background hex pickers, and welcome note.
     2. *Schedule & Camera Control:* Manual shutter toggle and automated open/close scheduling.
     3. *Event Link & Access Window:* Camera URL with 1-click copy, duration presets (12h, 24h, 48h, 7d), exact expiration display, and cryptographic token rotation modal.
     4. *Active Film Simulation & 3D LUT Recipe:* Clean optgroup presets without emojis and direct `.cube` 3D LUT file importer.
     5. *Guest Device Sessions & Maintenance:* Active session counter and safe reset confirmation modal.
   - **Standardized Form Controls:** Uniform dark inputs (`bg-zinc-900/80 border border-zinc-800 text-sm rounded-lg focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30`).
   - **Zero Cartoon Emojis:** Replaced all emojis (`✨`, `📁`, `⚡`, `⚠️`, `✓`) across alerts, modals, and dropdowns with crisp `1.75px` stroke Lucide vector icons.

---

## 17. Complete Luxury Editorial Sweep: Gallery, A4 Print Studio & Look Lab

1. **Editorial Photo Gallery & Lightbox (`PhotosManagementView.tsx` & `AdminPhotoLightbox.tsx`):**
   - **Typography & Darkroom Surfaces:** Display serif header (`Photo Gallery & Rolls`), uppercase tracked category badges, and monospace counters on quiet darkroom surfaces (`bg-white/[0.02] border border-white/[0.07]`).
   - **Zero Raw Emojis / Text Symbols:** Replaced all raw symbols (`✦`, `◯`, `📁`, `⏳`, `←`, `→`, `✕`, `✓`) with precision `1.75px` stroke Lucide vector icons (`Sparkles`, `Circle`, `Eye`, `EyeOff`, `ChevronLeft`, `ChevronRight`, `Download`, `X`).
   - **Dark Glass Lightbox Action Dock:** Features high-contrast dark glass master toggles (`Film` with `Sparkles` icon vs. `Original` with `Circle` icon), preserved `44x44px` touch targets, and fluid swipe gestures.
   - **Bulk PKZIP Export Modal:** Restructured with tactile darkroom option cards (`Per Guest Folders`, `By Variant`, `Both Film & Originals`) and animated monospace progress indicator.

2. **QR Code & Vertical A4 Poster Studio (`QrGeneratorView.tsx`):**
   - **Editorial Controls:** Warm display serif header, 1-click guest camera URL copy action with visual checkmark feedback, and a primary Gold `Print A4 Poster` CTA with Lucide `Printer` icon.
   - **Darkroom Preview Mat:** Framed in a calm `bg-black/40 border border-white/[0.06]` mat for presentation while keeping 100% of `@media print` rules pixel-perfect for physical A4 paper printing.

3. **Look Lab Color Calibration Studio (`LookLabView.tsx`):**
   - **Vector Curated Stocks:** Replaced decorative emojis (`🎞️`, `✨`, `💾`) with Lucide `Film`, `Sparkles`, `Save`, and `RotateCcw` vector SVGs.
   - **Darkroom Segmented Controls:** Clean tab switching (`Parameters`, `Reference Fit`, `Scene Checklist`), standardized stage bisection selectors, and uniform parameter sliders.

---

## 18. Production Audit Hardening, Dual-Master Separation & Anti-QRIS Camera Stationary

Following a full live reception audit on `https://dazzwed.vercel.app`, the platform introduces 16 surgical production hardening defenses across security, authentication, photo-rendering, storage reconciliation, and physical print design:

1. **Strict Guest Link Token Security (`/e/[slug]`):**
   - **No Cookie Bypass on Invalid Tokens:** If a candidate token parameter (`?t=` or `?token=`) is provided in the URL, it must strictly match the event's active access token. Corrupted, mutated, or tampered links (e.g. `?t=103685F6fds`) are rejected immediately, even if the visitor's browser holds a previous valid session cookie.
   - **Distinct Error Screens:** Visitors with corrupted or missing tokens are presented with a dedicated **"Camera Link Invalid"** screen (`CAMERA LINK INVALID` badge with instructions to scan the venue QR code), reserving the **"Camera Roll Concluded"** screen strictly for events whose scheduled expiration has elapsed.
   - **Locked Monospace Guest URL in Settings:** The guest URL in event settings is rendered in a locked read-only container with an explicit lock icon, preventing accidental host keystrokes over the domain.

2. **Server-Side Authentication Redirects & Onboarding:**
   - **Immediate Login Redirect:** Visiting `/admin/login` while already authenticated immediately redirects to `/superadmin` for Platform Owners and `/admin` for Hosts.
   - **Superadmin Direct Routing:** Superadmin sign-ins default directly to `/superadmin` instead of the event admin console.
   - **Extended Quota Limits:** Removed the arbitrary `<= 10` limit on `max_events` in `/superadmin` (increased to `999`), enabling wedding planners and production agencies to manage dozens or hundreds of client rolls.
   - **Zero-Event Empty Onboarding State:** Client accounts with 0 assigned events receive a luxury onboarding card with a direct `+ Create Your First Event Roll` action instead of an alarming database migration error.
   - **Locked Client Assignment in Edit Event:** The Client Owner assignment dropdown in the Superadmin Edit Event modal is locked by default with an intentional `Transfer Ownership` toggle, preventing accidental client reassignments.

3. **Dual-Master RAW Separation & Guest Name Integration:**
   - **Pure 2D RAW Capture:** When saving RAW originals (`originalBlob`), the capture pipeline bypasses the WebGL shader completely, capturing directly from the raw `<video>` element into an offscreen 2D canvas with exact sensor crop and mirror geometry, guaranteeing **zero LUT, zero grain, zero halation, zero vignette, and zero date stamps** on the archival original.
   - **Prominent Guest Names:** Registered guest names (`Napa`, `Syaffa`, `Son`) are highlighted across gallery roll filter pills, photo card overlays, and .ZIP download folders.
   - **Dedicated Guest Rolls Directory:** The Admin Gallery features a dedicated Guest Rolls mode (`/admin/photos?view=rolls`), and clicking `Guests Registered` on the dashboard navigates straight to this directory with 1-click `View Photos` filtering.

4. **Safe Google Drive Reconciliation & Zero-Empty ZIPs:**
   - **OAuth Reconnect Banners:** Proactively detects `invalid_grant` or probe failures across `/superadmin` and `/admin/health`, rendering a prominent amber alert banner with a 1-click `Reconnect Google Drive` button and instructions to verify Google Cloud OAuth "In Production" status.
   - **Safe Storage Reconciliation Tool:** An in-app `Sync Drive` action in the gallery checks confirmed photo records against Google Drive with bounded concurrency. If Drive returns `404 Not Found` or `trashed: true`, orphaned database rows are safely marked as failed, aligning Supabase, gallery counts, and .ZIP exports 1:1 with Google Drive.
   - **Zero Empty Folders in .ZIP:** Guest folders are only generated in PKZIP archives when photo binaries are successfully fetched, guaranteeing 0 empty directories.

5. **Refined 35mm Guest Camera A4 Print Signage:**
   - **Horizontal Brand Logo:** Centered horizontal brand mark + wordmark (`/Unveiled_logo_horizontal_transparent.png`) providing balanced editorial proportions.
   - **Unmistakable Analog Visuals:** The A4 print stationary (`/admin/qr`) features 35mm film stock sprocket perforations, viewfinder corner crop marks `[ + ]`, and a bold darkroom header badge: `GUEST CAMERA • SCAN TO TAKE PICTURES`.
   - **Clean English & Straightforward Phrasing:** Clear, international English copy throughout utilizing familiar "Take Pictures" terminology (`Scan with your phone to take pictures` and `15 PHOTOS PER GUEST • NO APP REQUIRED`).
   - **3-Step Visual Strip:** Clean vector icons illustrating `01. Scan QR Code` -> `02. Take Pictures` -> `03. Saved Automatically` (straightforward guidance explaining photos are saved directly to the couple's wedding album without analog darkroom jargon).
   - **Zero Raw Emojis:** All printable graphics and preview banners use precision vector SVGs for crisp, cross-platform editorial typography on both screen and physical A4 printing.

6. **Drive Health Telemetry & Client Host Diagnostics RBAC:**
   - **Universal Diagnostic Access:** Both platform Superadmins and authenticated Client Hosts (such as Dinda & Harsya) have full permission to invoke `/api/admin/drive-health` (supporting both `GET` and `POST` methods).
   - **Peace of Mind for Hosts:** Client hosts can trigger `Run Live Health Check` on their dashboard at any time to verify cloud vault operational status, quota, and test upload/delete responsiveness without receiving `403 Forbidden: Superadmin access required` errors.
   - **Platform Configuration Isolation:** Root OAuth credential management and reconnection flows (`/admin/connect-drive` and `/api/auth/google/start`) remain strictly restricted to Superadmins, with client dashboard views displaying non-interactive platform vault indicators instead of broken configuration links.

7. **Globally Unique Event Access Tokens & Non-Repeating Cryptographic Rotation:**
   - **Database-Level Unique Constraint:** Enforced via migration `0013_unique_event_access_token.sql`, establishing a PostgreSQL `UNIQUE` partial index on `public.events(access_token)` (`WHERE access_token IS NOT NULL`).
   - **Collision-Free Generation:** All event creation endpoints (`/api/admin/events` and `/api/superadmin/clients`) generate tokens via `generateUniqueEventToken`, querying the database in a bounded loop to guarantee no two events ever share the same access link.
   - **Non-Repeating Rotation:** When an event host or superadmin rotates an access token (`/api/admin/events/token`), the rotation algorithm strictly guarantees the new token will never match the event's previous token.

8. **Multi-Tenant Client Isolation Guard (`assertEventTenantAccess`) & Authenticated QR:**
   - **Centralized Object-Level Authorization:** Guarantees that client host sessions (`role = "client"`) can only read, mutate, or download assets for events that strictly belong to their tenant account (`event.client_id === session.clientId`).
   - **Comprehensive Route Enforcement:** Applied across all administrative mutation and inspection routes:
     - `PATCH /api/admin/settings` (wedding couple names, shots per guest quota, schedule, status)
     - `POST` & `PATCH /api/admin/events/token` (token rotation and access window expiration)
     - `POST /api/admin/settings/reset-sessions` (force guest session invalidation)
     - `PUT /api/admin/events` (active event switcher cookie)
     - `POST /api/admin/photos/reconcile` & `GET /api/admin/photos` (scoped photo queries)
     - `GET /api/admin/qr` (QR image generation)
   - **Immediate Rejection:** Any cross-tenant attempt immediately fails with `403 Forbidden` (`FORBIDDEN_CROSS_TENANT`), preventing horizontal privilege escalation across clients.
   - **Authenticated QR Endpoint:** `GET /api/admin/qr` strictly requires an authenticated session (`401 Unauthorized` for anonymous requests), eliminating remote unauthorized extraction of private event access tokens.

9. **Zero-Flicker Returning Guest Roll Pre-Hydration:**
   - **Instant Frame 1 Counter Rendering:** On `/e/[slug]`, the server component evaluates the guest's session cookie and queries their verified photos count and remaining rolls during the initial SSR render.
   - **Eliminates Capacity Flash:** Injects `initialGuest` into the client camera app, allowing the top bar and welcome back toast to immediately display the true remaining shots (e.g. 9 remaining) on frame 1 instead of briefly flashing maximum capacity (e.g. 24) before syncing.

10. **Multi-Session Guest Roll Gallery & Quota Parity:**
   - **Mathematical Roll Alignment:** Solves discrepancies where guests captured photos across multiple sessions, tabs, or devices. The private "My Photos" modal calculates roll progress using true shots taken (`totalShots - shotsLeft`), matching the camera shutter counter.
   - **Cloud Album Synced Cards:** For photos confirmed in Google Drive whose local device thumbnails were taken in an earlier tab or before browser cache was refreshed, the contact sheet grid pads the display with clean `SAVED IN ALBUM` cards, ensuring all taken shots are accounted for in the guest's view.

## 19. Security Audit Run-3 Hardening: OAuth CSRF Vault Protection, Photo Proxy Scoping & Bounded LUT Management

Following an independent automated security audit (`run-3`) adhering to Cloudflare's `security-audit` standard profile, three defense-in-depth mitigations were implemented across authentication, media proxying, and file management:

1. **OAuth 2.0 CSRF Protection & Superadmin Callback Enforcement:**
   - **Superadmin Session Gate:** `GET /api/auth/google/callback` enforces `getAuthSession()` with role verification (`session.role === "superadmin"`). Unauthenticated or client-role requests are rejected immediately with 401/403 before exchanging any authorization codes or updating database credentials.
   - **Cryptographic Session-Bound State Token:** `GET /api/auth/google/start` generates an HMAC-SHA256 signed state token containing the event slug, a 24-byte random cryptographic nonce, and a 10-minute expiration timestamp. This token is written to an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`dazzwed_oauth_state`) and verified upon callback via constant-time signature comparison (`crypto.timingSafeEqual`). If the cookie is absent, mismatched, or expired, the request is aborted with a CSRF error and the cookie is purged.

2. **Unified Photo Proxy Database Resolution & Tenant Isolation:**
   - **Elimination of Raw Drive ID Fallback:** In `GET /api/admin/photos/[id]`, the handler eliminates arbitrary raw Drive file streaming. All identifiers (whether UUIDs or Google Drive file IDs) are strictly resolved against `public.photos` joined with `public.events(client_id)`.
   - **Strict Multi-Tenant Scoping:** If a client host accesses `/api/admin/photos/[id]`, the server validates that `photo.events.client_id === session.clientId`. Requests for unmapped Drive file IDs return `404 Not Found`, and cross-tenant requests return `403 Forbidden: Access denied to photos of another client`.

3. **Memory-Safe Bounded LUT Uploads & Stock Preset Protection:**
   - **Strict 2 MB Payload Ceiling:** `POST /api/admin/luts` enforces `file.size <= 2 * 1024 * 1024` bytes before reading the file into memory, returning `413 Payload Too Large` if exceeded to protect against memory/disk exhaustion.
   - **Protected System Stock Presets:** Built-in film simulation profiles (`warm-portrait-400.cube`, `classic-neg-400.cube`, `tungsten-800t.cube`, etc.) cannot be overwritten. Any upload matching a protected preset returns `403 Cannot overwrite system stock LUT preset`.
   - **Client Tenant Namespace Isolation:** Custom LUT files uploaded by client hosts are automatically prefixed with their tenant identifier (`client-${session.clientId.slice(0, 8)}-${name}.cube`), ensuring multiple wedding organizers cannot overwrite each other's custom color profiles.
   - **Content Verification:** The handler verifies the text content is free of binary null bytes and contains valid `LUT_3D_SIZE` or `LUT_1D_SIZE` declarations before saving.







