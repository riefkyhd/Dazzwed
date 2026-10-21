# Dazzwed — QA & Testing Credentials and Links

This document provides a centralized reference of all active testing environments, role credentials, guest event links, access tokens, and administrative consoles for Dazzwed.

---

## 1. Environment Base URLs

| Environment | Base URL | Notes |
| :--- | :--- | :--- |
| **Production (Main)** | `https://dazzwed.vercel.app` | Primary production domain with Vercel edge deployment |
| **Production (Latest Deployment)** | `https://dazzwed-jdmdg8oy3-riefkyhd-dev.vercel.app` | Direct deployment URL |
| **Local Development** | `http://localhost:3000` | Run locally via `npm run dev` |

---

## 2. Platform Owner / Superadmin Credentials

The Platform Owner has global visibility across all client tenants, active event rolls, cloud vaults, and system health metrics.

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Login URL** | [https://dazzwed.vercel.app/admin/login](https://dazzwed.vercel.app/admin/login) | Unified login page for both Owner and Client accounts |
| **Email** | `riefkyhd.dev@gmail.com` | Registered in `ADMIN_EMAILS` and Supabase Auth |
| **Password** | `TemporaryOwnerPassword2026!` | Standard Supabase Auth password |
| **Role Assigned** | `superadmin` | Cookie signed via HMAC-SHA256 (`dazzwed_auth_session`) |
| **Default Land Page** | [https://dazzwed.vercel.app/superadmin](https://dazzwed.vercel.app/superadmin) | Platform Owner Management Console |

### Superadmin Capabilities
- Access Platform KPI overview (Active Clients, Total Rolls, Photos in Cloud Vault, System Storage).
- Provision new Client Host accounts and generate 1-click WhatsApp invitations.
- Assign wedding events to specific clients and override package tiers (`classic_35mm`, `grand_archive`, etc.).
- Connect master Google Drive Vault via OAuth (`/admin/connect-drive`).
- Manage and inspect all client events directly without cross-tenant restrictions.

---

## 3. Client Host Accounts (Couples / Event Hosts)

Clients authenticate using their registered email and their unique **8-character alphanumeric access code** (acting as their password).

### Client Account 1: Dhifa & Riefky
| Field | Value |
| :--- | :--- |
| **Client Name** | `Dhifa & Riefky` |
| **Login Email** | `dhifa.riefky.1758@wedding.test` |
| **Access Code** | `6WNAEXEV` |
| **Account Status** | `active` (Max Events: 1) |
| **Assigned Event** | `our-wedding` (ID: `09e7100d-446b-498e-b07b-74d3c04e4e47`) |
| **Login URL** | [https://dazzwed.vercel.app/admin/login](https://dazzwed.vercel.app/admin/login) |
| **Target Dashboard** | [https://dazzwed.vercel.app/admin](https://dazzwed.vercel.app/admin) (Host Admin View) |

### Client Account 2: Dinda & Harsya
| Field | Value |
| :--- | :--- |
| **Client Name** | `Dinda & Harsya` |
| **Login Email** | `dindaharsya@gmail.com` |
| **Access Code** | `8E5CH87T` |
| **Account Status** | `active` (Max Events: 1) |
| **Assigned Event** | `wedding` (ID: `89db6ae7-a5a6-4868-b670-a98eac6ec863`) |
| **Login URL** | [https://dazzwed.vercel.app/admin/login](https://dazzwed.vercel.app/admin/login) |
| **Target Dashboard** | [https://dazzwed.vercel.app/admin](https://dazzwed.vercel.app/admin) (Host Admin View) |

---

## 4. Active Guest Event Camera Links & Tokens

Guests access the camera directly via their mobile browser using the event slug and the high-entropy access token query parameter (`?t=TOKEN`).

### Event 1: Dhifa & Riefky (`our-wedding`)
- **Direct Guest Camera Link:**
  [https://dazzwed.vercel.app/our-wedding?t=103685F6](https://dazzwed.vercel.app/our-wedding?t=103685F6)
- **Local Dev Camera Link:**
  `http://localhost:3000/our-wedding?t=103685F6`
- **Slug:** `our-wedding`
- **Access Token:** `103685F6`
- **Token Validity:** Valid until **November 20, 2026** (`2026-11-20T01:35:10Z`)
- **Roll Limit:** 27 shots per guest
- **Package Tier:** Classic 35mm
- **Dual Master Vault:** Enabled (Connected to Google Drive Folder `1k0aWNMPddFUUA6XthlvhFZriRstwwzIf`)

### Event 2: Wedding / Dinda & Harsya (`wedding`)
- **Direct Guest Camera Link:**
  [https://dazzwed.vercel.app/wedding?t=AYJ7FPYQ](https://dazzwed.vercel.app/wedding?t=AYJ7FPYQ)
- **Local Dev Camera Link:**
  `http://localhost:3000/wedding?t=AYJ7FPYQ`
- **Slug:** `wedding`
- **Access Token:** `AYJ7FPYQ`
- **Token Validity:** Valid until **Saturday, Oct 24, 2026** (`2026-10-24T06:39:46Z`)
- **Roll Limit:** 25 shots per guest
- **Package Tier:** Classic 35mm

---

## 5. Administrative Navigation Sitemap

When logged into an authorized account, test each of these views:

| Page / Section | URL | Intended Role | Description |
| :--- | :--- | :--- | :--- |
| **Unified Login** | `/admin/login` | Public / All | Email and password/access code authentication |
| **Superadmin Console** | `/superadmin` | `superadmin` only | Global client roster, KPI metrics, package tiers, event assignment |
| **Host Admin Dashboard** | `/admin` | Both (`superadmin` & `client`) | Host overview, live roll count, quick actions, event status |
| **QR Code & Poster Generator** | `/admin/qr` | Both | Printable table card generator with embedded access token |
| **Film Look Customizer** | `/admin/looks` | Both | Presets selector, grain, tone curves, custom 3D `.cube` LUT upload |
| **Live Photo Gallery & Vault** | `/admin/photos` | Both | Real-time photo stream, lightbox, status, ZIP export |
| **Google Drive Vault Settings** | `/admin/connect-drive` | `superadmin` only | Google OAuth Drive integration for dual-master cloud backup |
| **Host Living User Guide** | `/admin/guide` | Both | In-app interactive host manual with search and step-by-step flows |

---

## 6. Recommended Testing Workflows

### Test Flow A: Superadmin vs Client Tenant Isolation
1. Open a regular browser window and visit `/admin/login`.
2. Sign in with `riefkyhd.dev@gmail.com` / `TemporaryOwnerPassword2026!`.
   - Verify you land on `/superadmin` or `/admin` with the **"Owner"** badge in the top navigation bar.
   - Verify the "Superadmin Console" and "Google Drive" links are visible.
3. Open an **Incognito / Private Window** and visit `/admin/login`.
4. Sign in with `dindaharsya@gmail.com` / `8E5CH87T`.
   - Verify you land on `/admin` with the **"Host Admin"** badge.
   - Verify the "Superadmin Console" and "Google Drive" links are **hidden**.
   - Attempting to visit `/superadmin` directly redirects back to `/admin` with a 403 boundary.
   - Verify the photos list shows only photos belonging to the `wedding` event.

### Test Flow B: Guest Camera & Unique Access Token Validation
1. Open mobile browser or Chrome DevTools (Device Mode: iPhone 14 Pro / Pixel 7).
2. Visit the authenticated event link: `https://dazzwed.vercel.app/wedding?t=AYJ7FPYQ`.
   - Verify the onboarding screen loads with "ROLL OPEN UNTIL SATURDAY, OCT 24".
   - Tap **"Start camera"**, allow camera permissions, and take 1 test photo.
   - Verify instant capture sound, haptic feedback, and roll countdown (`24 remaining`).
3. Now test invalid token protection:
   - Visit `https://dazzwed.vercel.app/wedding?t=INVALID99`.
   - Verify the page displays the **"Invalid or Expired Event Link"** error screen and prevents camera activation.

### Test Flow C: UU PDP Privacy & Roll Erasure
1. On the initial camera onboarding screen (before starting roll):
   - Open **"Privacy & Terms"**.
   - Verify the red `"Withdraw consent & delete my roll"` button is **hidden** (informational text only).
2. Start the camera and take 1 photo (creating an active guest session).
3. Open camera settings (gear icon) -> **"Privacy & Consent"**.
   - Verify `"Withdraw consent & delete my roll"` button is now **visible**.
   - Tap it and confirm erasure.
   - Verify local IndexedDB cache is purged and session resets cleanly.

---

## 7. Important Operational Notes

- **Login Rate Limiter:** The login route enforces 5 attempts per minute per IP address. Exceeding this triggers a standard `429 Too Many Requests` response with a 60-second cooldown.
- **Session Lifespan:** The `dazzwed_auth_session` cookie is valid for 30 days. To force a logout, use the account menu -> "Sign out" or clear cookies for the domain.
- **Account Suspension:** If a client account is marked `suspended` in the `clients` table, all active sessions for that tenant are rejected immediately on the next server request.
