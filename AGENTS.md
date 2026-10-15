<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mandatory Living User Guide Rule

Whenever any feature, UI flow, admin control, or privacy behavior is added, updated, or removed in Dazzwed, you MUST automatically update both:
1. The in-app Admin Guide (`src/app/admin/guide/page.tsx` & `src/components/admin/AdminGuideView.tsx`)
2. The root technical user manual (`USER_GUIDE.md`)

in the same commit so that the host guide and buyer documentation are always 100% accurate, complete, and synchronized with the actual codebase implementation.
