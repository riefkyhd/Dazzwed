# Look Engine & Film Grain Shader Invariants

1. **Procedural Film Grain Simulation**:
   - **No Float `fract()` or Skewed Lattice Hashes**: Never use float-based `fract(sin(...) * large_float)` or 45°-skewed 2D simplex lattices for grain. They cause severe floating-point mantissa exhaustion, periodic moiré, and diagonal banding/hatching artifacts on high-DPI mobile screens.
   - **32-Bit Integer PRNG (PCG3D)**: Use bitwise 32-bit integer permutation PRNGs (e.g., PCG3D) to achieve isotropic, uncorrelated, cross-GPU deterministic noise.
   - **Triangular Probability Distribution (TPDF)**: Sum independent uniform random variables to approximate Gaussian crystal density falloff instead of harsh uniform digital spike noise.
   - **Subtractive Beer-Lambert Law Density Modulation**: Film grain is physical light absorption through microscopic silver halide or dye clouds. Grain must modulate optical density logarithmically/subtractively ($rgb_{out} = rgb \cdot 2^{-D \cdot strength}$), ensuring pure blacks remain inky ($0 \cdot x = 0$) and highlights never clip or wash out.
   - **Hurter-Driffield (H&D) RMS Granularity Curve**: Peak granularity must be centered around midtones ($L \approx 0.28\text{--}0.38$), dropping off sharply in deep shadows ($L < 0.03$, film base D-min) and rolling off smoothly in dense highlights ($L > 0.75$, negative D-max).

2. **Shader Uniform Upload & Reactivity Invariants**:
   - In interactive tuning tools (Look Lab, sliders, live previews), never cache uniform uploads based only on a subset of fields (e.g., `look.id` or `intensity`).
   - Every controllable parameter (exposure EV, vignette, grain amount, roughness, curves, distortion) must propagate immediately to GPU uniforms without requiring a secondary trigger.
