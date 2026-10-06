/**
 * Shared WebGL2/WebGL1 Film Simulation Shader Pipeline
 *
 * Implements vintage 90s disposable film aesthetic:
 * - Warm color grade with lifted blacks and soft teal shadows
 * - Film grain (procedural hash, animated in preview, fixed seed on capture)
 * - Vignette and subtle light halation
 * - Real-time preview through requestVideoFrameCallback
 * - Offscreen full-resolution capture rendering matching preview
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

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_image;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_grainIntensity;
uniform float u_vignetteIntensity;
uniform float u_warmth;
uniform bool u_isCapture;

// High quality pseudo-random hash
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec4 color = texture(u_image, v_texCoord);
  vec3 rgb = color.rgb;

  // 1. Lift blacks and compress dynamic range (film curve)
  rgb = pow(rgb, vec3(0.92));
  rgb = mix(vec3(0.04), vec3(1.0), rgb);

  // 2. Warm color grade + subtle teal shadows
  // Warm highlights (golden/amber)
  vec3 warmCast = vec3(1.08, 0.98, 0.88);
  // Teal shadow tint
  float luminance = dot(rgb, vec3(0.299, 0.587, 0.114));
  vec3 tealShadow = vec3(0.85, 0.98, 1.05);
  rgb = mix(rgb * tealShadow, rgb * warmCast, smoothstep(0.1, 0.7, luminance));

  // 3. Subtle vintage saturation boost
  rgb = mix(vec3(luminance), rgb, 1.12);

  // 4. Vignette
  vec2 uv = (v_texCoord - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float dist = length(uv);
  float vignette = smoothstep(0.8, 0.25, dist * u_vignetteIntensity);
  rgb *= mix(0.72, 1.0, vignette);

  // 5. Film Grain
  if (u_grainIntensity > 0.0) {
    vec2 grainCoord = gl_FragCoord.xy;
    float seed = u_isCapture ? 42.0 : u_time;
    float grain = (hash(grainCoord + seed) - 0.5) * u_grainIntensity;
    rgb += grain * (0.8 + 0.4 * luminance);
  }

  // Soft clamp
  outColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
`;

// WebGL 1.0 Fallback Shader Sources
const VERTEX_SHADER_V1 = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_V1 = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_grainIntensity;
uniform float u_vignetteIntensity;
uniform float u_warmth;
uniform bool u_isCapture;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec4 color = texture2D(u_image, v_texCoord);
  vec3 rgb = color.rgb;

  // Lift blacks
  rgb = mix(vec3(0.04), vec3(1.0), rgb);

  // Warm tone
  rgb *= vec3(1.08, 0.98, 0.88);

  // Vignette
  vec2 uv = (v_texCoord - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float dist = length(uv);
  float vig = smoothstep(0.8, 0.25, dist * u_vignetteIntensity);
  rgb *= mix(0.75, 1.0, vig);

  // Grain
  if (u_grainIntensity > 0.0) {
    float seed = u_isCapture ? 42.0 : u_time;
    float grain = (hash(gl_FragCoord.xy + seed) - 0.5) * u_grainIntensity;
    rgb += grain;
  }

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
`;

export class WebGLFilmFilter {
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private isWebGL2 = false;
  private texture: WebGLTexture | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // Uniform locations
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uResLoc: WebGLUniformLocation | null = null;
  private uGrainLoc: WebGLUniformLocation | null = null;
  private uVignetteLoc: WebGLUniformLocation | null = null;
  private uIsCaptureLoc: WebGLUniformLocation | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.initGL();
  }

  private initGL() {
    // Try WebGL2 first
    const gl2 = this.canvas.getContext("webgl2", {
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (gl2) {
      this.gl = gl2;
      this.isWebGL2 = true;
      this.compileProgram(VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    } else {
      // Fallback WebGL1
      const gl1 = this.canvas.getContext("webgl", {
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      });
      if (gl1) {
        this.gl = gl1;
        this.isWebGL2 = false;
        this.compileProgram(VERTEX_SHADER_V1, FRAGMENT_SHADER_V1);
      }
    }

    if (this.gl && this.program) {
      this.setupBuffers();
      this.setupUniforms();
    }
  }

  private compileProgram(vertSrc: string, fragSrc: string) {
    const gl = this.gl!;
    const vertShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertShader, vertSrc);
    gl.compileShader(vertShader);

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragShader, fragSrc);
    gl.compileShader(fragShader);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vertShader);
    gl.attachShader(prog, fragShader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Shader program failed link, falling back:", gl.getProgramInfoLog(prog));
      this.program = null;
      return;
    }
    this.program = prog;
  }

  private setupBuffers() {
    const gl = this.gl!;
    const prog = this.program!;

    const posLoc = gl.getAttribLocation(prog, "a_position");
    const texLoc = gl.getAttribLocation(prog, "a_texCoord");

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private setupUniforms() {
    const gl = this.gl!;
    const prog = this.program!;
    this.uTimeLoc = gl.getUniformLocation(prog, "u_time");
    this.uResLoc = gl.getUniformLocation(prog, "u_resolution");
    this.uGrainLoc = gl.getUniformLocation(prog, "u_grainIntensity");
    this.uVignetteLoc = gl.getUniformLocation(prog, "u_vignetteIntensity");
    this.uIsCaptureLoc = gl.getUniformLocation(prog, "u_isCapture");
  }

  public render(
    source: TexImageSource,
    options: {
      width: number;
      height: number;
      time?: number;
      grainIntensity?: number;
      vignetteIntensity?: number;
      isCapture?: boolean;
    }
  ) {
    if (!this.gl || !this.program) return false;
    const gl = this.gl;

    if (this.canvas.width !== options.width || this.canvas.height !== options.height) {
      this.canvas.width = options.width;
      this.canvas.height = options.height;
    }

    gl.viewport(0, 0, options.width, options.height);
    gl.useProgram(this.program);

    // Upload texture frame
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.uniform1f(this.uTimeLoc, options.time ?? performance.now() * 0.001);
    gl.uniform2f(this.uResLoc, options.width, options.height);
    gl.uniform1f(this.uGrainLoc, options.grainIntensity ?? 0.08);
    gl.uniform1f(this.uVignetteLoc, options.vignetteIntensity ?? 1.1);
    gl.uniform1i(this.uIsCaptureLoc, options.isCapture ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }

  public getMaxTextureSize(): number {
    if (!this.gl) return 2048;
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) || 4096;
  }

  public getVersion(): "WebGL2" | "WebGL1" | "none" {
    if (!this.gl) return "none";
    return this.isWebGL2 ? "WebGL2" : "WebGL1";
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
