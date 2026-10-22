# Design System Specification: Dazzwed / UNVEILED

> Single Source of Aesthetic Truth for Dazzwed & the `miqdadbadjuber/anti-slop` ecosystem.  
> Governed by `antislop` Rule R-37 (Positive Design Read & Aesthetic Direction).

---

## 1. Brand Identity, Personality & Mood

### Product Name & Domain
- **Product Name:** Dazzwed / UNVEILED
- **Domain:** Luxury B2B2C Disposable 35mm Film Camera SaaS for Weddings & Private Receptions.
- **Audience:** Wedding couples, event hosts, professional wedding planners, and reception guests.

### Aesthetic Archetype
**Leica Darkroom Studio × Editorial Print Magazine × Linear/Vercel Precision SaaS**

### Core Mood & Sensory Attributes
- **Tactile & Analog:** Physical camera mechanics, darkroom red-safe lighting, silver-halide grain textures, analog date stamps, mechanical shutter sounds, and physical paper stationery.
- **Intimate & Archival:** Warm candlelight, bridal ivory, golden-hour memories, high-trust archival storage, and permanent preservation.
- **Quiet Luxury:** Restrained surfaces, hairline borders, uncrowded negative space, bespoke typography pairings, and zero neon or synthetic distractions.
- **Precision Engineering:** Vercel- and Linear-grade spatial hierarchy, instantaneous micro-interactions, zero-flicker state hydration, and pixel-perfect responsive layouts.

### Visual References
- **Leica Q3 / M11:** Matte anodized obsidian metal, knurled dials, precise mechanical tolerances, tactile shutter curtains.
- **Kodak Portra 400 & Fujifilm Pro 400H:** Warm skin tones, pastel foliage greens, organic highlight bloom, and gentle shadow roll-off.
- **Frame.io & DaVinci Resolve:** Calm darkroom media review suites where user photographs take center stage.
- **Linear & Vercel:** Disciplined 3-zone spatial navigation, mono metadata tags, and ghost interactive states.

### Visual Anti-Patterns (What Dazzwed Never Is)
- **Never a consumer toy app:** No cartoon avatars, bouncy rubber-band springs, gamified confetti, or bubbly shapes.
- **Never generic AI/SaaS slop:** No blue-to-purple gradients, floating purple orbs, glassmorphism on every card, or centered generic marketing copy.
- **Never a payment/banking utility:** Table QR signage never looks like a financial transaction or QRIS payment card.
- **Never cluttered with pills:** No rows of overlapping multi-colored badges; no raw Unicode emojis (`👑`, `🔥`, `✨`, `⚡`) in UI chrome.

---

## 2. `antislop` Liveliness Toolkit Dials & Design Read

Per Rule R-37 of `antislop`, the aesthetic dials are calibrated specifically for Dazzwed's two distinct product contexts:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DAZZWED LIVELINESS DIAL MATRIX                     │
├─────────────────────────┬───────────┬────────────┬──────────────────────┤
│ Surface Context         │ ENERGY    │ RHYTHM     │ MOTION               │
├─────────────────────────┼───────────┼────────────┼──────────────────────┤
│ Guest Camera Surface    │ 3 (Med-Hi)│ 1 (Focused)│ 2 (Crisp Mechanical) │
│ Admin & Console Views   │ 1 (Calm)  │ 3 (Cadenced│ 1 (Restrained Inst.) │
└─────────────────────────┴───────────┴────────────┴──────────────────────┘
```

### Guest Camera Surface (`/e/[slug]`)
- **ENERGY: 3 (Medium-High):** Tactile analog photography simulation. Mechanical shutter release feedback, physical film-advance haptics, optical viewfinder guides, and real-time WebGL film grade emulation.
- **RHYTHM: 1 (Focused & Immediate):** Zero visual clutter. The viewfinder dominates 100% of the active framing area, with chrome controls tucked strictly into top and bottom letterbox margins.
- **MOTION: 2 (Crisp Mechanical & Optical):** Physical shutter curtain snap (`120ms–220ms` cubic-bezier), gentle amber upload sync pulses, and fluid sheet transitions. Respects `prefers-reduced-motion` by collapsing to instant opacity transitions.

### Admin Portal & Owner Console (`/admin/**`, `/superadmin`)
- **ENERGY: 1 (Calm & Editorial):** Darkroom review environment. Deep obsidian surfaces (`#0C0A09`), quiet card wells, and subtle hairline dividers allowing guest photography to command full visual attention.
- **RHYTHM: 3 (Disciplined 3-Zone Spatial Cadence):** Editorial display serif titles &rarr; structured 4-card KPI strip &rarr; high-density contact sheet grid or 2-column settings layout.
- **MOTION: 1 (Restrained & Instant):** `150ms cubic-bezier(0.16, 1, 0.3, 1)` hover and focus transitions. Zero decorative bouncy physics; modal backdrops animate strictly via simple opacity fades (`150ms`).

---

## 3. Color Palette & Pre-Verified WCAG Contrast Matrix

All color pairings are mathematically verified against WCAG 2.1 standards. Body and label text strictly exceed `4.5:1` (WCAG AA), and display text exceeds `3.0:1`.

```
Relative Luminance Formula: L = 0.2126*R + 0.7152*G + 0.0722*B
Contrast Ratio: (L1 + 0.05) / (L2 + 0.05)
```

### Darkroom Digital Surfaces (Screen)

| Token Name | Hex Code | Tailwind Equivalent | Purpose / Application | Contrast vs `#0C0A09` | WCAG Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Canvas Base** | `#0C0A09` | `stone-950` / `zinc-950` | Primary app & darkroom background | `1.00:1` | Base |
| **Card Surface** | `#141210` | `bg-white/[0.02]` on base | Studio card well, elevated container | `1.08:1` | Surface |
| **Elevated Modal** | `#18181B` | `zinc-900` | Flyout menus, dialogs, lightboxes | `1.32:1` | Container |
| **Hairline Border** | `rgba(255,255,255,0.07)` | `border-white/[0.07]` | Standard card and table dividers | — | Decorative |
| **Active Border** | `rgba(251,191,36,0.45)` | `border-amber-400/45` | Focus rings, active cards, gold stroke | — | Focus / State |

### Typography & Foreground Contrast Ratios (Evaluated against `#0C0A09`)

| Token Name | Hex Code | Tailwind Class | Contrast vs `#0C0A09` | Minimum Required | Verified Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Ivory** | `#F4F4F5` | `text-zinc-100` | **17.97:1** | `4.5:1` | **PASS (AAA)** |
| **Secondary Text** | `#D4D4D8` | `text-zinc-300` | **13.37:1** | `4.5:1` | **PASS (AAA)** |
| **Muted Metadata** | `#A1A1AA` | `text-zinc-400` | **7.71:1** | `4.5:1` | **PASS (AAA)** |
| **Disabled / Faint**| `#71717A` | `text-zinc-500` | **4.09:1** | `3.0:1` | **PASS (AA Large / Non-text only)** |

> [!NOTE]
> `zinc-400` (`#A1A1AA`, `7.71:1`) is the mandatory floor for all readable body text, form labels, and kickers. `zinc-500` (`#71717A`, `4.09:1`) is restricted strictly to non-critical disabled states or non-text decorative icons.

### Brand Accent & Semantic Status Tokens

| Role | Token / Hex | Tailwind Class | Usage & Contrast Specification |
| :--- | :--- | :--- | :--- |
| **Champagne Gold** | `#FBBF24` | `amber-400` | Primary brand accent; `11.83:1` against canvas. Solid gold buttons use `#09090B` text (`11.92:1` AAA contrast). |
| **Gold Highlight** | `#FCD34D` | `amber-300` | Secondary gold accents, active text highlights (`13.70:1` AAA). |
| **Active / Ready** | `#34D399` | `emerald-400` | Camera active status dot, sync confirmation pill (`10.28:1` AAA). |
| **Warning / Syncing**| `#FBBF24` | `amber-400` | Intermission status dot, queue uploading indicator (`11.83:1` AAA). |
| **Destructive / Error**| `#FB7185` | `rose-400` | Delete actions, expired tokens, connection failures (`7.34:1` AAA). |

### Archival Print Stationery Palette (Physical Paper — `/admin/qr`)

| Token Name | Hex Code | Application on A4 Physical Print |
| :--- | :--- | :--- |
| **Warm Luxury Paper** | `#FDFBF7` | Natural textured ivory/cream A4 stock background |
| **Dark Print Ink** | `#1A1816` | High-contrast typography, hero QR modules, badge fills |
| **Archival Gold Foil** | `#D4AF37` | Double ornamental borders, camera aperture glyph, corner brackets |
| **Muted Bronze Ink** | `#8C7A5B` | Editorial subtitle, photos quota badge, card footer notes |
| **Guide Container Well**| `#F4EFE6` | 3-step visual instruction card background (`0.85` opacity) |
| **Step Guide Divider** | `#E6DEC8` | Vertical hairline separator lines on instruction strip |

---

## 4. Typography System & Tri-Font Pairing Rules

Dazzwed enforces a strict tri-font architectural hierarchy:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRI-FONT PAIRING SYSTEM                          │
├───────────────────────┬──────────────────────┬──────────────────────────┤
│ Font Category         │ Font Family Variable │ Strict Functional Scope  │
├───────────────────────┼──────────────────────┼──────────────────────────┤
│ Display & Editorial   │ Playfair Display     │ Couple names, hero titles│
│ UI & Controls         │ Inter                │ Buttons, tabs, inputs    │
│ Technical & Optical   │ System Monospace     │ Quotas, roll codes, URLs │
└───────────────────────┴──────────────────────┴──────────────────────────┘
```

### 1. Display & Editorial Serif (`font-serif` — Playfair Display)
- **Token:** `var(--font-serif-head)` &rarr; `font-serif`
- **Weights:** Regular (`400`), Italic (`400`)
- **Tracking:** Tight (`tracking-tight` / `-0.02em`)
- **Strict Scope:** Couple names (`Dinda & Harsya`), landing screen headers, hero page titles (`Photo Gallery & Rolls`), and celebration screens.
- **Restriction:** Never used for buttons, interactive labels, table data, or navigation tabs.

### 2. UI & Control Sans (`font-sans` — Inter)
- **Token:** `var(--font-sans-body)` &rarr; `font-sans`
- **Weights:** Regular (`400`), Medium (`500`), Semibold (`600`)
- **Strict Scope:** Navigation tabs, form inputs, button labels, dropdown menus, body prose, and data tables.
- **Section Kickers:** `text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-400 font-medium`.

### 3. Technical & Optical Monospace (`font-mono` — System Monospace)
- **Token:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` &rarr; `font-mono`
- **Weights:** Regular (`400`), Medium (`500`), Bold (`700`)
- **Features:** Tabular numerals (`tabular-nums`)
- **Strict Scope:** Numerical shot counters (`14 / 25 SHOTS`), Crockford Base32 roll codes (`JJYSHK`), camera LUT names, timestamps, URL slugs (`/e/wedding`), and diagnostic HUD readouts.
- **Rule of Separation:** Serif and Monospace are never blended within the same button or pill badge.

---

## 5. Layout, Spatial Hierarchy & Navigation Architecture

### Admin 3-Zone Spatial Breadcrumb Top Bar (`AdminNavbar.tsx`)

Following Vercel and Linear spatial hierarchy, the primary navigation bar is divided into three functional zones:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Zone 1 (Left)              │ Zone 2 (Center)            │ Zone 3 (Right)          │
│ [UNVEILED] / [• Wedding ▾] │ Dashboard Gallery QR Looks │ [?]  [ (RH) Host ▾ ]    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

1. **Zone 1 (Left — Context & Scope):**
   - Brand Wordmark: `UNVEILED` emblem image or text (`h-5 w-auto`).
   - Slash Divider: Oblique separator (`/` in `text-zinc-700 font-light select-none text-sm`).
   - Ghost Event Switcher (`EventSwitcher.tsx`): Minimal ghost button with refined `6px` status dot (`bg-emerald-400` for Active, `bg-amber-400` for Paused, `bg-zinc-500` for Archived).
2. **Zone 2 (Center — Event Navigation Tabs):**
   - 5 single-line navigation items (`Dashboard`, `Gallery`, `QR & Print`, `Look Lab`, `Settings`).
   - Active Tab: High-contrast state (`bg-white/[0.08] text-white font-semibold rounded-lg px-3 py-1.5 shadow-sm`).
   - Inactive Tab: Subtle state (`text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] rounded-lg px-3 py-1.5`).
3. **Zone 3 (Right — Utility & Account Menu):**
   - Compact `32x32px` Guide icon button (`?`).
   - Unified User Account Dropdown: Avatar circle with initials, role badge (`Owner` / `Host`), with system diagnostics, Drive connection, and Sign Out safely nested inside. Raw email addresses are never displayed in the top bar.

### One-Border-Per-Cluster Rule
- Across any toolbar, filter group, or modal footer, a visual cluster contains **at most one** high-emphasis bordered or solid accent button.
- Secondary actions utilize quiet ghost surfaces (`bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/10`).

### Mobile Touch Targets & Viewport Discipline (`antislop-layoutmobile`)
- **Minimum Tap Target:** `44x44px` for all interactive elements, shutter buttons, camera toggles, navigation tabs, and modal dismiss buttons (`touch-manipulation`).
- **Safe Area Insets:** Strict observance of `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Viewport Containment:** Strict horizontal overflow prohibition (`overflow-x-hidden`) across all viewports from `320px` to `2560px`.

---

## 6. Component Specifications & Interactive States

### Button Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ High-Emphasis (Gold):   bg-amber-400 hover:bg-amber-300 text-zinc-950 │
│ Secondary Solid:        bg-zinc-800 hover:bg-zinc-700 text-zinc-200    │
│ Ghost Surface:          bg-white/[0.03] hover:bg-white/[0.07] border-0 │
│ Destructive Action:     bg-rose-500/10 hover:bg-rose-500/20 text-rose-300│
└────────────────────────────────────────────────────────────────────────┘
```

- **Admin Toolbars:** Compact `h-8` (`32px`) or `h-9` (`36px`), `rounded-lg`, `text-xs font-medium`.
- **Guest Actions:** Ergonomic `h-11` (`44px`) or `h-12` (`48px`), `rounded-xl`, `text-sm font-semibold`.

### Form Controls & Inputs
- **Input Surface:** `bg-zinc-900/80 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600`.
- **Focus Rings:** High-visibility focus indicators (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:border-amber-400/60`).

### Iconography Standard
- **Renderer:** Precision `1.75px` stroke vector SVGs (Lucide icon set).
- **Zero Raw Emojis:** Unicode cartoon emojis (`👑`, `📷`, `✨`, `🎉`, `⚡`, `✓`, `✕`) are prohibited in UI chrome, navigation buttons, and status badges.

### Contact Sheet Photo Cards & Lightbox
- **Card Framing:** Darkroom mat framing (`bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden`).
- **Dual-Master Toggle:** High-contrast pill toggle between `Film` (with vector film icon) and `Original` (with vector circle icon).
- **Attribution Pill:** Monochrome frosted pill displaying guest name and roll code (`Napa (7K9X2B)`).

---

## 7. Guest Disposable Camera & Optical Engine

### Camera Ergonomics & Viewfinder Architecture
- **Viewfinder Ratio:** Edge-to-edge camera stream with aspect-ratio containment (`3:4` or `16:9`).
- **Tactile Shutter Button:** Fixed `78px` circular shutter dock featuring physical press feedback, animated countdown progress ring, and zero-flicker exposure decrementing.
- **Zero-Flicker Roll Quota:** Server-side pre-hydration eliminates count flashing on load; the remaining count reflects true confirmed shots instantly.
- **Flash Intensity Control:** Streamlined toggle between `Soft Fill` (negative EV highlight protection on rear camera; 65% warm-ivory glow on front camera) and `Standard` (full-power hardware torch).

### Non-Intrusive Cloud Sync Status
- **Syncing State:** Pulsing amber dot in header (`Syncing 1 photo...`).
- **Synced State:** Emerald indicator (`All saved ✓`) for 3 seconds before quietly dismissing.
- **Offline Safety:** IndexedDB offline storage holds full-resolution photos locally until cellular signal is restored, without blocking the guest from continuing to shoot.

### Guest Onboarding & Privacy Architecture
- **Pre-Consent Gate:** Zero cookies, zero IndexedDB writes, and zero telemetry before the guest explicitly agrees to album storage.
- **Erasure Action Guard:** Destructive roll deletion actions (`Withdraw consent & delete my roll`) are hidden for first-time visitors and exposed exclusively within active roll sessions.

---

## 8. Print Stationery & Anti-QRIS Visual Identity

Wedding table cards in Indonesia frequently risk confusion with digital bank transfer codes (*QRIS / Amplop Digital*). The printable stationery (`/admin/qr`) integrates unmistakable physical analog camera markers:

```
┌───────────────────────────────────────────────────────────┐
│ [::]                                                 [::] │
│                      U N V E I L E D                      │
│                     THE WEDDING OF                        │
│                     Dinda & Harsya                        │
│                                                           │
│     ┌───────────────────────────────────────────────┐     │
│     │  📷 GUEST CAMERA • SCAN TO TAKE PICTURES      │     │
│     └───────────────────────────────────────────────┘     │
│                                                           │
│                  ┌─────────────────────┐                  │
│               [+]│                     │[+]               │
│                  │     HERO QR CODE    │                  │
│                  │     (540 x 540 px)  │                  │
│               [+]│                     │[+]               │
│                  └─────────────────────┘                  │
│                                                           │
│            Scan with your phone to take pictures          │
│            25 PHOTOS PER GUEST • NO APP REQUIRED          │
│                                                           │
│     ┌───────────────────────────────────────────────┐     │
│     │  01. Scan QR  │  02. Snap Photo │ 03. Auto-Save│    │
│     └───────────────────────────────────────────────┘     │
│ [::]                                                 [::] │
└───────────────────────────────────────────────────────────┘
```

1. **35mm Film Sprocket Margins:** 22 perforated sprocket holes (`72px` and `1106px` margins) running down both borders.
2. **Viewfinder Corner Guides:** Corner crop brackets `[ + ]` framing the QR card box.
3. **Hero QR Sizing:** `540x540px` hero QR inside a `640x640px` card container, scannable up to 2 meters away across banquet tables.
4. **Header Banner Badge:** High-contrast dark badge reading `GUEST CAMERA • SCAN TO TAKE PICTURES`.
5. **Anti-QRIS Callout Phrasing:** Explicit clarification: `25 PHOTOS PER GUEST • NO APP REQUIRED` (or in Indonesian: `BUKAN QRIS / BUKAN AMPLOP DIGITAL • GRATIS UNTUK SEMUA TAMU`).
6. **3-Step Visual Strip:** Illustrated vector sequence (`01. Scan QR Code` &rarr; `02. Take Pictures` &rarr; `03. Saved Automatically`).

---

## 9. Copywriting & Microcopy Voice

### Voice Principles
- **Direct & Unadorned:** State what the button, card, or setting does in the fewest possible words.
- **Authentic Analog Vocabulary:** Use domain-correct photography terms (*"Film Roll"*, *"Exposures"*, *"Developed Film"*, *"Raw Original"*, *"Contact Sheet"*) rather than cold database jargon (*"Assets"*, *"Buckets"*, *"Blobs"*).
- **Zero AI Buzzwords:** Never use empty filler phrases (*"Welcome to the future of..."*, *"Seamlessly elevate..."*, *"Empower your memories"*).
- **Clear Error Taxonomy:** Distinct separation between bad links and expired events:
  - `"Camera Link Invalid"`: Malformed, missing, or rotated access token.
  - `"Camera Roll Concluded"`: Event scheduled access window has naturally closed.

### Microcopy Reference Pairs

| Context | Banned Slop Pattern | Dazzwed Standard |
| :--- | :--- | :--- |
| **Gallery Subtitle** | *Browse guest shots in Retina clarity, compare film graded looks vs RAW sensor originals, and manage rolls.* | **Browse and download guest photos.** |
| **QR Poster Subtitle**| *High-resolution vertical A4 portrait printable poster with Unveiled branding and guest camera instructions.* | **Printable A4 table sign with event QR code and guest instructions.** |
| **Settings Look Badge**| *GPU Color Science* | **Default Look** |
| **Settings Look Desc**| *Choose the default photo recipe applied to all guest captures. The camera renders analog colors, halation bloom, and silver-halide grain.* | **Choose the default film look applied to guest photos.** |
| **Session Reset** | *Reset active cookies and session storage across all guest phones. When guests have reached their shot limit, resetting issues everyone a brand new roll...* | **Reset guest rolls to give everyone {n} fresh shots. Existing uploaded photos remain safe.** |
| **ZIP Export Modal** | *Download full-resolution wedding captures directly in your browser without compression degradation.* | **Download all event photos as a ZIP file.** |
| **Drive Status** | *Google Drive Health & Storage Vault (DRIVE VAULT OPERATIONAL)* | **Google Drive Storage (CONNECTED)** |

---

## 10. Design System Governance & Codebase Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CODEBASE TOKEN MAPPING                          │
├─────────────────────────┬──────────────────────────────────────────────┤
│ Design System Token     │ Implementation File Location                 │
├─────────────────────────┼──────────────────────────────────────────────┤
│ CSS Variables & Palette │ src/app/globals.css                          │
│ Font Configuration      │ src/app/layout.tsx                           │
│ Top Bar Navigation      │ src/components/admin/AdminNavbar.tsx         │
│ Print Stationery SVG    │ src/components/admin/QrGeneratorView.tsx     │
│ Camera Viewfinder Dock  │ src/components/guest/CameraScreen.tsx        │
│ Review Shutter Modal    │ src/components/guest/ReviewModal.tsx         │
│ Gallery & Lightbox      │ src/components/admin/PhotosManagementView.tsx│
│ Living Host Guide       │ src/components/admin/AdminGuideView.tsx      │
│ Technical User Manual   │ USER_GUIDE.md                                │
└─────────────────────────┴──────────────────────────────────────────────┘
```

- **Single Source of Truth:** `DESIGN.md` defines the normative aesthetic specifications for all visual, spatial, and typographical components in Dazzwed.
- **Living Synchronization:** Whenever a visual token, layout structure, or component specification is modified in the codebase, `DESIGN.md`, `USER_GUIDE.md`, and `AdminGuideView.tsx` are updated in the same changeset.
