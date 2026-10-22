---
description: Dazzwed Luxury Darkroom Editorial UI & Navigation Design System Workflow
globs: src/components/**/*.{tsx,ts,jsx,js}, src/app/**/*.{tsx,ts,jsx,js}
---

# Dazzwed Luxury Editorial Design System (`/luxury-ui`)

> **Master Aesthetic Specification:** All positive design tokens, verified WCAG contrast matrices, typography pairing rules, liveliness dials (`ENERGY`, `RHYTHM`, `MOTION`), and stationery blueprints are authoritatively defined in [`DESIGN.md`](../../DESIGN.md).

Follow these strict rules whenever designing, modifying, or reviewing UI in Dazzwed.

---

## 1. 3-Zone Spatial Breadcrumb Hierarchy

Every desktop and tablet dashboard header MUST follow the Vercel / Linear 3-zone breadcrumb structure:

1. **Zone 1 (Left — Context & Scope):**
   - Brand mark (Unveiled / Dazzwed)
   - Oblique slash divider (`/` in `text-zinc-700 font-light select-none text-sm`)
   - Scope / Active Event Switcher (`EventSwitcher.tsx`):
     - Closed trigger MUST be a minimal ghost button (`hover:bg-white/[0.04] border border-transparent hover:border-white/10 rounded-lg px-2.5 py-1.5`).
     - State indicator is a refined `6px` status dot (`w-1.5 h-1.5 rounded-full`):
       - `bg-emerald-400` for Active
       - `bg-amber-400` for Paused
       - `bg-zinc-500` for Archived
     - Typography is geometric sans (`font-sans font-medium text-xs sm:text-sm text-zinc-200`).
     - Full textual status badges (`ACTIVE`, `PAUSED`, `ARCHIVED`) are reserved exclusively for the open dropdown list.

2. **Zone 2 (Center — Navigation Tabs):**
   - Single-line, cohesive navigation items (`Dashboard`, `Gallery`, `QR & Print`, `Look Lab`, `Settings`).
   - Active route: high-contrast, clean visual feedback (`bg-white/[0.08] text-white font-semibold rounded-lg px-3 py-1.5 shadow-sm`).
   - Inactive routes: subtle muted contrast (`text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] rounded-lg px-3 py-1.5 transition-colors`).

3. **Zone 3 (Right — Utilities & Account):**
   - Quiet, compact icon buttons (e.g. `w-8 h-8 rounded-lg` Guide `?` icon) taking minimal visual weight.
   - Consolidated User Account & Role Dropdown:
     - Avatar circle with user initial (`w-7 h-7 rounded-full bg-zinc-800` + warm gold ring `ring-1 ring-amber-400/40` for superadmin).
     - Compact role label (`Owner` or `Host`).
     - **NEVER display raw truncated email addresses in the top bar**.
     - Dropdown menu houses platform administration links (`/superadmin`, `/admin/health`, `/admin/connect-drive`) and Sign Out.

---

## 2. Anti-Slop Visual & Component Rules

1. **Anti-Pill Discipline:**
   - Eliminate "Kitchen Sink Syndrome": avoid crowding multiple bordered, colored pill badges next to each other.
   - Maximum 1 bordered interactive pill per visual cluster; prefer ghost surfaces (`hover:bg-white/[0.04] border border-transparent hover:border-white/10`).

2. **Zero Cartoon Emojis:**
   - Never use cartoon emojis (e.g., `👑`, `🔥`, `✨`, `🎉`, `⚡`) in navigation chrome, buttons, or status pills.
   - Use crisp monochrome or tinted vector SVG icons with consistent `1.5px` to `1.75px` stroke widths.

3. **Typography Pairing Law:**
   - **Editorial Serif (`font-serif`):** Reserved for hero headings, romantic titles, look recipe names, and couple names in large display views.
   - **Geometric Sans (`font-sans`):** Mandatory for all interactive UI elements, navigation labels, buttons, inputs, dropdown items, and toolbars.
   - **Monospace (`font-mono`):** Strictly for numerical metrics, roll codes, timestamps, technical URLs, and status badges.

4. **Darkroom Editorial Palette:**
   - Backgrounds: Deep obsidian (`bg-zinc-950`, `bg-black/90`, `bg-zinc-900`).
   - Borders: Restrained, hairline dividers (`border-zinc-800`, `border-white/10`).
   - Accents: Single warm gold/amber accent (`text-amber-400`, `bg-amber-400/10`) reserved for key focal points.
