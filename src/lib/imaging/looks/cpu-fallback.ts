import type { LookRecipe } from "./types";
import {
  evaluateLookColorTransform,
  sampleCubeLUTTrilinear,
  type ParsedCubeLUT,
} from "./cube-lut";

export interface CpuLookOptions {
  isNativeCamera?: boolean;
  intensity?: number;
  seed?: number;
  lut?: ParsedCubeLUT;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow(Math.max(1e-4, (c + 0.055) / 1.055), 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(1e-4, c), 1.0 / 2.4) - 0.055;
}

function pcg3d(vx: number, vy: number, vz: number): [number, number, number] {
  let x = (Math.imul(vx >>> 0, 1664525) + 1013904223) >>> 0;
  let y = (Math.imul(vy >>> 0, 1664525) + 1013904223) >>> 0;
  let z = (Math.imul(vz >>> 0, 1664525) + 1013904223) >>> 0;

  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;

  x = (x ^ (x >>> 16)) >>> 0;
  y = (y ^ (y >>> 16)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;

  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;

  return [x / 4294967296, y / 4294967296, z / 4294967296];
}

function triangularGrainNoise(px: number, py: number, seed: number): [number, number, number] {
  const r1 = pcg3d(px, py, seed);
  const r2 = pcg3d((px + 1597334677) >>> 0, (py + 3812015801) >>> 0, (seed + 1013904223) >>> 0);
  return [r1[0] + r2[0] - 1.0, r1[1] + r2[1] - 1.0, r1[2] + r2[2] - 1.0];
}

/**
 * Builds a fast in-memory 17^3 3D LUT baking both the LookRecipe color transform
 * and optional external .cube 3D LUT so CPU image processing matches the WebGL2 shader.
 */
export function buildBakedRecipeLUT(
  look: LookRecipe,
  isNativeCamera: boolean,
  externalLut?: ParsedCubeLUT
): ParsedCubeLUT {
  const size = 17;
  const data = new Float32Array(size * size * size * 3);
  const lutStrength = clamp01(look.lutStrength ?? 1.0);
  let ptr = 0;

  for (let b = 0; b < size; b++) {
    const fb = b / (size - 1);
    for (let g = 0; g < size; g++) {
      const fg = g / (size - 1);
      for (let r = 0; r < size; r++) {
        const fr = r / (size - 1);
        let [or, og, ob] = evaluateLookColorTransform(fr, fg, fb, look);
        if (externalLut && lutStrength > 0) {
          const [lr, lg, lb] = sampleCubeLUTTrilinear(externalLut, or, og, ob);
          or = or + (lr - or) * lutStrength;
          og = og + (lg - og) * lutStrength;
          ob = ob + (lb - ob) * lutStrength;
        }
        data[ptr++] = or;
        data[ptr++] = og;
        data[ptr++] = ob;
      }
    }
  }

  return {
    title: `Baked_${look.id}`,
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    floatData: data,
    byteData: new Uint8Array(0),
  };
}

/**
 * Applies a full LookRecipe (color transform + 3D LUT + vignette + optical density film grain)
 * directly to an ImageData buffer in CPU memory, matching LookEnginePipeline WebGL2 output.
 */
export function applyLookToImageData(
  imgData: ImageData,
  look: LookRecipe,
  options: CpuLookOptions = {}
): void {
  const { width, height, data } = imgData;
  if (width <= 0 || height <= 0) return;

  const isNativeCamera = options.isNativeCamera ?? false;
  const intensity = clamp01(
    options.intensity ?? (isNativeCamera ? 0.70 : (look.intensity ?? 1.0))
  );
  if (intensity <= 0) return;

  const seed = options.seed ?? 42;
  const uSeed = ((Math.abs(seed) * 1000) | 0) + 1337;

  const bakedLut = buildBakedRecipeLUT(look, isNativeCamera, options.lut);

  const vig = look.lens?.vignette ?? look.vignette;
  const vigStr = (vig?.strength ?? 0) * (isNativeCamera ? 0.5 : 1.0);
  const vigRadius = vig?.radius ?? 0.8;
  const vigSoftness = Math.max(0.05, vig?.softness ?? 0.35);
  const vigCurvature = Math.max(1.0, vig?.curvature ?? 2.0);
  const aspect = width / Math.max(1, height);

  const gr = look.emulsion?.grain ?? look.grain;
  const grainAmount = (gr?.amount ?? 0) * (isNativeCamera ? 0.7 : 1.0);
  const grainSizeNorm = gr?.size ?? 0.0016;
  const grainScale = Math.max(1.0, grainSizeNorm < 0.1 ? grainSizeNorm * height : grainSizeNorm);
  const grainChroma = clamp01(gr?.chroma ?? 0);

  for (let y = 0; y < height; y++) {
    const ny = (y + 0.5) / height - 0.5;
    const cellY = ((y + 0.5) / grainScale) >>> 0;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const origR = data[idx] / 255;
      const origG = data[idx + 1] / 255;
      const origB = data[idx + 2] / 255;

      // 1. Baked LookRecipe + 3D LUT color transform
      const [lutR, lutG, lutB] = sampleCubeLUTTrilinear(bakedLut, origR, origG, origB);

      let linR = srgbToLinear(lutR);
      let linG = srgbToLinear(lutG);
      let linB = srgbToLinear(lutB);

      // 2. Radial cos^4 / power vignette in linear space
      if (vigStr > 0) {
        const nx = ((x + 0.5) / width - 0.5) * aspect;
        const r = Math.hypot(nx, ny);
        const vigDist = Math.max(0, r - vigRadius * 0.5) / vigSoftness;
        const vigFalloff = Math.pow(Math.max(0, 1 - clamp01(vigDist) * 0.5), vigCurvature);
        const vigFactor = 1 + (vigFalloff - 1) * vigStr;
        linR *= vigFactor;
        linG *= vigFactor;
        linB *= vigFactor;
      }

      // 3. Exposure-aware optical density film grain
      if (grainAmount > 0.001) {
        const cellX = ((x + 0.5) / grainScale) >>> 0;
        const rawGrain = triangularGrainNoise(cellX, cellY, uSeed);
        const monoGrain = rawGrain[0];
        const dyeGrainR = monoGrain * 0.70 + rawGrain[0] * 0.30;
        const dyeGrainG = monoGrain * 0.80 + rawGrain[1] * 0.20;
        const dyeGrainB = monoGrain * 0.65 + rawGrain[2] * 0.35;

        const gR = monoGrain + (dyeGrainR - monoGrain) * grainChroma;
        const gG = monoGrain + (dyeGrainG - monoGrain) * grainChroma;
        const gB = monoGrain + (dyeGrainB - monoGrain) * grainChroma;

        const luma = clamp01(0.2126 * linR + 0.7152 * linG + 0.0722 * linB);
        const midtoneBell = Math.exp(-Math.pow((luma - 0.32) / 0.38, 2));
        const highlightRolloff = 1.0 - smoothstep(0.65, 0.98, luma);
        const shadowRolloff = smoothstep(0.0, 0.14, luma);
        const lumaMask = (0.15 + 0.85 * midtoneBell) * highlightRolloff * shadowRolloff;

        const densitySigma = grainAmount * lumaMask * 0.28;
        const k = densitySigma * 2.302585;
        linR = Math.max(0, linR * Math.exp(gR * k) - gR * densitySigma * 0.015 * shadowRolloff);
        linG = Math.max(0, linG * Math.exp(gG * k) - gG * densitySigma * 0.015 * shadowRolloff);
        linB = Math.max(0, linB * Math.exp(gB * k) - gB * densitySigma * 0.015 * shadowRolloff);
      }

      const gradedR = clamp01(linearToSrgb(clamp01(linR)));
      const gradedG = clamp01(linearToSrgb(clamp01(linG)));
      const gradedB = clamp01(linearToSrgb(clamp01(linB)));

      const finalR = origR + (gradedR - origR) * intensity;
      const finalG = origG + (gradedG - origG) * intensity;
      const finalB = origB + (gradedB - origB) * intensity;

      data[idx] = Math.round(clamp01(finalR) * 255);
      data[idx + 1] = Math.round(clamp01(finalG) * 255);
      data[idx + 2] = Math.round(clamp01(finalB) * 255);
    }
  }
}

export function applyLookToCanvas2D(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  look: LookRecipe,
  options: CpuLookOptions = {}
): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  applyLookToImageData(imgData, look, options);
  ctx.putImageData(imgData, 0, 0);
}
