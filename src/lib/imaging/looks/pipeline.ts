import type { LookRecipe } from "./types";

/**
 * GLSL 3.00 ES Vertex Shader
 */
const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * GLSL 3.00 ES Main Fragment Shader
 * Full procedural film simulation with strict numeric safety:
 * - Linear light processing for exposure & flash falloff
 * - safePow & safeDenom guards preventing negative / zero bases
 * - Monotonic filmic tone curve with smooth highlight rolloff
 * - Lift / Gamma / Gain & neutral-axis split toning
 * - White Protect: smooth desaturation of extreme highlights (luma > 0.9) to pure neutral
 * - Intensity blend slider
 * - NaN / Inf hardware fallback guard
 * - Stage bisection (0: all, 1: sharpen, 2: exposure/flash, 3: curve, 4: lift/gamma/gain, 5: split-tone, 6: grain, 7: vignette)
 * - Debug overlay: Magenta for NaN/Inf, Cyan for out-of-range before clamp
 */
const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
uniform bool u_isCapture;
uniform float u_frameHeight;

// Look Recipe Uniforms
uniform float u_exposureEV;
uniform vec4 u_curve; // x: contrast, y: pivot, z: toe, w: shoulder
uniform vec3 u_lift;
uniform vec3 u_gamma;
uniform vec3 u_gain;
uniform float u_saturation;
uniform vec4 u_splitTone; // x: shadowHueRad, y: shadowSat, z: highlightHueRad, w: highlightSat
uniform float u_splitBalance;
uniform vec4 u_grain; // x: amount, y: size, z: roughness, w: chroma
uniform vec3 u_vignette; // x: strength, y: radius, z: softness
uniform vec4 u_flashFalloff; // x: strength, y: radius, z: cx, w: cy
uniform float u_sharpen;
uniform float u_softFocusAmount;

// Recalibration & Control Uniforms
uniform float u_intensity; // 0.0 to 1.0 blend with original
uniform float u_whiteProtect; // 1.0 = enabled, 0.0 = disabled
uniform int u_debugStage; // 0: all, 1: sharpen, 2: exp/flash, 3: curve, 4: l/g/g, 5: split, 6: grain, 7: vig
uniform bool u_debugOverlay; // true = highlight NaN (Magenta) & out-of-range (Cyan)

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

// Strictly guarded pow: base never <= 0.0
float safePow(float base, float expVal) {
  return pow(max(base, 1e-4), expVal);
}

vec3 safePowVec(vec3 base, vec3 expVal) {
  return pow(max(base, vec3(1e-4)), expVal);
}

// Pseudo-random 2D hash
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 2 Octaves Value Noise for grain roughness
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbmGrain(vec2 uv, float roughness) {
  float n1 = noise(uv);
  float n2 = noise(uv * 2.02);
  return mix(n1, n2, roughness);
}

// Filmic Tone Curve evaluation with monotonic shoulder and 1e-4 base clamp
float evalCurve(float x, vec4 curve) {
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
    val = shoulder + (1.0 - shoulder) * (1.0 - exp(-over * 1.5));
  }
  return clamp(val, 0.0, 1.0);
}

void main() {
  vec2 uv = v_texCoord;
  vec4 baseColor = texture(u_image, uv);
  vec3 origRgb = clamp(baseColor.rgb, 0.0, 1.0);
  vec3 rgb = origRgb;

  bool hasNaN = false;
  bool isOutOfRange = false;

  // 1. Mild Sharpening (if enabled)
  if (u_sharpen > 0.0) {
    vec2 step = 1.0 / max(vec2(1.0), u_resolution);
    vec3 cN = texture(u_image, uv + vec2(0.0, step.y)).rgb;
    vec3 cS = texture(u_image, uv - vec2(0.0, step.y)).rgb;
    vec3 cE = texture(u_image, uv + vec2(step.x, 0.0)).rgb;
    vec3 cW = texture(u_image, uv - vec2(step.x, 0.0)).rgb;
    vec3 edge = 4.0 * rgb - (cN + cS + cE + cW);
    rgb = clamp(rgb + edge * (u_sharpen * 0.35), 0.0, 1.0);
  }

  if (u_debugStage == 1) {
    outColor = vec4(rgb, 1.0);
    return;
  }

  // 2. Linear Light Processing: Exposure EV & Flash Falloff
  vec3 linRgb = srgbToLinear(rgb);

  if (u_exposureEV != 0.0) {
    linRgb *= pow(2.0, u_exposureEV);
  }

  if (u_flashFalloff.x > 0.0) {
    float aspect = u_resolution.x / max(1.0, u_resolution.y);
    vec2 d = vec2((uv.x - u_flashFalloff.z) * aspect, uv.y - u_flashFalloff.w);
    float dist = length(d);
    float rad = max(0.1, u_flashFalloff.y);
    float att = max(0.0, 1.0 - dist / rad);
    float flashBoost = 1.0 + u_flashFalloff.x * (att * att - 0.3);
    linRgb *= max(0.2, flashBoost);
  }

  // Convert back to sRGB for filmic curve and grading
  rgb = clamp(linearToSrgb(linRgb), 0.0, 1.0);

  if (u_debugStage == 2) {
    outColor = vec4(rgb, 1.0);
    return;
  }

  // 3. Filmic Tone Curve (Monotonic, safe shoulder)
  rgb.r = evalCurve(rgb.r, u_curve);
  rgb.g = evalCurve(rgb.g, u_curve);
  rgb.b = evalCurve(rgb.b, u_curve);

  if (u_debugStage == 3) {
    outColor = vec4(rgb, 1.0);
    return;
  }

  // 4. Lift / Gamma / Gain
  // Lift (shadows)
  rgb = clamp(rgb + u_lift, 0.0, 1.0);
  // Gamma (midtones)
  rgb = safePowVec(rgb, 1.0 / max(vec3(0.1), u_gamma));
  // Gain (highlights)
  rgb = clamp(rgb * u_gain, 0.0, 1.0);

  if (u_debugStage == 4) {
    outColor = vec4(rgb, 1.0);
    return;
  }

  // 5. Split-Toning with neutral-axis fadeout
  float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
  float maxC = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));
  float satWeight = clamp(maxC * 3.0, 0.0, 1.0);
  float splitMid = clamp(0.5 + u_splitBalance * 0.25, 0.1, 0.9);

  if (luma < splitMid && u_splitTone.y > 0.0) {
    float t = clamp((1.0 - luma / splitMid) * u_splitTone.y * satWeight, 0.0, 1.0);
    vec3 shadowTint = vec3(
      0.5 + 0.5 * cos(u_splitTone.x),
      0.5 + 0.5 * cos(u_splitTone.x - 2.094),
      0.5 + 0.5 * cos(u_splitTone.x + 2.094)
    );
    rgb = clamp(mix(rgb, rgb * shadowTint * 2.0, t), 0.0, 1.0);
  } else if (luma >= splitMid && u_splitTone.w > 0.0) {
    float t = clamp(((luma - splitMid) / max(1e-4, 1.0 - splitMid)) * u_splitTone.w * satWeight, 0.0, 1.0);
    vec3 highlightTint = vec3(
      0.5 + 0.5 * cos(u_splitTone.z),
      0.5 + 0.5 * cos(u_splitTone.z - 2.094),
      0.5 + 0.5 * cos(u_splitTone.z + 2.094)
    );
    rgb = clamp(mix(rgb, rgb * highlightTint * 2.0, t), 0.0, 1.0);
  }

  // Saturation adjustment
  luma = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = clamp(mix(vec3(luma), rgb, max(0.0, u_saturation)), 0.0, 1.0);

  // White Protect: For highlights (luma > 0.85), pull tint smoothly back toward neutral white
  if (u_whiteProtect > 0.5 && luma > 0.85) {
    float wpWeight = smoothstep(0.85, 0.98, luma);
    rgb = mix(rgb, vec3(luma), wpWeight * 0.96);
  }

  if (u_debugStage == 5) {
    outColor = vec4(rgb, 1.0);
    return;
  }

  // 6. Film Grain (Normalized to frame height)
  if (u_grain.x > 0.0) {
    float grainScale = max(0.0008, u_grain.y) * max(100.0, u_frameHeight);
    vec2 grainUv = (gl_FragCoord.xy) / grainScale;
    float seedOffset = u_isCapture ? u_seed : u_time * 12.0;
    
    float gMono = (fbmGrain(grainUv + seedOffset, u_grain.z) - 0.5);
    float midtoneWeight = 4.0 * luma * (1.0 - luma);
    float grainVal = gMono * u_grain.x * midtoneWeight;

    if (u_grain.w > 0.0) {
      vec3 gChroma = vec3(
        fbmGrain(grainUv + seedOffset + 1.3, u_grain.z) - 0.5,
        fbmGrain(grainUv + seedOffset + 2.7, u_grain.z) - 0.5,
        fbmGrain(grainUv + seedOffset + 4.1, u_grain.z) - 0.5
      ) * u_grain.w;
      rgb += (vec3(grainVal) + gChroma * (u_grain.x * midtoneWeight));
    } else {
      rgb += grainVal;
    }
  }

  if (u_debugStage == 6) {
    outColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    return;
  }

  // 7. Vignette (Elliptical to aspect ratio)
  if (u_vignette.x > 0.0) {
    float aspect = u_resolution.x / max(1.0, u_resolution.y);
    vec2 vUv = (uv - 0.5) * vec2(aspect, 1.0);
    float dist = length(vUv);
    float vig = smoothstep(u_vignette.y, u_vignette.y - u_vignette.z, dist);
    rgb *= mix(1.0 - u_vignette.x, 1.0, vig);
  }

  // Check out-of-range before final clamp (for debug overlay)
  if (rgb.r < 0.0 || rgb.r > 1.0 || rgb.g < 0.0 || rgb.g > 1.0 || rgb.b < 0.0 || rgb.b > 1.0) {
    isOutOfRange = true;
  }

  // Intensity blend with original
  rgb = mix(origRgb, rgb, clamp(u_intensity, 0.0, 1.0));

  // Check for NaN or Inf
  if (isnan(rgb.r) || isnan(rgb.g) || isnan(rgb.b) || isinf(rgb.r) || isinf(rgb.g) || isinf(rgb.b)) {
    hasNaN = true;
    rgb = origRgb; // Fallback to pre-effect color
  }

  // Debug Overlay: Magenta for NaN/Inf, Cyan for out-of-range
  if (u_debugOverlay) {
    if (hasNaN) {
      outColor = vec4(1.0, 0.0, 1.0, 1.0); // Magenta
      return;
    }
    if (isOutOfRange) {
      outColor = vec4(0.0, 1.0, 1.0, 1.0); // Cyan
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
  intensity?: number;
  whiteProtect?: boolean;
  debugStage?: number; // 0 = all
  debugOverlay?: boolean;
}

export class LookEnginePipeline {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;

  // Cached uniform locations
  private uResLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uSeedLoc: WebGLUniformLocation | null = null;
  private uIsCaptureLoc: WebGLUniformLocation | null = null;
  private uFrameHeightLoc: WebGLUniformLocation | null = null;
  private uExpLoc: WebGLUniformLocation | null = null;
  private uCurveLoc: WebGLUniformLocation | null = null;
  private uLiftLoc: WebGLUniformLocation | null = null;
  private uGammaLoc: WebGLUniformLocation | null = null;
  private uGainLoc: WebGLUniformLocation | null = null;
  private uSatLoc: WebGLUniformLocation | null = null;
  private uSplitLoc: WebGLUniformLocation | null = null;
  private uSplitBalLoc: WebGLUniformLocation | null = null;
  private uGrainLoc: WebGLUniformLocation | null = null;
  private uVigLoc: WebGLUniformLocation | null = null;
  private uFlashLoc: WebGLUniformLocation | null = null;
  private uSharpLoc: WebGLUniformLocation | null = null;
  private uSoftLoc: WebGLUniformLocation | null = null;
  private uIntensityLoc: WebGLUniformLocation | null = null;
  private uWhiteProtectLoc: WebGLUniformLocation | null = null;
  private uDebugStageLoc: WebGLUniformLocation | null = null;
  private uDebugOverlayLoc: WebGLUniformLocation | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.initWebGL();
  }

  private initWebGL() {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
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

    // Texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Uniforms
    this.uResLoc = gl.getUniformLocation(prog, "u_resolution");
    this.uTimeLoc = gl.getUniformLocation(prog, "u_time");
    this.uSeedLoc = gl.getUniformLocation(prog, "u_seed");
    this.uIsCaptureLoc = gl.getUniformLocation(prog, "u_isCapture");
    this.uFrameHeightLoc = gl.getUniformLocation(prog, "u_frameHeight");
    this.uExpLoc = gl.getUniformLocation(prog, "u_exposureEV");
    this.uCurveLoc = gl.getUniformLocation(prog, "u_curve");
    this.uLiftLoc = gl.getUniformLocation(prog, "u_lift");
    this.uGammaLoc = gl.getUniformLocation(prog, "u_gamma");
    this.uGainLoc = gl.getUniformLocation(prog, "u_gain");
    this.uSatLoc = gl.getUniformLocation(prog, "u_saturation");
    this.uSplitLoc = gl.getUniformLocation(prog, "u_splitTone");
    this.uSplitBalLoc = gl.getUniformLocation(prog, "u_splitBalance");
    this.uGrainLoc = gl.getUniformLocation(prog, "u_grain");
    this.uVigLoc = gl.getUniformLocation(prog, "u_vignette");
    this.uFlashLoc = gl.getUniformLocation(prog, "u_flashFalloff");
    this.uSharpLoc = gl.getUniformLocation(prog, "u_sharpen");
    this.uSoftLoc = gl.getUniformLocation(prog, "u_softFocusAmount");
    this.uIntensityLoc = gl.getUniformLocation(prog, "u_intensity");
    this.uWhiteProtectLoc = gl.getUniformLocation(prog, "u_whiteProtect");
    this.uDebugStageLoc = gl.getUniformLocation(prog, "u_debugStage");
    this.uDebugOverlayLoc = gl.getUniformLocation(prog, "u_debugOverlay");
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("Shader compile error:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  public render(
    source: TexImageSource,
    look: LookRecipe,
    options: LookEngineRenderOptions
  ): boolean {
    if (!this.gl || !this.program) return false;
    const gl = this.gl;

    if (this.canvas.width !== options.width || this.canvas.height !== options.height) {
      this.canvas.width = options.width;
      this.canvas.height = options.height;
    }

    gl.viewport(0, 0, options.width, options.height);
    gl.useProgram(this.program);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.uniform2f(this.uResLoc, options.width, options.height);
    gl.uniform1f(
      this.uTimeLoc,
      options.disableAnimatedGrain ? 0.0 : (options.time ?? performance.now() * 0.001)
    );
    gl.uniform1f(this.uSeedLoc, options.seed ?? 42.0);
    gl.uniform1i(this.uIsCaptureLoc, options.isCapture ? 1 : 0);
    gl.uniform1f(this.uFrameHeightLoc, options.height);

    // Look uniforms
    gl.uniform1f(this.uExpLoc, look.exposureEV);
    gl.uniform4f(
      this.uCurveLoc,
      look.curve.contrast,
      look.curve.pivot,
      look.curve.toe,
      look.curve.shoulder
    );
    gl.uniform3f(this.uLiftLoc, look.lift[0], look.lift[1], look.lift[2]);
    gl.uniform3f(this.uGammaLoc, look.gamma[0], look.gamma[1], look.gamma[2]);
    gl.uniform3f(this.uGainLoc, look.gain[0], look.gain[1], look.gain[2]);
    gl.uniform1f(this.uSatLoc, look.saturation);

    const shRad = (look.splitTone.shadowHue * Math.PI) / 180;
    const hlRad = (look.splitTone.highlightHue * Math.PI) / 180;
    gl.uniform4f(this.uSplitLoc, shRad, look.splitTone.shadowSat, hlRad, look.splitTone.highlightSat);
    gl.uniform1f(this.uSplitBalLoc, look.splitTone.balance);

    gl.uniform4f(
      this.uGrainLoc,
      look.grain.amount,
      look.grain.size,
      look.grain.roughness,
      look.grain.chroma
    );
    gl.uniform3f(
      this.uVigLoc,
      look.vignette.strength,
      look.vignette.radius,
      look.vignette.softness
    );
    gl.uniform4f(
      this.uFlashLoc,
      look.flashFalloff.strength,
      look.flashFalloff.radius,
      look.flashFalloff.centerX ?? 0.5,
      look.flashFalloff.centerY ?? 0.5
    );
    gl.uniform1f(this.uSharpLoc, look.sharpen);
    gl.uniform1f(this.uSoftLoc, look.softFocus.amount);

    // Blend, White Protect & Debug Uniforms
    const intensity = options.intensity ?? look.intensity ?? 1.0;
    gl.uniform1f(this.uIntensityLoc, intensity);

    const whiteProtect = (options.whiteProtect ?? look.whiteProtect ?? true) ? 1.0 : 0.0;
    gl.uniform1f(this.uWhiteProtectLoc, whiteProtect);

    gl.uniform1i(this.uDebugStageLoc, options.debugStage ?? 0);
    gl.uniform1i(this.uDebugOverlayLoc, options.debugOverlay ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }

  public destroy() {
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
      if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
    }
  }
}
