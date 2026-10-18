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
     - `2026-10-16T12-30-00_7EGE9X_1.jpg` (film-graded analog photos)
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
| **Shots Per Guest** | `/admin/settings` | Configures the number of shots on each guest's roll (e.g. 15 or 30). Updates in real time on active phones (with automatic roll extension toasts and auto-reopening the camera for guests who completed their roll). | Adjust anytime before or during the wedding. |
| **Reset All Guest Sessions** | `/admin/settings` | Grants all guests another 15-shot roll without deleting previous photos. | Use during after-parties or when resetting test phones before the wedding. |
| **Editorial Gallery & Lightbox** | `/admin/photos` & `/admin/guests` | High-definition Retina streaming gallery from Google Drive with zero external CDN costs. Toggle between contact-sheet grid and rolls table, filter by guest roll or horizontal film recipe pills, and open full-screen React Portal lightbox with strict aspect-ratio containment (zero cropping/unwanted zoom on 3:4 portrait or landscape photos), click-outside backdrop dismissal, touch swipe navigation, background scroll-lock, Film Graded vs. RAW Original comparison, and 1-click HD downloads. Features dynamic Crockford Base32 roll code resolution for all guests and graceful dark-room fallback cards for photos removed from Google Drive. | Review all wedding captures, download favorites, or inspect RAW originals. |
| **Product & Filter Usage Analytics** | `/admin/health` | Audit-safe, zero-PII aggregate insights tracking film recipe popularity, keep-to-retake ratios, guest shooting funnel, and camera hardware capture reliability (`takePhoto` vs `videoFrame`). | Monitor guest engagement and film recipe trends with 0ms added camera latency. |
| **Vintage Self-Timer (`3s / 10s`) & Instant Settings Sync** | `/e/[slug]` & `/admin/settings` | Authentic 1990s compact camera self-timer cadence (1 tick/sec for 10..4, 2 ticks/sec for 3..2, steady confirmation tone on 1) with instant 0ms shutter snap. Countdown preserves camera sensor Auto Exposure with zero premature torch blinding. Multi-layer Next.js cache invalidation (server-side `revalidatePath('/admin', 'layout')` and client-side `router.refresh()`) guarantees `/admin/qr` and A4 posters reflect event title/subtitle/quota updates in 0ms without manual page refreshes. | Group portraits, wedding table photos, and immediate print preview sync. |
| **Flash Intensity Control (Soft Fill vs Standard)** | `/e/[slug]` | Dedicated flash intensity setting in Camera Tools. 'Soft Fill' (default) provides flattering, gentle illumination with automatic negative EV highlight protection on rear camera and 65% warm-ivory screen glow on front camera; 'Standard' provides full-power direct flash. Shutter latency is reduced to 0ms overhead with eliminated cooldown delays. | Natural, non-blinding night & indoor captures without harsh overexposure. |

### Admin Navigation Layout (Clean Top Bar + Utility Dropdown)
The admin navigation uses a streamlined 5-link primary bar with an account popover:
- **Primary Desktop Nav (Single-Line, `>= 1024px`):** `Dashboard` (`/admin`), `Gallery` (`/admin/photos` & `/admin/guests`), `QR & Print` (`/admin/qr`), `Look Lab` (`/admin/look-lab`), and `Settings` (`/admin/settings`).
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
     - **`3x`:** Seamlessly switches to the 3x optical telephoto lens (`camera2 3`) or hardware zoom.
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

## 9. Vintage Point-and-Shoot Self-Timer Cadence & Flash Intensity Management

1. **Authentic 1990s Film Compact Self-Timer Cadence (`timer-cadence.ts` & `useCamera.ts`):**
   - **Seconds 10 down to 4 (1 tick/sec):** Single Web Audio 880Hz retro camera tick + subtle 15ms haptic pulse per second.
   - **Seconds 3 and 2 (Accelerated Double-Time Ticks — 2 ticks/sec):** Two rapid 1100Hz ticks per second to signal urgency.
   - **Final Count 1 (Confirmation Tone -> Instant Capture):**
     - **Confirmation Tone:** Confident 1320Hz tone + 30ms haptic confirmation (*"Hold your smile!"*).
     - **Sensor Auto-Exposure Protection:** The rear flashlight is never prematurely strobed during countdown, ensuring the camera sensor's Auto Exposure and live preview remain 100% stable, sharp, and undisturbed without blinding guests.
     - **Instant Shutter Capture (`0ms` Latency):** Shutter fires immediately at `t = 0` with zero artificial cooldown pause.
   - **De-Cluttered Viewfinder Badge:** Replaced chaotic full-screen flashing borders and blurs with a calm, steady vintage typography badge and subtle amber status indicator.
   - **Instant Cancellation:** Tapping the shutter button during countdown immediately clears all scheduled timeouts, terminates the cue, and resets state with 0ms delay.

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
   - **iOS CoreMotion Inverted Vector Normalization:** Apple WebKit/CoreMotion measures reaction force relative to the screen frame, inverting the coordinate sign convention compared to Android (`x`, `y`, and `z` are negated). Dazzwed detects iOS platforms (`isIOSPlatform()`) and automatically normalizes the vector (`x = -rawX`, `y = -rawY`, `z = -rawZ`) so Landscape Left (90°) and Landscape Right (-90°) orient with identical precision across all operating systems.
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
   - **Corner-Accurate Date Stamp:** Analog orange date stamp and emulsion effects are rendered directly on the landscape canvas, properly anchored to the true bottom-right corner.
   - **WebKit iOS Memory Safety & Synchronous Sensor Readout:** On iOS MobileSafari (iPhone 13+), WebKit suspends background video frame decoding when covered by opaque overlays or when preview loops pause. Dazzwed captures a full-resolution 2D canvas snapshot (`snapCanvas`) synchronously from the live `<video>` stream *before* shutter curtain closure and freezing, ensuring WebGL never samples empty frames. Furthermore, archival rendering on iOS devices is safely clamped to `1920px` max edge and all temporary canvases are immediately deallocated (`width = height = 0`), preventing WebKit GPU memory ceiling (256MB) crashes and unexpected page reloads on retake.

4. **Expanded Landscape Review Modal Presentation (`ReviewModal.tsx`):**
   - Automatically detects landscape dimensions (`width > height` or `aspect === "4:3"`).
   - Adapts the hero print container to `aspectRatio: "4 / 3"` or `"16 / 9"` with `max-w-xl`, presenting photos with zero letterboxing or distortion.
   - **Container-Aligned Action Buttons:** Action buttons ("Retake" & "Keep Photo") always follow their horizontal bottom dock without rotating, preserving clean typography, full touch targets, and natural horizontal reading alignment.
   - **Unified Shutter Transition:** The tactile shutter curtain stays closed during the brief 160ms archival development and opens seamlessly to the final developed photo with zero unrotated preview jumps or black frames.




