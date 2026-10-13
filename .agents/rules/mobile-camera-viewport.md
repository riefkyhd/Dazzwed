# Mobile Camera Viewport & Zoom Invariants

1. **Scoped Page-Zoom Prevention**:
   - Do NOT set `maximumScale: 1` or `userScalable: false` on the root `Viewport` export in `src/app/layout.tsx`, so that the guest landing page and admin portal remain accessible and pinch-zoomable.
   - Prevent browser page-zooming strictly inside the camera screen by applying `touch-action: none` (`touch-none`) on the viewfinder gesture surface (`ViewfinderGestures.tsx`) and calling `e.preventDefault()` on non-passive iOS Safari `gesturestart` and `gesturechange` listeners.

2. **Pointer-Event Gesture Machine**:
   - Handle single-finger tap-to-focus, vertical exposure slider drag (`[-2.0, +2.0]` EV), double-tap EV reset, 600ms long-press AE/AF lock, and two-finger pinch-to-zoom through the unified React Pointer Events state machine (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`) on the `touch-action: none` viewfinder overlay.

3. **Discrete Zoom & Physical Lens Honesty (`0.5×`, `1×`, `2×`, `3×`)**:
   - Resolve discrete presets in strict 3-tier priority order (`resolveZoomPreset` in `src/lib/camera/lenses.ts`):
     1. **`camera-switch`**: Select a separate `deviceId` stream ONLY when its identity and magnification explicitly match the preset (`ultrawide` for `0.5×`, `main` for `1×`, or a `tele` camera whose label explicitly states `2x` or `3x`). Never switch to a generic `"Back Telephoto Camera"` on `2×` because its native optical factor may be `3×` or `5×`. When on `0.5×` `ultrawide` and the user selects `1×`, `2×`, or `3×`, switch back to the primary `1×` `main` stream first.
     2. **`browser-zoom-constraint`**: On the primary `1×` stream, when `track.getCapabilities().zoom` covers the target preset, clamp to `[min, max]` and call `track.applyConstraints({ advanced: [{ zoom }] })`.
     3. **`app-digital-crop`**: Fall back to centered UV/canvas crop (`effectiveDigitalZoom = Math.max(1, digitalZoom)`) applied identically to live preview and captured output.
   - Never claim that `getSettings().zoom`, a successful `applyConstraints()` call, or a camera label proves physical optical lens switching.

4. **16:9 Full-Bleed Control Non-Overlap**:
   - In `16:9` (`mode === "full-bleed"`), render `<LensBar />` inside the footer control stack above the shutter button rather than at `bottom-3` of the full-bleed viewfinder container.
