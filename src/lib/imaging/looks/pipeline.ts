import type { LookRecipe, Matrix3x3 } from "./types";
import { getCachedCubeLUT, preloadCubeLUT, resolveLutUrl, type ParsedCubeLUT } from "./cube-lut";

/**
 * GLSL 3.00 ES Vertex Shader
 */
const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
precision highp int;

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * GLSL 3.00 ES Fragment Shader - Look Engine v2: Camera System
 * Stages:
 * 1. Lens Model: Barrel distortion, lateral chromatic aberration, radial softness, detail budget
 * 2. Film Response: Linear exposure EV, flash falloff, 3x3 dye matrix, per-channel curves (R/G/B), local contrast
 * 3. OKLab/OKLCH Grading & 3D LUT: 24-node hue table, skin protection (20-55 deg), brightness-dependent sat, gamut mapping, optional 3D .cube LUT, white protect
 * 4. Emulsion Optics: Bloom/halation screen blend, cos^4 vignette, exposure-aware multi-octave grain
 * 5. Output: Intensity blend, stage bisection, NaN/Inf hardware fallback
 */
const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_image;
uniform sampler3D u_lut;
uniform bool u_hasLut;
uniform float u_lutSize;
uniform float u_lutStrength;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
uniform bool u_isCapture;
uniform float u_frameHeight;
uniform bool u_isNativeCamera;
uniform vec4 u_cropRect; // xy: offset, zw: scale (in source texture coords)
uniform bool u_mirror;

// 1. Lens Model
uniform vec2 u_radialBlur; // r0, r1
uniform float u_chromaticAberration;
uniform float u_distortion; // barrel distortion k1
uniform vec4 u_vignette; // x: strength, y: radius, z: softness, w: curvature
uniform vec4 u_bloom; // x: threshold, y: strength, z: radius
uniform vec4 u_halation; // x: threshold, y: strength, z: radius, w: tint-enable
uniform vec3 u_halationTint;

// 2. Film Response
uniform float u_exposureEV;
uniform mat3 u_dyeMatrix;
uniform vec4 u_curveR; // contrast, pivot, toe, shoulder
uniform vec4 u_curveG;
uniform vec4 u_curveB;
uniform int u_shoulderType; // 0: soft, 1: hard
uniform float u_localContrast;
uniform float u_effectiveLines;
uniform vec4 u_flashFalloff; // strength, radius, cx, cy
uniform bool u_flashUsed; // Godox Xenon Strobe Direct-Flash Grading Pass

// 3. OKLCH Color Grading
uniform vec4 u_hueNodes[24]; // .x: hueDeg, .y: dHueDeg, .z: dChromaScale, .w: dLightness
uniform vec4 u_skinProtect; // x: enabled, y: minHue, z: maxHue, w: strength
uniform float u_saturation;
uniform vec2 u_brightSat; // x: shadowBoost, y: highlightDesat
uniform float u_highlightWarmth;
uniform vec3 u_shadowTint;
uniform float u_whiteProtect; // 1.0 = enabled

// 4. Emulsion Artifacts
uniform vec4 u_grain; // x: amount, y: size, z: roughness, w: chroma
uniform float u_grainExposureSens;
uniform float u_sceneExposure; // mean log-luminance

// Runtime & Diagnostics
uniform float u_intensity; // 0.0 to 1.0
uniform int u_debugStage; // 0: all, 1: lens, 2: response, 3: oklch, 4: bloom/vig, 5: grain
uniform bool u_debugOverlay;

// Linear Color Space conversions
vec3 srgbToLinear(vec3 c) {
  return mix(
    c / 12.92,
    pow(max(vec3(1e-4), (c + 0.055) / 1.055), vec3(2.4)),
    step(vec3(0.04045), c)
  );
}

vec3 linearToSrgb(vec3 c) {
  return mix(
    c * 12.92,
    1.055 * pow(max(vec3(1e-4), c), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), c)
  );
}

// Strictly guarded pow & safe math
float safePow(float base, float expVal) {
  return pow(max(base, 1e-4), expVal);
}

vec3 safePowVec(vec3 base, vec3 expVal) {
  return pow(max(base, vec3(1e-4)), expVal);
}

// OKLab Color Conversions
vec3 linearSrgbToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  float l_ = safePow(l, 1.0 / 3.0);
  float m_ = safePow(m, 1.0 / 3.0);
  float s_ = safePow(s, 1.0 / 3.0);
  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

vec3 oklabToLinearSrgb(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

// Interleaved Gradient Noise (Jorge Jimenez, Call of Duty / SIGGRAPH 2014)
// Textureless, isotropic, zero-overflow float hash that executes flawlessly across 100% of mobile GPUs
// (Qualcomm Adreno, ARM Mali, Apple Silicon, PowerVR) without 32-bit integer arithmetic hazards.
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Triangular-PDF random distribution centered at 0.0 in range [-1.0, 1.0].
// By Central Limit Theorem, the sum of two decorrelated uniform distributions forms a triangular/Gaussian
// probability density function, reproducing physical silver halide crystal dispersion without digital salt-and-pepper spikes.
vec3 triangularGrainNoise(vec2 p, vec2 seedVec) {
  vec2 sp = p + seedVec;
  float r1 = ign(sp);
  float r2 = ign(sp + vec2(47.43, 19.87));
  float g1 = ign(sp + vec2(113.11, 71.39));
  float g2 = ign(sp + vec2(157.23, 91.07));
  float b1 = ign(sp + vec2(211.73, 137.29));
  float b2 = ign(sp + vec2(259.91, 163.41));
  return vec3(r1 + r2, g1 + g2, b1 + b2) - vec3(1.0);
}

// Organic multi-scale emulsion texture:
// - Micro-structure: high-frequency fine silver halide crystals
// - Macro-structure: gentle low-frequency dye-cloud agglomeration clumping (modulated by roughness)
vec3 sampleEmulsionGrain(vec2 fragCoord, float grainSize, float roughness, float seedOffset) {
  float scale = max(1.0, grainSize);
  vec2 cell = fragCoord / scale;
  vec2 seedVec = vec2(mod(seedOffset * 17.13, 1000.0), mod(seedOffset * 43.17, 1000.0));

  vec3 micro = triangularGrainNoise(cell, seedVec);

  if (roughness > 0.05) {
    // Low-frequency dye-cloud clumping with smooth Hermite cubic interpolation
    vec2 macroP = cell * 0.35 + vec2(mod(seedOffset * 7.31, 500.0), mod(seedOffset * 13.91, 500.0));
    vec2 iCell = floor(macroP);
    vec2 f = fract(macroP);
    f = f * f * (3.0 - 2.0 * f); // Hermite cubic smoothstep

    vec3 c00 = triangularGrainNoise(iCell, vec2(53.1, 17.7));
    vec3 c10 = triangularGrainNoise(iCell + vec2(1.0, 0.0), vec2(53.1, 17.7));
    vec3 c01 = triangularGrainNoise(iCell + vec2(0.0, 1.0), vec2(53.1, 17.7));
    vec3 c11 = triangularGrainNoise(iCell + vec2(1.0, 1.0), vec2(53.1, 17.7));

    vec3 clump = mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
    micro = mix(micro, micro * (1.0 + clump * 0.65), clamp(roughness, 0.0, 1.0) * 0.55);
  }

  return clamp(micro, vec3(-2.0), vec3(2.0));
}

// Filmic Tone Curve evaluation supporting soft and hard shoulders
float evalChannelCurve(float x, vec4 curve, int shoulderType) {
  float clampedX = clamp(x, 0.0, 1.0);
  float toe = clamp(curve.z, 0.0, 0.5);
  float val = clamp(toe + clampedX * (1.0 - toe), 0.0, 1.0);
  float pivot = clamp(curve.y, 0.01, 0.99);
  float contrast = max(0.1, curve.x);
  
  if (val <= pivot) {
    val = pivot * safePow(val / pivot, contrast);
  } else {
    float highBase = clamp((1.0 - val) / max(1e-4, 1.0 - pivot), 0.0, 1.0);
    val = 1.0 - (1.0 - pivot) * safePow(highBase, contrast);
  }

  float shoulder = curve.w;
  if (shoulder < 0.99 && val > shoulder) {
    float over = (val - shoulder) / max(1e-4, 1.0 - shoulder);
    if (shoulderType == 1) {
      // Hard shoulder for CCD sensor clipping
      val = shoulder + (1.0 - shoulder) * min(1.0, over * 0.6);
    } else {
      // Continuous C1 cubic film shoulder: matches incoming slope at t=0,
      // rolls off tangentially to 1.0 at t=1.0 with zero clipping kink
      float t = clamp(over, 0.0, 1.0);
      val = shoulder + (1.0 - shoulder) * (t * (1.0 + t - t * t));
    }
  }
  return clamp(val, 0.0, 1.0);
}

vec2 mapCropUv(vec2 normUv) {
  vec2 uv = normUv;
  if (u_mirror) {
    uv.x = 1.0 - uv.x;
  }
  return clamp(u_cropRect.xy + uv * u_cropRect.zw, vec2(0.0), vec2(1.0));
}

void main() {
  vec2 uv = v_texCoord;
  vec4 baseColor = texture(u_image, mapCropUv(uv));
  vec3 origRgb = clamp(baseColor.rgb, 0.0, 1.0);
  vec3 rgb = origRgb;

  bool hasNaN = false;
  bool isOutOfRange = false;

  // ==========================================
  // STAGE 1: LENS MODEL
  // ==========================================
  vec2 p = uv - 0.5;
  float rho2 = dot(p, p) * 4.0; // 0 at center, 1 at edges

  // 1a. Barrel Distortion
  vec2 distUv = uv;
  if (u_distortion > 0.0001) {
    distUv = 0.5 + p * (1.0 + u_distortion * rho2);
  }

  // 1b. Lateral Chromatic Aberration
  if (u_chromaticAberration > 0.00001) {
    vec2 caOffset = p * (u_chromaticAberration * rho2);
    rgb.r = texture(u_image, mapCropUv(distUv + caOffset)).r;
    rgb.g = texture(u_image, mapCropUv(distUv)).g;
    rgb.b = texture(u_image, mapCropUv(distUv - caOffset)).b;
  } else if (u_distortion > 0.0001) {
    rgb = texture(u_image, mapCropUv(distUv)).rgb;
  }

  // 1c. Radial Softness
  float blurRad = u_radialBlur.x + u_radialBlur.y * rho2;
  if (blurRad > 0.0005) {
    vec2 bStep = vec2(blurRad) * (u_resolution.y / max(vec2(1.0), u_resolution));
    vec3 bTap = texture(u_image, mapCropUv(distUv + vec2(bStep.x, bStep.y))).rgb +
                texture(u_image, mapCropUv(distUv - vec2(bStep.x, bStep.y))).rgb +
                texture(u_image, mapCropUv(distUv + vec2(-bStep.x, bStep.y))).rgb +
                texture(u_image, mapCropUv(distUv + vec2(bStep.x, -bStep.y))).rgb;
    rgb = mix(rgb, (rgb + bTap) * 0.2, clamp(blurRad * 250.0, 0.0, 0.7));
  }

  // 1d. Detail Budget: Attenuate detail finer than effectiveLines
  if (u_effectiveLines > 100.0 && u_resolution.y > u_effectiveLines) {
    float lineStep = 1.0 / u_effectiveLines;
    vec3 lowPass = (
      texture(u_image, mapCropUv(distUv + vec2(0.0, lineStep))).rgb +
      texture(u_image, mapCropUv(distUv - vec2(0.0, lineStep))).rgb +
      texture(u_image, mapCropUv(distUv + vec2(lineStep, 0.0))).rgb +
      texture(u_image, mapCropUv(distUv - vec2(lineStep, 0.0))).rgb
    ) * 0.25;
    rgb = mix(rgb, lowPass, 0.18);
  }

  // 1e. Native Camera Adaptation: Soften aggressive phone HDR local contrast
  if (u_isNativeCamera) {
    vec2 wideStep = 6.0 / max(vec2(1.0), u_resolution);
    vec3 wideBlur = (
      texture(u_image, mapCropUv(distUv + wideStep)).rgb +
      texture(u_image, mapCropUv(distUv - wideStep)).rgb +
      texture(u_image, mapCropUv(distUv + vec2(wideStep.x, -wideStep.y))).rgb +
      texture(u_image, mapCropUv(distUv + vec2(-wideStep.x, wideStep.y))).rgb
    ) * 0.25;
    rgb = mix(rgb, wideBlur, 0.20);
  }

  if (u_debugStage == 1) {
    outColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    return;
  }

  // ==========================================
  // STAGE 2: CAPTURE / FILM RESPONSE
  // ==========================================
  vec3 linRgb = srgbToLinear(rgb);

  // 2a. Linear Exposure EV
  if (abs(u_exposureEV) > 0.001) {
    linRgb *= safePow(2.0, u_exposureEV);
  }

  // 2b. Flash Falloff & Godox Direct-Flash Strobe Pass (in linear space)
  if (u_flashUsed) {
    // Godox Direct-Flash Pass:
    // Radial inverse-square subject/background falloff centered slightly above lens axis (cx=0.50, cy=0.46)
    vec2 godoxCenter = vec2(0.50, 0.46);
    float rGodox = length(distUv - godoxCenter);
    // Subject zone r < 0.40 full brightness, outer background smoothly attenuates by ~32% with deeper shadow floor
    float godoxFalloff = 1.0 - 0.32 * smoothstep(0.40, 1.05, rGodox);
    linRgb *= godoxFalloff;

    // 5600K Xenon Daylight Balance: neutralize smartphone LED warm/green spike
    linRgb.r *= 1.02;
    linRgb.g *= 0.96;
    linRgb.b *= 1.04;
  } else if (u_flashFalloff.x > 0.0) {
    vec2 fCenter = u_flashFalloff.zw;
    vec2 fDiff = (distUv - fCenter);
    float fDist = length(fDiff);
    float fRad = max(0.1, u_flashFalloff.y);
    float normDist = clamp(fDist / fRad, 0.0, 1.0);
    // Smooth Hermite cubic falloff with C1 continuity at the boundary (no circular seam)
    float fAtt = 1.0 - normDist * normDist * (3.0 - 2.0 * normDist);
    float fMultiplier = max(0.2, 1.0 + u_flashFalloff.x * (fAtt * fAtt - 0.3));
    linRgb *= fMultiplier;
  }

  // 2c. 3x3 Dye Cross-Talk Matrix
  linRgb = u_dyeMatrix * linRgb;
  linRgb = max(vec3(0.0), linRgb);

  // Convert back to non-linear for tone curves
  rgb = linearToSrgb(linRgb);

  // 2d. Per-Channel Filmic Curves (curveR, curveG, curveB)
  rgb.r = evalChannelCurve(rgb.r, u_curveR, u_shoulderType);
  rgb.g = evalChannelCurve(rgb.g, u_curveG, u_shoulderType);
  rgb.b = evalChannelCurve(rgb.b, u_curveB, u_shoulderType);

  // Godox Xenon Strobe Highlight Roll-off & Micro-Contrast Punch
  if (u_flashUsed) {
    float flashLuma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    if (flashLuma > 0.78) {
      float over = (flashLuma - 0.78) / 0.22;
      // Soft-knee compressed shoulder roll-off curve
      float compressed = 0.78 + 0.22 * (over / (1.0 + 0.5 * over));
      rgb *= (compressed / max(1e-4, flashLuma));
      // Warm ivory specular tint (+3% R, +1.5% G, -2% B) for natural xenon arc discharge
      rgb.r = min(1.0, rgb.r * (1.0 + 0.03 * over));
      rgb.g = min(1.0, rgb.g * (1.0 + 0.015 * over));
      rgb.b = max(0.0, rgb.b * (1.0 - 0.02 * over));
    }
    // +10% midtone local punch for crisp direct flash editorial look
    rgb = clamp(rgb + (rgb - 0.5) * 0.10 * (1.0 - abs(rgb - 0.5) * 2.0), 0.0, 1.0);
  }

  // 2e. Local Contrast adjustment
  if (abs(u_localContrast) > 0.01) {
    vec2 lcStep = 4.0 / max(vec2(1.0), u_resolution);
    vec3 lcBlur = (
      texture(u_image, mapCropUv(distUv + lcStep)).rgb +
      texture(u_image, mapCropUv(distUv - lcStep)).rgb +
      texture(u_image, mapCropUv(distUv + vec2(lcStep.x, -lcStep.y))).rgb +
      texture(u_image, mapCropUv(distUv + vec2(-lcStep.x, lcStep.y))).rgb
    ) * 0.25;
    vec3 detail = origRgb - lcBlur;
    rgb = clamp(rgb + detail * u_localContrast, 0.0, 1.0);
  }

  if (u_debugStage == 2) {
    outColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    return;
  }

  // ==========================================
  // STAGE 3: OKLCH COLOR GRADING & GAMUT
  // ==========================================
  vec3 linForOklab = srgbToLinear(clamp(rgb, 0.0, 1.0));
  vec3 lab = linearSrgbToOklab(linForOklab);
  float L = lab.x;
  float C = length(lab.yz);
  float hRad = (C < 1e-5) ? 0.0 : atan(lab.z, lab.y);
  float hDeg = degrees(hRad);
  if (hDeg < 0.0) hDeg += 360.0;

  // 3a. 24-Node Hue Table Lookup & Interpolation
  float dH = 0.0;
  float dC = 1.0;
  float dL = 0.0;
  for (int i = 0; i < 24; i++) {
    int nextI = (i + 1) % 24;
    float h1 = u_hueNodes[i].x;
    float h2 = u_hueNodes[nextI].x;
    if (h2 <= h1) h2 += 360.0;
    float targetH = hDeg;
    if (targetH < h1) targetH += 360.0;

    if (targetH >= h1 && targetH <= h2) {
      float t = (targetH - h1) / max(1e-4, h2 - h1);
      float st = t * t * (3.0 - 2.0 * t);
      dH = mix(u_hueNodes[i].y, u_hueNodes[nextI].y, st);
      dC = mix(u_hueNodes[i].z, u_hueNodes[nextI].z, st);
      dL = mix(u_hueNodes[i].w, u_hueNodes[nextI].w, st);
      break;
    }
  }

  // 3b. Skin Protection (Dampen hue/chroma shifts in minHue..maxHue, typically 20-55 deg)
  if (u_skinProtect.x > 0.5 && hDeg >= u_skinProtect.y && hDeg <= u_skinProtect.z) {
    float skinMid = (u_skinProtect.y + u_skinProtect.z) * 0.5;
    float halfW = (u_skinProtect.z - u_skinProtect.y) * 0.5;
    float dist = abs(hDeg - skinMid) / max(1e-4, halfW);
    float damp = 1.0 - min(1.0, dist);
    dH *= (1.0 - damp * u_skinProtect.w);
    dC = mix(dC, 1.0, damp * u_skinProtect.w);
  }

  // Apply Hue Table grading
  float gradedHDeg = mod(hDeg + dH, 360.0);
  float gradedC = max(0.0, C * dC * max(0.0, u_saturation));
  float gradedL = clamp(L + dL, 0.0, 1.0);

  // 3c. Brightness-Dependent Saturation
  // Richer in lower midtones (0.2..0.5), desaturating in extreme highlights (>0.8)
  float midWeight = 4.0 * gradedL * (1.0 - gradedL);
  gradedC *= (1.0 + u_brightSat.x * midWeight);
  if (gradedL > 0.8) {
    float desatW = smoothstep(0.8, 1.0, gradedL) * u_brightSat.y;
    gradedC *= (1.0 - desatW);
  }

  // 3d. Highlight warmth drift near white
  if (u_highlightWarmth > 0.0 && gradedL > 0.85) {
    float warmW = smoothstep(0.85, 0.98, gradedL) * u_highlightWarmth;
    gradedHDeg = mix(gradedHDeg, 42.0, warmW * 0.5); // warm golden hue
  }

  // 3e. Convert back from OKLCH to OKLab
  float finalHRad = radians(gradedHDeg);
  vec3 gradedLab = vec3(gradedL, gradedC * cos(finalHRad), gradedC * sin(finalHRad));
  vec3 linOut = oklabToLinearSrgb(gradedLab);

  // 3f. Chroma-based Gamut Compression (avoids clipping & hue flips)
  float minCh = min(linOut.r, min(linOut.g, linOut.b));
  float maxCh = max(linOut.r, max(linOut.g, linOut.b));
  if (minCh < 0.0 || maxCh > 1.0) {
    // Compress chroma C until in gamut
    float scale = 1.0;
    if (minCh < 0.0) scale = min(scale, gradedL / max(1e-4, gradedL - minCh));
    if (maxCh > 1.0) scale = min(scale, (1.0 - gradedL) / max(1e-4, maxCh - gradedL));
    gradedC *= clamp(scale, 0.0, 1.0);
    gradedLab = vec3(gradedL, gradedC * cos(finalHRad), gradedC * sin(finalHRad));
    linOut = clamp(oklabToLinearSrgb(gradedLab), 0.0, 1.0);
  }

  rgb = linearToSrgb(linOut);

  // 3g. Shadow Tint (in deep blacks)
  if (gradedL < 0.25) {
    float stWeight = (1.0 - gradedL / 0.25) * 0.3;
    rgb = clamp(rgb + u_shadowTint * stWeight, 0.0, 1.0);
  }

  // 3g2. Optional 3D .cube LUT Stage (hardware trilinear TEXTURE_3D)
  if (u_hasLut && u_lutStrength > 0.001) {
    float lutScale = (u_lutSize - 1.0) / max(2.0, u_lutSize);
    float lutOffset = 0.5 / max(2.0, u_lutSize);
    vec3 lutCoord = clamp(rgb, 0.0, 1.0) * lutScale + lutOffset;
    vec3 lutRgb = texture(u_lut, lutCoord).rgb;
    rgb = mix(rgb, lutRgb, clamp(u_lutStrength, 0.0, 1.0));
  }

  // 3h. White Protect: smooth pull toward neutral luma for extreme highlights
  float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
  if (u_whiteProtect > 0.5 && luma > 0.85) {
    float wpWeight = smoothstep(0.85, 0.98, luma);
    rgb = mix(rgb, vec3(luma), wpWeight * 0.96);
  }

  if (u_debugStage == 3) {
    outColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    return;
  }

  // ==========================================
  // STAGE 4: EMULSION OPTICS & GRAIN
  // ==========================================
  // 4a. Bloom & Halation (Screen Blend: s + d - s*d)
  if (u_bloom.y > 0.0 && luma > u_bloom.x) {
    float bIntensity = smoothstep(u_bloom.x, 1.0, luma) * u_bloom.y;
    vec3 bloomColor = vec3(bIntensity);
    rgb = clamp(rgb + bloomColor - (rgb * bloomColor), 0.0, 1.0);
  }

  if (u_halation.y > 0.0 && luma > u_halation.x) {
    float hIntensity = smoothstep(u_halation.x, 1.0, luma) * u_halation.y;
    vec3 halColor = u_halationTint * hIntensity;
    rgb = clamp(rgb + halColor - (rgb * halColor), 0.0, 1.0);
  }

  // Specular micro-halation on bright direct-flash reflections (jewelry, gloss highlights)
  if (u_flashUsed && luma > 0.88) {
    float specIntensity = smoothstep(0.88, 1.0, luma) * 0.16;
    vec3 specBloom = vec3(1.0, 0.96, 0.90) * specIntensity;
    rgb = clamp(rgb + specBloom - (rgb * specBloom), 0.0, 1.0);
  }

  // 4b. Vignette (cos^4 falloff)
  if (u_vignette.x > 0.0) {
    float vDist = length(p * 2.0);
    float vAngle = min(1.57079, (vDist / max(1e-4, u_vignette.y)) * 0.78539);
    float cosVal = cos(vAngle);
    float vFactor = safePow(cosVal, max(1.0, u_vignette.w > 0.0 ? u_vignette.w : 4.0));
    rgb *= mix(1.0 - u_vignette.x, 1.0, clamp(vFactor, 0.0, 1.0));
  }

  if (u_debugStage == 4) {
    outColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    return;
  }

  // 4c. Exposure-Aware Physical Film Grain (Subtractive Optical Density Modulation)
  if (u_grain.x > 0.0) {
    // grain.y is normalized size (e.g. 0.0016), scale by resolution height
    float pixelGrainSize = max(1.0, u_grain.y * max(100.0, u_frameHeight) * 0.90);
    float seedOffset = u_isCapture ? u_seed : u_time * 12.0;

    // Asymmetric Kodak / Fujifilm RMS Granularity Response curve:
    // - Shadows (< 0.03): minimal grain (film base D-min, unexposed negative has no grain)
    // - Lower midtones (0.25 - 0.45): PEAK granularity where optical density contrast is highest
    // - Highlights (> 0.70): smooth roll-off as negative saturates
    // - Extreme highlights (> 0.90): near zero grain (specular highlights remain clean)
    float lDiff = (luma - 0.35) / 0.28;
    float hdWeight = smoothstep(0.02, 0.14, luma) * exp(-0.5 * lDiff * lDiff) * smoothstep(0.98, 0.70, luma);

    // Increase grain slightly in underexposed scenes up to cap
    float expFactor = clamp(1.0 + (0.5 - u_sceneExposure) * u_grainExposureSens, 0.7, 1.4);
    float grainStrength = u_grain.x * hdWeight * expFactor * 0.40;

    // Organic emulsion density variation (multi-scale with isotropic float PRNG)
    vec3 grainNoise = sampleEmulsionGrain(gl_FragCoord.xy, pixelGrainSize, u_grain.z, seedOffset);

    vec3 dDensity = vec3(0.0);
    if (u_grain.w > 0.0) {
      // Color film: C-41 chromogenic dye clouds (Yellow/B is coarsest, Magenta/G is sharpest)
      float chromaMix = clamp(u_grain.w, 0.0, 1.0);
      dDensity.r = mix(grainNoise.y, grainNoise.x * 0.95, chromaMix);
      dDensity.g = mix(grainNoise.y, grainNoise.y * 1.00, chromaMix);
      dDensity.b = mix(grainNoise.y, grainNoise.z * 1.15, chromaMix);
    } else {
      // Black & white: strictly monochromatic silver halide crystals
      dDensity = vec3(grainNoise.y);
    }

    // Subtractive Optical Density Modulation (Beer-Lambert Law):
    // Real film grain does not sit on top as additive digital dirt; it modulates light absorption.
    // Pure blacks remain deep & clean; midtones receive organic filmic texture; highlights roll off luminous.
    dDensity = clamp(dDensity, vec3(-2.0), vec3(2.0));
    vec3 expFactorClamped = clamp(dDensity * grainStrength, vec3(-1.0), vec3(1.0));
    rgb = clamp(rgb * exp2(expFactorClamped), 0.0, 1.0);
  }

  // ==========================================
  // STAGE 5: INTENSITY BLEND & DIAGNOSTICS
  // ==========================================
  float intensity = clamp(u_intensity, 0.0, 1.0);
  rgb = mix(origRgb, rgb, intensity);

  // NaN / Inf Guard
  if (isnan(rgb.r) || isnan(rgb.g) || isnan(rgb.b) ||
      isinf(rgb.r) || isinf(rgb.g) || isinf(rgb.b)) {
    hasNaN = true;
    rgb = origRgb;
  }

  if (rgb.r < 0.0 || rgb.r > 1.0 || rgb.g < 0.0 || rgb.g > 1.0 || rgb.b < 0.0 || rgb.b > 1.0) {
    isOutOfRange = true;
  }

  // Debug Overlay: Magenta for NaN/Inf, Cyan for out-of-range
  if (u_debugOverlay) {
    if (hasNaN) {
      outColor = vec4(1.0, 0.0, 1.0, 1.0);
      return;
    }
    if (isOutOfRange) {
      outColor = vec4(0.0, 1.0, 1.0, 1.0);
      return;
    }
  }

  outColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;

export interface LookEngineRenderOptions {
  width: number;
  height: number;
  isCapture?: boolean;
  seed?: number;
  time?: number;
  disableAnimatedGrain?: boolean;
  grainTickHz?: number; // 24 by default; 0 for static under low tier or prefers-reduced-motion
  intensity?: number;
  whiteProtect?: boolean;
  debugStage?: number; // 0 = all
  debugOverlay?: boolean;
  isNativeCamera?: boolean;
  sceneExposure?: number; // mean log-luminance (default 0.5)
  cropRect?: { x: number; y: number; width: number; height: number }; // normalized [0, 1] texture coordinates
  mirror?: boolean;
  exposureCompensation?: number; // User EV bias (-2.0 to +2.0)
  lut?: ParsedCubeLUT;
  lutStrength?: number;
  flashUsed?: boolean;
}

export class LookEnginePipeline {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private lutTexture: WebGLTexture | null = null;
  private uploadedLutKey: string | null = null;
  private uploadedLutSize: number = 0;

  // Cached uniform locations
  private uImageLoc: WebGLUniformLocation | null = null;
  private uLutLoc: WebGLUniformLocation | null = null;
  private uHasLutLoc: WebGLUniformLocation | null = null;
  private uLutSizeLoc: WebGLUniformLocation | null = null;
  private uLutStrengthLoc: WebGLUniformLocation | null = null;
  private uResLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uSeedLoc: WebGLUniformLocation | null = null;
  private uIsCaptureLoc: WebGLUniformLocation | null = null;
  private uFrameHeightLoc: WebGLUniformLocation | null = null;
  private uIsNativeCamLoc: WebGLUniformLocation | null = null;
  private uCropRectLoc: WebGLUniformLocation | null = null;
  private uMirrorLoc: WebGLUniformLocation | null = null;

  // Lens
  private uRadialBlurLoc: WebGLUniformLocation | null = null;
  private uCaLoc: WebGLUniformLocation | null = null;
  private uDistortionLoc: WebGLUniformLocation | null = null;
  private uVigLoc: WebGLUniformLocation | null = null;
  private uBloomLoc: WebGLUniformLocation | null = null;
  private uHalationLoc: WebGLUniformLocation | null = null;
  private uHalationTintLoc: WebGLUniformLocation | null = null;

  // Response
  private uExpLoc: WebGLUniformLocation | null = null;
  private uDyeMatrixLoc: WebGLUniformLocation | null = null;
  private uCurveRLoc: WebGLUniformLocation | null = null;
  private uCurveGLoc: WebGLUniformLocation | null = null;
  private uCurveBLoc: WebGLUniformLocation | null = null;
  private uShoulderTypeLoc: WebGLUniformLocation | null = null;
  private uLocalContrastLoc: WebGLUniformLocation | null = null;
  private uEffectiveLinesLoc: WebGLUniformLocation | null = null;
  private uFlashLoc: WebGLUniformLocation | null = null;
  private uFlashUsedLoc: WebGLUniformLocation | null = null;

  // OKLCH
  private uHueNodesLoc: WebGLUniformLocation | null = null;
  private uSkinProtectLoc: WebGLUniformLocation | null = null;
  private uSatLoc: WebGLUniformLocation | null = null;
  private uBrightSatLoc: WebGLUniformLocation | null = null;
  private uHighlightWarmthLoc: WebGLUniformLocation | null = null;
  private uShadowTintLoc: WebGLUniformLocation | null = null;
  private uWhiteProtectLoc: WebGLUniformLocation | null = null;

  // Emulsion
  private uGrainLoc: WebGLUniformLocation | null = null;
  private uGrainExpSensLoc: WebGLUniformLocation | null = null;
  private uSceneExpLoc: WebGLUniformLocation | null = null;

  // Diagnostics
  private uIntensityLoc: WebGLUniformLocation | null = null;
  private uDebugStageLoc: WebGLUniformLocation | null = null;
  private uDebugOverlayLoc: WebGLUniformLocation | null = null;

  // Cached buffers & dirty checking state to prevent per-frame allocations and uniform churn
  private cachedDyeMatrix = new Float32Array(9);
  private cachedHueNodes = new Float32Array(24 * 4);
  private lastUploadedLookId: string | null = null;

  constructor(
    private canvas: HTMLCanvasElement | OffscreenCanvas,
    private options?: { preserveDrawingBuffer?: boolean }
  ) {
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost as EventListener, false);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored as EventListener, false);
    this.initWebGL();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    console.warn("Look Engine WebGL2 context lost");
    this.gl = null;
    this.lastUploadedLookId = null;
    this.uploadedLutKey = null;
  };

  private handleContextRestored = () => {
    console.info("Look Engine WebGL2 context restored. Rebuilding shaders.");
    this.lastUploadedLookId = null;
    this.uploadedLutKey = null;
    this.initWebGL();
  };

  private initWebGL() {
    const shouldPreserve = this.options?.preserveDrawingBuffer ?? false;
    const attribs: WebGLContextAttributes = {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: shouldPreserve,
      powerPreference: "high-performance",
      desynchronized: false,
    };
    let gl = this.canvas.getContext("webgl2", attribs) as WebGL2RenderingContext | null;
    if (!gl) {
      gl = this.canvas.getContext("webgl2", {
        alpha: false,
        premultipliedAlpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: shouldPreserve,
        powerPreference: "high-performance",
      }) as WebGL2RenderingContext | null;
    }
    if (!gl) return;
    this.gl = gl;

    const vert = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vert || !frag) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Look Engine GLSL link error:", gl.getProgramInfoLog(prog));
      return;
    }
    this.program = prog;

    // Buffers
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(prog, "a_position");
    const texLoc = gl.getAttribLocation(prog, "a_texCoord");
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // 2D Frame Texture (TEXTURE0)
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 3D LUT Texture (TEXTURE1)
    this.lutTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Cache Uniform Locations
    this.uImageLoc = gl.getUniformLocation(prog, "u_image");
    this.uLutLoc = gl.getUniformLocation(prog, "u_lut");
    this.uHasLutLoc = gl.getUniformLocation(prog, "u_hasLut");
    this.uLutSizeLoc = gl.getUniformLocation(prog, "u_lutSize");
    this.uLutStrengthLoc = gl.getUniformLocation(prog, "u_lutStrength");
    this.uResLoc = gl.getUniformLocation(prog, "u_resolution");
    this.uTimeLoc = gl.getUniformLocation(prog, "u_time");
    this.uSeedLoc = gl.getUniformLocation(prog, "u_seed");
    this.uIsCaptureLoc = gl.getUniformLocation(prog, "u_isCapture");
    this.uFrameHeightLoc = gl.getUniformLocation(prog, "u_frameHeight");
    this.uIsNativeCamLoc = gl.getUniformLocation(prog, "u_isNativeCamera");
    this.uCropRectLoc = gl.getUniformLocation(prog, "u_cropRect");
    this.uMirrorLoc = gl.getUniformLocation(prog, "u_mirror");

    this.uRadialBlurLoc = gl.getUniformLocation(prog, "u_radialBlur");
    this.uCaLoc = gl.getUniformLocation(prog, "u_chromaticAberration");
    this.uDistortionLoc = gl.getUniformLocation(prog, "u_distortion");
    this.uVigLoc = gl.getUniformLocation(prog, "u_vignette");
    this.uBloomLoc = gl.getUniformLocation(prog, "u_bloom");
    this.uHalationLoc = gl.getUniformLocation(prog, "u_halation");
    this.uHalationTintLoc = gl.getUniformLocation(prog, "u_halationTint");

    this.uExpLoc = gl.getUniformLocation(prog, "u_exposureEV");
    this.uDyeMatrixLoc = gl.getUniformLocation(prog, "u_dyeMatrix");
    this.uCurveRLoc = gl.getUniformLocation(prog, "u_curveR");
    this.uCurveGLoc = gl.getUniformLocation(prog, "u_curveG");
    this.uCurveBLoc = gl.getUniformLocation(prog, "u_curveB");
    this.uShoulderTypeLoc = gl.getUniformLocation(prog, "u_shoulderType");
    this.uLocalContrastLoc = gl.getUniformLocation(prog, "u_localContrast");
    this.uEffectiveLinesLoc = gl.getUniformLocation(prog, "u_effectiveLines");
    this.uFlashLoc = gl.getUniformLocation(prog, "u_flashFalloff");
    this.uFlashUsedLoc = gl.getUniformLocation(prog, "u_flashUsed");

    this.uHueNodesLoc = gl.getUniformLocation(prog, "u_hueNodes");
    this.uSkinProtectLoc = gl.getUniformLocation(prog, "u_skinProtect");
    this.uSatLoc = gl.getUniformLocation(prog, "u_saturation");
    this.uBrightSatLoc = gl.getUniformLocation(prog, "u_brightSat");
    this.uHighlightWarmthLoc = gl.getUniformLocation(prog, "u_highlightWarmth");
    this.uShadowTintLoc = gl.getUniformLocation(prog, "u_shadowTint");
    this.uWhiteProtectLoc = gl.getUniformLocation(prog, "u_whiteProtect");

    this.uGrainLoc = gl.getUniformLocation(prog, "u_grain");
    this.uGrainExpSensLoc = gl.getUniformLocation(prog, "u_grainExposureSens");
    this.uSceneExpLoc = gl.getUniformLocation(prog, "u_sceneExposure");

    this.uIntensityLoc = gl.getUniformLocation(prog, "u_intensity");
    this.uDebugStageLoc = gl.getUniformLocation(prog, "u_debugStage");
    this.uDebugOverlayLoc = gl.getUniformLocation(prog, "u_debugOverlay");

    gl.useProgram(prog);
    gl.uniform1i(this.uImageLoc, 0);
    gl.uniform1i(this.uLutLoc, 1);
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("Look Engine Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public render(
    source: TexImageSource,
    look: LookRecipe,
    options: LookEngineRenderOptions
  ): boolean {
    const gl = this.gl;
    if (!gl || !this.program || !this.texture) return false;

    gl.viewport(0, 0, options.width, options.height);
    gl.useProgram(this.program);

    // Upload main frame texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    // Optional 3D LUT texture binding & upload
    const lutData: ParsedCubeLUT | undefined =
      options.lut ?? (look.lutUrl ? getCachedCubeLUT(look.lutUrl) : undefined);

    if (look.lutUrl && !lutData && typeof window !== "undefined") {
      void preloadCubeLUT(look.lutUrl);
    }

    if (lutData && this.lutTexture) {
      const lutKey = look.lutUrl ? resolveLutUrl(look.lutUrl) : `inline-${lutData.title ?? ""}-${lutData.size}`;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
      if (this.uploadedLutKey !== lutKey || this.uploadedLutSize !== lutData.size) {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage3D(
          gl.TEXTURE_3D,
          0,
          gl.RGB8,
          lutData.size,
          lutData.size,
          lutData.size,
          0,
          gl.RGB,
          gl.UNSIGNED_BYTE,
          lutData.byteData
        );
        this.uploadedLutKey = lutKey;
        this.uploadedLutSize = lutData.size;
      }
      const defaultLutStrength = look.id.endsWith(".cube") ? 1.0 : 0.25;
      const lutStrength = options.lutStrength ?? look.lutStrength ?? defaultLutStrength;
      gl.uniform1i(this.uHasLutLoc, 1);
      gl.uniform1f(this.uLutSizeLoc, lutData.size);
      gl.uniform1f(this.uLutStrengthLoc, lutStrength);
      gl.activeTexture(gl.TEXTURE0);
    } else {
      gl.uniform1i(this.uHasLutLoc, 0);
      gl.uniform1f(this.uLutSizeLoc, 17);
      gl.uniform1f(this.uLutStrengthLoc, 0.0);
    }

    // Uniform values
    gl.uniform2f(this.uResLoc, options.width, options.height);

    // Discrete grain tick (default 24 Hz; 0 for static under low tier or reduced motion)
    const timeMs = options.time ?? performance.now();
    const grainTickHz = options.grainTickHz !== undefined
      ? options.grainTickHz
      : (options.disableAnimatedGrain ? 0 : 24);
    const tick = grainTickHz > 0 ? Math.floor((timeMs / 1000) * grainTickHz) : 0;
    gl.uniform1f(this.uTimeLoc, (tick % 100000) / 12.0);

    gl.uniform1f(this.uSeedLoc, (options.seed ?? 42) % 100000);
    gl.uniform1i(this.uIsCaptureLoc, options.isCapture ? 1 : 0);
    gl.uniform1f(this.uFrameHeightLoc, options.height);
    gl.uniform1i(this.uIsNativeCamLoc, options.isNativeCamera ? 1 : 0);

    const cr = options.cropRect ?? { x: 0, y: 0, width: 1, height: 1 };
    gl.uniform4f(this.uCropRectLoc, cr.x, cr.y, cr.width, cr.height);
    gl.uniform1i(this.uMirrorLoc, options.mirror ? 1 : 0);

    // Runtime intensity & flags
    const intensityVal = options.intensity ?? look.intensity ?? (options.isNativeCamera ? 0.7 : 1.0);
    const whiteProtectVal = (options.whiteProtect ?? look.whiteProtect ?? true) ? 1.0 : 0.0;

    // Always upload uniform parameters on every frame to guarantee 100% instant reactivity
    // when any slider (exposure, curves, grain, bloom, halation, distortion) is modified.
    // 1. Lens Model
    const lens = look.lens;
    gl.uniform2f(this.uRadialBlurLoc, lens?.radialBlur?.r0 ?? 0, lens?.radialBlur?.r1 ?? 0);
    gl.uniform1f(this.uCaLoc, lens?.chromaticAberration ?? 0);
    gl.uniform1f(this.uDistortionLoc, lens?.distortion ?? 0);
    const vig = lens?.vignette ?? look.vignette;
    gl.uniform4f(this.uVigLoc, vig.strength, vig.radius, vig.softness, vig.curvature ?? 4.0);
    const bloom = lens?.bloom ?? look.bloom;
    gl.uniform4f(this.uBloomLoc, bloom.threshold, bloom.strength, bloom.radius, 0.0);
    const halation = lens?.halation ?? look.halation;
    gl.uniform4f(this.uHalationLoc, halation.threshold, halation.strength, halation.radius, halation.tint ? 1.0 : 0.0);
    const hTint = halation.tint ?? [1.0, 0.4, 0.15];
    gl.uniform3f(this.uHalationTintLoc, hTint[0], hTint[1], hTint[2]);

    // 2. Film Response
    const resp = look.response;
    const userEV = options.exposureCompensation ?? 0;
    gl.uniform1f(this.uExpLoc, (resp?.exposureEV ?? look.exposureEV) + userEV);
    const matrix: Matrix3x3 = resp?.dyeMatrix ?? look.matrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.cachedDyeMatrix.set(matrix);
    gl.uniformMatrix3fv(this.uDyeMatrixLoc, false, this.cachedDyeMatrix);

    const curveR = resp?.curveR ?? look.curve;
    const curveG = resp?.curveG ?? look.curve;
    const curveB = resp?.curveB ?? look.curve;
    gl.uniform4f(this.uCurveRLoc, curveR.contrast, curveR.pivot, curveR.toe, curveR.shoulder);
    gl.uniform4f(this.uCurveGLoc, curveG.contrast, curveG.pivot, curveG.toe, curveG.shoulder);
    gl.uniform4f(this.uCurveBLoc, curveB.contrast, curveB.pivot, curveB.toe, curveB.shoulder);
    gl.uniform1i(this.uShoulderTypeLoc, (curveR.type ?? look.curve?.type) === "hard" ? 1 : 0);
    gl.uniform1f(this.uLocalContrastLoc, resp?.localContrast ?? 0.0);
    gl.uniform1f(this.uEffectiveLinesLoc, resp?.effectiveLines ?? 2000.0);

    const flash = resp?.flashFalloff ?? look.flashFalloff;
    gl.uniform4f(this.uFlashLoc, flash.strength, flash.radius, flash.centerX ?? 0.5, flash.centerY ?? 0.5);
    gl.uniform1i(this.uFlashUsedLoc, options.flashUsed ? 1 : 0);

    // 3. OKLCH Color Grading
    const col = look.color;
    const hueTable = col?.hueTable ?? [];
    for (let i = 0; i < 24; i++) {
      const node = hueTable[i];
      this.cachedHueNodes[i * 4 + 0] = node ? node.hue : (i * 360) / 24;
      this.cachedHueNodes[i * 4 + 1] = node ? node.dHue : 0.0;
      this.cachedHueNodes[i * 4 + 2] = node ? node.dChroma : 1.0;
      this.cachedHueNodes[i * 4 + 3] = node ? node.dLightness : 0.0;
    }
    gl.uniform4fv(this.uHueNodesLoc, this.cachedHueNodes);

    const skin = col?.skinProtection;
    gl.uniform4f(
      this.uSkinProtectLoc,
      skin?.enabled ? 1.0 : 0.0,
      skin?.minHue ?? 20.0,
      skin?.maxHue ?? 55.0,
      skin?.strength ?? 0.75
    );
    gl.uniform1f(this.uSatLoc, col?.saturation ?? look.saturation);
    gl.uniform2f(
      this.uBrightSatLoc,
      col?.brightSatCurve?.shadowBoost ?? 0.1,
      col?.brightSatCurve?.highlightDesat ?? 0.3
    );
    gl.uniform1f(this.uHighlightWarmthLoc, col?.highlightWarmth ?? 0.15);
    const sTint = col?.shadowTint ?? [0.0, 0.0, 0.0];
    gl.uniform3f(this.uShadowTintLoc, sTint[0], sTint[1], sTint[2]);
    gl.uniform1f(this.uWhiteProtectLoc, whiteProtectVal);

    // 4. Emulsion Artifacts
    const grain = look.emulsion?.grain ?? look.grain;
    const grainAmt = options.disableAnimatedGrain && !options.isCapture ? grain.amount * 0.7 : grain.amount;
    gl.uniform4f(this.uGrainLoc, grainAmt, grain.size, grain.roughness, grain.chroma);
    gl.uniform1f(this.uGrainExpSensLoc, grain.exposureSensitivity ?? 0.5);
    gl.uniform1f(this.uSceneExpLoc, options.sceneExposure ?? 0.5);

    gl.uniform1f(this.uIntensityLoc, intensityVal);

    // Dynamic Debug Controls
    gl.uniform1i(this.uDebugStageLoc, options.debugStage ?? 0);
    gl.uniform1i(this.uDebugOverlayLoc, options.debugOverlay ? 1 : 0);

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Only synchronize during capture if readback is imminent, never during live preview loop
    if (options.isCapture) {
      gl.finish();
    }
    return true;
  }

  public destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    try {
      if (this.texture) {
        gl.deleteTexture(this.texture);
        this.texture = null;
      }
      if (this.lutTexture) {
        gl.deleteTexture(this.lutTexture);
        this.lutTexture = null;
      }
      if (this.positionBuffer) {
        gl.deleteBuffer(this.positionBuffer);
        this.positionBuffer = null;
      }
      if (this.texCoordBuffer) {
        gl.deleteBuffer(this.texCoordBuffer);
        this.texCoordBuffer = null;
      }
      if (this.program) {
        gl.deleteProgram(this.program);
        this.program = null;
      }
    } catch (e) {
      console.warn("LookEnginePipeline destroy error:", e);
    }
    this.gl = null;
  }
}
