# Camera Zero-Shutter Lag & Performance Rules

1. **Instant Sensor Snapshot**: Always capture an immutable sensor snapshot immediately at t ≈ 50ms - 80ms upon shutter click using `createImageBitmap(video)` before initiating any canvas or WebGL post-processing. Never allow downstream processing to delay frame acquisition.
2. **Viewfinder Freeze**: Freeze the live viewfinder preview loop (`isFrozenRef`) as soon as capture begins and keep it frozen until the user explicitly keeps or retakes the photo.
3. **Two-Phase Decoupled Render**:
   - Phase 1: Render the filtered review image first (target maxEdge: 2048px, quality: 0.88) to surface the review modal under 350ms.
   - Phase 2: Render the clean original backup asynchronously in the background while the user inspects the review screen.
4. **Strobe Flash Isolation**: Pulse the hardware torch strictly during the `createImageBitmap` acquisition phase (80ms stabilization + ~40ms grab) and guarantee turning it off in a `finally` block before starting image rendering.
5. **No Synchronous GPU Barriers in Viewfinder**: Never call `gl.finish()` inside the live `requestAnimationFrame` viewfinder preview loop. Rely on standard browser canvas compositor swapping.
