# Look Engine & Film Grain Shader Invariants

1. **Single Render Pipeline (WebGL2 Look Engine v2)**:
   - All live viewfinder previews, in-app photo captures, Look Lab diagnostics, and native-camera imports must render through `LookEnginePipeline` (`src/lib/imaging/looks/pipeline.ts`).
   - 3D `.cube` LUTs (sizes 17 and 33) are sampled natively inside `LookEnginePipeline` via a WebGL2 `sampler3D` texture (`gl.TEXTURE_3D` with `gl.LINEAR` interpolation and configurable intensity), never through a separate Three.js renderer.

2. **Procedural Film Grain Simulation**:
   - **No Float `fract()` or Skewed Lattice Hashes**: Never use float-based `fract(sin(...) * large_float)` or 45°-skewed 2D simplex lattices for grain. They cause floating-point mantissa exhaustion, periodic moiré, and diagonal banding/hatching artifacts on high-DPI mobile screens.
   - **32-Bit Integer PRNG (PCG3D)**: Use bitwise 32-bit integer permutation PRNGs (`pcg3d`) to achieve isotropic, uncorrelated, cross-GPU deterministic noise.
   - **Triangular Probability Distribution (TPDF)**: Sum independent uniform random variables to approximate Gaussian crystal density falloff instead of harsh uniform digital spike noise.
   - **Subtractive Beer-Lambert Law Density Modulation**: Film grain is physical light absorption through microscopic silver halide or dye clouds. Grain must modulate optical density logarithmically/subtractively ($rgb_{out} = rgb \cdot 2^{-D \cdot strength}$), ensuring pure blacks remain inky ($0 \cdot x = 0$) and highlights never clip or wash out.
   - **Hurter-Driffield (H&D) RMS Granularity Curve**: Peak granularity must be centered around midtones ($L \approx 0.28\text{--}0.38$), dropping off sharply in deep shadows ($L < 0.03$, film base D-min) and rolling off smoothly in dense highlights ($L > 0.75$, negative D-max).
   - **Discrete Grain Tick**: Reseed grain at a discrete temporal tick (default 24 Hz; static under `prefers-reduced-motion` and on low-end tiers; deterministically seeded from `shotId` on capture).

3. **Coordinate Mapping & Uniform Reactivity Invariants**:
   - Every texture fetch from `u_image` in `LookEnginePipeline` (including center samples, chromatic aberration offsets, radial blur taps, and local contrast neighborhood taps) must pass through `mapCropUv(...)` so aspect crop rects and front-camera horizontal mirroring (`u_mirror`) apply identically across all shader stages without ghosting.
   - In interactive tuning tools (Look Lab, sliders, live previews), never cache uniform uploads based only on a subset of fields (`look.id` or `intensity`). Every controllable parameter must propagate immediately to GPU uniforms.
