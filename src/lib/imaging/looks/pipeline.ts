import type { LookRecipe } from "./types";
import { drawEmulsionExtras, drawDateStamp, drawInstantFrame } from "./stamp-and-frame";

/**
 * GLSL 3.00 ES Vertex Shader
 */
const VERTEX_SHADER_SOURCE = `#version 300 es
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
 * Full procedural film simulation:
 * - Exposure EV
 * - Flash Falloff
 * - Filmic Tone Curve (toe, contrast about pivot, shoulder)
 * - Lift / Gamma / Gain
 * - Saturation & Split-Toning with neutral-axis fadeout
 * - Resolution-independent procedural film grain & chroma grain
 * - Vignette
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

// Filmic Tone Curve evaluation
float evalCurve(float x, vec4 curve) {
  float clampedX = clamp(x, 0.0, 1.0);
  float toe = curve.z;
  float val = clamp(toe + clampedX * (1.0 - toe), 0.0, 1.0);
  float pivot = max(0.01, min(0.99, curve.y));
  float contrast = max(0.1, curve.x);
  
  if (val <= pivot) {
    val = pivot * pow(clamp(val / pivot, 0.0, 1.0), contrast);
  } else {
    val = 1.0 - (1.0 - pivot) * pow(clamp((1.0 - val) / (1.0 - pivot), 0.0, 1.0), contrast);
  }

  float shoulder = curve.w;
  if (shoulder < 0.99 && val > shoulder) {
    float over = (val - shoulder) / (1.0 - shoulder);
    val = shoulder + (1.0 - shoulder) * (1.0 - exp(-over * 1.5));
  }
  return clamp(val, 0.0, 1.0);
}

void main() {
  vec2 uv = v_texCoord;
  vec4 baseColor = texture(u_image, uv);
  vec3 rgb = baseColor.rgb;

  // 1. Mild Sharpening (if enabled)
  if (u_sharpen > 0.0) {
    vec2 step = 1.0 / u_resolution;
    vec3 cN = texture(u_image, uv + vec2(0.0, step.y)).rgb;
    vec3 cS = texture(u_image, uv - vec2(0.0, step.y)).rgb;
    vec3 cE = texture(u_image, uv + vec2(step.x, 0.0)).rgb;
    vec3 cW = texture(u_image, uv - vec2(step.x, 0.0)).rgb;
    vec3 edge = 4.0 * rgb - (cN + cS + cE + cW);
    rgb = clamp(rgb + edge * (u_sharpen * 0.4), 0.0, 1.0);
  }

  // 2. Exposure EV
  if (u_exposureEV != 0.0) {
    rgb *= pow(2.0, u_exposureEV);
  }

  // 3. Flash Falloff
  if (u_flashFalloff.x > 0.0) {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 d = vec2((uv.x - u_flashFalloff.z) * aspect, uv.y - u_flashFalloff.w);
    float dist = length(d);
    float rad = max(0.1, u_flashFalloff.y);
    float att = max(0.0, 1.0 - dist / rad);
    float flashBoost = 1.0 + u_flashFalloff.x * (att * att - 0.3);
    rgb *= max(0.2, flashBoost);
  }
  rgb = clamp(rgb, 0.0, 1.0);

  // 4. Filmic Tone Curve
  rgb.r = evalCurve(rgb.r, u_curve);
  rgb.g = evalCurve(rgb.g, u_curve);
  rgb.b = evalCurve(rgb.b, u_curve);

  // 5. Lift / Gamma / Gain
  // Lift (shadows)
  rgb = clamp(rgb + u_lift, 0.0, 1.0);
  // Gamma (midtones)
  rgb = pow(rgb, 1.0 / max(vec3(0.1), u_gamma));
  // Gain (highlights)
  rgb = clamp(rgb * u_gain, 0.0, 1.0);

  // 6. Split-Toning with neutral-axis fadeout
  float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
  float maxC = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));
  float satWeight = clamp(maxC * 3.0, 0.0, 1.0);
  float splitMid = 0.5 + u_splitBalance * 0.25;

  if (luma < splitMid && u_splitTone.y > 0.0) {
    float t = clamp((1.0 - luma / max(0.01, splitMid)) * u_splitTone.y * satWeight, 0.0, 1.0);
    vec3 shadowTint = vec3(
      0.5 + 0.5 * cos(u_splitTone.x),
      0.5 + 0.5 * cos(u_splitTone.x - 2.094),
      0.5 + 0.5 * cos(u_splitTone.x + 2.094)
    );
    rgb = clamp(mix(rgb, rgb * shadowTint * 2.0, t), 0.0, 1.0);
  } else if (luma >= splitMid && u_splitTone.w > 0.0) {
    float t = clamp(((luma - splitMid) / max(0.01, 1.0 - splitMid)) * u_splitTone.w * satWeight, 0.0, 1.0);
    vec3 highlightTint = vec3(
      0.5 + 0.5 * cos(u_splitTone.z),
      0.5 + 0.5 * cos(u_splitTone.z - 2.094),
      0.5 + 0.5 * cos(u_splitTone.z + 2.094)
    );
    rgb = clamp(mix(rgb, rgb * highlightTint * 2.0, t), 0.0, 1.0);
  }

  // 7. Saturation adjustment
  luma = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = clamp(mix(vec3(luma), rgb, u_saturation), 0.0, 1.0);

  // 8. Film Grain (Normalized to frame height)
  if (u_grain.x > 0.0) {
    // Grain cell size scaled to frame height so preview and full-res match exactly
    float grainScale = max(0.0008, u_grain.y) * u_frameHeight;
    vec2 grainUv = (gl_FragCoord.xy) / grainScale;
    float seedOffset = u_isCapture ? u_seed : u_time * 12.0;
    
    float gMono = (fbmGrain(grainUv + seedOffset, u_grain.z) - 0.5);
    
    // Luminance-weighted peaking in midtones (~4 * L * (1 - L))
    float midtoneWeight = 4.0 * luma * (1.0 - luma);
    float grainVal = gMono * u_grain.x * midtoneWeight;

    if (u_grain.w > 0.0) {
      // Chroma sensor noise
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

  // 9. Vignette (Elliptical to aspect ratio)
  if (u_vignette.x > 0.0) {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 vUv = (uv - 0.5) * vec2(aspect, 1.0);
    float dist = length(vUv);
    float vig = smoothstep(u_vignette.y, u_vignette.y - u_vignette.z, dist);
    rgb *= mix(1.0 - u_vignette.x, 1.0, vig);
  }

  outColor = vec4(clamp(rgb, 0.0, 1.0), baseColor.a);
}
`;

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
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getProgramParameter && !gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("Shader compile error:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  public render(
    source: TexImageSource,
    look: LookRecipe,
    options: {
      width: number;
      height: number;
      isCapture?: boolean;
      seed?: number;
      time?: number;
      disableAnimatedGrain?: boolean;
    }
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
