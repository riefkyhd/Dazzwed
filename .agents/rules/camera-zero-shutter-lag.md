# Camera Zero-Shutter Lag & Output Resolution Rules

1. **Instant Viewfinder Preview Snapshot ($\le 1\text{ ms}$)**:
   - Freeze the live WebGL viewfinder preview loop (`isFrozenRef`) at $t_0$ upon shutter click (or after the $260\text{ ms}$ hardware torch / screen flash AE/AWB stabilization window when flash is active) and immediately extract a review `ImageBitmap` via `createImageBitmap(canvas)` so the review modal paints in $t_4 \le 50\text{ ms}$ (budget $\le 250\text{ ms}$).
   - Keep the viewfinder frozen until the user explicitly taps **Keep Photo** or **Retake**.

2. **Two-Phase Decoupled Archival Render (`tier = "high"` Default)**:
   - Render the full archival filtered JPEG and optional clean original JPEG asynchronously in the background while the user inspects the review screen.
   - Default output tier is **`"high"`**: target `maxEdge: 4096` (or the full camera stream / sensor dimensions if smaller) at JPEG `quality: 0.92`.
   - Native-camera imports preserve sensor resolution up to the device-safe canvas/texture limit (using tiled processing when needed) and automatically fall back to the largest safe size (`4096` $\rightarrow$ `3072` $\rightarrow$ `2560` $\rightarrow$ `2048`) on memory-constrained devices without failing.
   - If the user taps **Retake**, abort any in-flight background render via `AbortController` and release all `ImageBitmap` / temporary canvas resources immediately.

3. **Strobe Flash Isolation**:
   - When hardware torch or screen flash is triggered, allow a $260\text{ ms}$ stabilization window before grabbing the illuminated frame, and strictly guarantee turning the torch off in a `finally` block before background archival encoding.

4. **No Synchronous GPU Barriers in Viewfinder**:
   - Never call `gl.finish()` or `readPixels()` inside the live viewfinder preview loop.
