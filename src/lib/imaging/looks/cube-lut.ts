import type { LookRecipe } from "./types";
import {
  srgbToLinear,
  linearToSrgb,
  linearSrgbToOklab,
  oklabToOklch,
  fitOklchToGamut,
  evaluateHueTable,
  calculateSkinDamping,
  evaluateToneCurve,
  multiplyMatrix3x3,
} from "./math";

export interface ParsedCubeLUT {
  title?: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /** RGB float triples in [0, 1], length = size^3 * 3 (R fastest, G middle, B slowest) */
  floatData: Float32Array;
  /** RGB byte triples in [0, 255] ready for gl.texImage3D(TEXTURE_3D, ..., gl.RGB8, ..., gl.RGB, gl.UNSIGNED_BYTE, byteData) */
  byteData: Uint8Array;
}

/**
 * Legacy LUT filename mapping to neutral first-party LUT filenames
 */
export const LEGACY_LUT_URL_MAP: Record<string, string> = {
  "/luts/dazz-cpm35.cube": "/luts/rangefinder-35.cube",
  "/luts/kodak-portra-400.cube": "/luts/warm-portrait-400.cube",
  "/luts/kodak-gold-200.cube": "/luts/golden-200.cube",
  "/luts/kodak-ektar-100.cube": "/luts/vivid-100.cube",
  "/luts/fuji-classic-neg.cube": "/luts/classic-neg-400.cube",
  "/luts/fuji-eterna-250d.cube": "/luts/cinema-250d.cube",
  "/luts/cinestill-800t.cube": "/luts/tungsten-800t.cube",
  "/luts/ilford-hp5-plus.cube": "/luts/mono-street-400.cube",
  "/luts/super-8mm-vintage.cube": "/luts/super-8mm-vintage.cube",
};

export function resolveLutUrl(url: string): string {
  return LEGACY_LUT_URL_MAP[url] ?? url;
}

/**
 * Parses an Adobe .cube 3D LUT plain-text string into Float32Array and Uint8Array RGB triples.
 */
export function parseCubeLUT(text: string): ParsedCubeLUT {
  const lines = text.split(/\r?\n/);
  let title: string | undefined;
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];

  const rawValues: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("TITLE")) {
      const match = line.match(/^TITLE\s+"?([^"]*)"?/i);
      if (match) title = match[1].trim();
      continue;
    }
    if (line.startsWith("LUT_3D_SIZE")) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
      if (!Number.isFinite(size) || size < 2 || size > 128) {
        throw new Error(`Invalid LUT_3D_SIZE: ${parts[1]}`);
      }
      continue;
    }
    if (line.startsWith("DOMAIN_MIN")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && parts.every(Number.isFinite)) {
        domainMin = [parts[0], parts[1], parts[2]];
      }
      continue;
    }
    if (line.startsWith("DOMAIN_MAX")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && parts.every(Number.isFinite)) {
        domainMax = [parts[0], parts[1], parts[2]];
      }
      continue;
    }
    if (line.startsWith("LUT_1D_SIZE") || line.startsWith("LUT_")) {
      throw new Error(`Unsupported LUT type in .cube file: ${line}`);
    }

    // Parse RGB float triple
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        rawValues.push(r, g, b);
      }
    }
  }

  if (!size) {
    throw new Error("Missing LUT_3D_SIZE in .cube file");
  }

  const expectedFloats = size * size * size * 3;
  if (rawValues.length < expectedFloats) {
    throw new Error(
      `Incomplete .cube data: expected ${expectedFloats / 3} RGB triples for size ${size}, got ${rawValues.length / 3}`
    );
  }

  const floatData = new Float32Array(expectedFloats);
  const byteData = new Uint8Array(expectedFloats);

  const rangeR = Math.max(1e-6, domainMax[0] - domainMin[0]);
  const rangeG = Math.max(1e-6, domainMax[1] - domainMin[1]);
  const rangeB = Math.max(1e-6, domainMax[2] - domainMin[2]);

  for (let i = 0; i < expectedFloats; i += 3) {
    const r = Math.min(1, Math.max(0, (rawValues[i] - domainMin[0]) / rangeR));
    const g = Math.min(1, Math.max(0, (rawValues[i + 1] - domainMin[1]) / rangeG));
    const b = Math.min(1, Math.max(0, (rawValues[i + 2] - domainMin[2]) / rangeB));

    floatData[i] = r;
    floatData[i + 1] = g;
    floatData[i + 2] = b;

    byteData[i] = Math.round(r * 255);
    byteData[i + 1] = Math.round(g * 255);
    byteData[i + 2] = Math.round(b * 255);
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    floatData,
    byteData,
  };
}

/**
 * Generates an identity 3D LUT of the given grid size (default 17).
 */
export function createIdentityCubeLUT(size = 17): ParsedCubeLUT {
  const total = size * size * size * 3;
  const floatData = new Float32Array(total);
  const byteData = new Uint8Array(total);
  const denom = Math.max(1, size - 1);

  let idx = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const rf = r / denom;
        const gf = g / denom;
        const bf = b / denom;
        floatData[idx] = rf;
        floatData[idx + 1] = gf;
        floatData[idx + 2] = bf;
        byteData[idx] = Math.round(rf * 255);
        byteData[idx + 1] = Math.round(gf * 255);
        byteData[idx + 2] = Math.round(bf * 255);
        idx += 3;
      }
    }
  }

  return {
    title: "Identity",
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    floatData,
    byteData,
  };
}

/**
 * Evaluates a ParsedCubeLUT at (r, g, b) in [0, 1] using trilinear interpolation
 * matching WebGL2 TEXTURE_3D gl.LINEAR sampling.
 */
export function sampleCubeLUTTrilinear(
  lut: ParsedCubeLUT,
  r: number,
  g: number,
  b: number,
  strength = 1.0
): [number, number, number] {
  const N = lut.size;
  const maxIdx = N - 1;

  const cr = Math.min(1, Math.max(0, r));
  const cg = Math.min(1, Math.max(0, g));
  const cb = Math.min(1, Math.max(0, b));

  const x = cr * maxIdx;
  const y = cg * maxIdx;
  const z = cb * maxIdx;

  const x0 = Math.min(maxIdx, Math.floor(x));
  const y0 = Math.min(maxIdx, Math.floor(y));
  const z0 = Math.min(maxIdx, Math.floor(z));

  const x1 = Math.min(maxIdx, x0 + 1);
  const y1 = Math.min(maxIdx, y0 + 1);
  const z1 = Math.min(maxIdx, z0 + 1);

  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;

  const getVoxel = (ix: number, iy: number, iz: number): [number, number, number] => {
    const offset = ((iz * N + iy) * N + ix) * 3;
    return [lut.floatData[offset], lut.floatData[offset + 1], lut.floatData[offset + 2]];
  };

  const c000 = getVoxel(x0, y0, z0);
  const c100 = getVoxel(x1, y0, z0);
  const c010 = getVoxel(x0, y1, z0);
  const c110 = getVoxel(x1, y1, z0);
  const c001 = getVoxel(x0, y0, z1);
  const c101 = getVoxel(x1, y0, z1);
  const c011 = getVoxel(x0, y1, z1);
  const c111 = getVoxel(x1, y1, z1);

  const out: [number, number, number] = [0, 0, 0];
  const s = Math.min(1, Math.max(0, strength));
  const orig = [cr, cg, cb];

  for (let ch = 0; ch < 3; ch++) {
    const c00 = c000[ch] * (1 - fx) + c100[ch] * fx;
    const c10 = c010[ch] * (1 - fx) + c110[ch] * fx;
    const c01 = c001[ch] * (1 - fx) + c101[ch] * fx;
    const c11 = c011[ch] * (1 - fx) + c111[ch] * fx;

    const c0 = c00 * (1 - fy) + c10 * fy;
    const c1 = c01 * (1 - fy) + c11 * fy;

    const sampled = c0 * (1 - fz) + c1 * fz;
    out[ch] = orig[ch] * (1 - s) + sampled * s;
  }

  return out;
}

const lutCache = new Map<string, ParsedCubeLUT>();
const inflightLutLoads = new Map<string, Promise<ParsedCubeLUT>>();

export function getCachedCubeLUT(url: string): ParsedCubeLUT | undefined {
  const canonical = resolveLutUrl(url);
  return lutCache.get(url) ?? lutCache.get(canonical);
}

export function setCachedCubeLUT(url: string, lut: ParsedCubeLUT): void {
  lutCache.set(url, lut);
  lutCache.set(resolveLutUrl(url), lut);
}

export async function preloadCubeLUT(url: string): Promise<ParsedCubeLUT> {
  const canonical = resolveLutUrl(url);
  const cached = lutCache.get(url) ?? lutCache.get(canonical);
  if (cached) return cached;

  const inflight = inflightLutLoads.get(canonical);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      let res = await fetch(canonical);
      if (!res.ok && canonical !== url) {
        res = await fetch(url);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching LUT ${url}`);
      }
      const text = await res.text();
      const parsed = parseCubeLUT(text);
      lutCache.set(url, parsed);
      lutCache.set(canonical, parsed);
      return parsed;
    } catch (err) {
      console.warn(`Failed to load .cube LUT from ${url}, using identity fallback:`, err);
      const fallback = createIdentityCubeLUT(17);
      lutCache.set(url, fallback);
      lutCache.set(canonical, fallback);
      return fallback;
    } finally {
      inflightLutLoads.delete(canonical);
    }
  })();

  inflightLutLoads.set(canonical, promise);
  return promise;
}

/**
 * Evaluates Stage 2 (Film Response) + Stage 3 (OKLCH Color Grading) of a LookRecipe
 * on an sRGB triple [r, g, b] in [0, 1]. Used both for baking first-party .cube LUTs
 * and for reference verification in unit tests.
 */
export function evaluateLookColorTransform(
  r: number,
  g: number,
  b: number,
  look: LookRecipe
): [number, number, number] {
  const resp = look.response;
  const col = look.color;

  // Stage 2a: Linear Exposure EV
  const ev = resp?.exposureEV ?? look.exposureEV ?? 0;
  const evMul = Math.abs(ev) > 0.001 ? Math.pow(2, ev) : 1.0;

  let lin: [number, number, number] = [
    srgbToLinear(r) * evMul,
    srgbToLinear(g) * evMul,
    srgbToLinear(b) * evMul,
  ];

  // Stage 2c: 3x3 Dye Cross-Talk Matrix
  const matrix = resp?.dyeMatrix ?? look.matrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  lin = multiplyMatrix3x3(matrix, lin);
  lin = [Math.max(0, lin[0]), Math.max(0, lin[1]), Math.max(0, lin[2])];

  // Stage 2d: Per-Channel Filmic Tone Curves
  const curveR = resp?.curveR ?? look.curve;
  const curveG = resp?.curveG ?? look.curve;
  const curveB = resp?.curveB ?? look.curve;

  let sr = evaluateToneCurve(linearToSrgb(lin[0]), curveR);
  let sg = evaluateToneCurve(linearToSrgb(lin[1]), curveG);
  let sb = evaluateToneCurve(linearToSrgb(lin[2]), curveB);

  // Stage 3: OKLCH Color Grading
  const [L, a, bLab] = linearSrgbToOklab(srgbToLinear(sr), srgbToLinear(sg), srgbToLinear(sb));
  const [, C, hDeg] = oklabToOklch(L, a, bLab);

  const hueShift = evaluateHueTable(hDeg, col?.hueTable ?? []);
  const skinDamp = calculateSkinDamping(hDeg, col?.skinProtection);

  const dH = hueShift.dHue * skinDamp;
  const dC = 1.0 + (hueShift.dChroma - 1.0) * skinDamp;
  const dL = hueShift.dLightness;

  let gradedH = ((hDeg + dH) % 360 + 360) % 360;
  let gradedC = Math.max(0, C * dC * Math.max(0, col?.saturation ?? look.saturation ?? 1.0));
  const gradedL = Math.max(0, Math.min(1, L + dL));

  // Brightness-dependent saturation
  const midWeight = 4.0 * gradedL * (1.0 - gradedL);
  const shadowBoost = col?.brightSatCurve?.shadowBoost ?? 0;
  const highlightDesat = col?.brightSatCurve?.highlightDesat ?? 0;
  gradedC *= 1.0 + shadowBoost * midWeight;
  if (gradedL > 0.8) {
    const t = Math.max(0, Math.min(1, (gradedL - 0.8) / 0.2));
    const st = t * t * (3 - 2 * t);
    gradedC *= 1.0 - st * highlightDesat;
  }

  // Highlight warmth drift
  const hw = col?.highlightWarmth ?? 0;
  if (hw > 0 && gradedL > 0.85) {
    const t = Math.max(0, Math.min(1, (gradedL - 0.85) / 0.13));
    const st = t * t * (3 - 2 * t) * hw;
    gradedH = gradedH * (1 - st * 0.5) + 42.0 * (st * 0.5);
  }

  const [linOutR, linOutG, linOutB] = fitOklchToGamut(gradedL, gradedC, gradedH);
  sr = linearToSrgb(linOutR);
  sg = linearToSrgb(linOutG);
  sb = linearToSrgb(linOutB);

  // Shadow Tint
  const sTint = col?.shadowTint ?? [0, 0, 0];
  if (gradedL < 0.25) {
    const stWeight = (1.0 - gradedL / 0.25) * 0.3;
    sr = Math.max(0, Math.min(1, sr + sTint[0] * stWeight));
    sg = Math.max(0, Math.min(1, sg + sTint[1] * stWeight));
    sb = Math.max(0, Math.min(1, sb + sTint[2] * stWeight));
  }

  // White Protect
  const luma = 0.299 * sr + 0.587 * sg + 0.114 * sb;
  if ((col?.whiteProtect ?? look.whiteProtect ?? true) && luma > 0.85) {
    const t = Math.max(0, Math.min(1, (luma - 0.85) / 0.13));
    const wpWeight = t * t * (3 - 2 * t) * 0.96;
    sr = sr * (1 - wpWeight) + luma * wpWeight;
    sg = sg * (1 - wpWeight) + luma * wpWeight;
    sb = sb * (1 - wpWeight) + luma * wpWeight;
  }

  return [
    Math.max(0, Math.min(1, sr)),
    Math.max(0, Math.min(1, sg)),
    Math.max(0, Math.min(1, sb)),
  ];
}

/**
 * Serializes a LookRecipe's color transform into a clean first-party Adobe .cube 3D LUT string.
 */
export function serializeLookToCubeLUT(look: LookRecipe, size = 17, title?: string): string {
  const safeTitle = (title ?? look.name).replace(/"/g, "");
  const lines: string[] = [
    `# Generated by Disposable Cam Look Engine v2 (First-Party Color Science)`,
    `# License: First-Party MIT / Project Internal`,
    `TITLE "${safeTitle}"`,
    `LUT_3D_SIZE ${size}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`,
  ];

  const denom = Math.max(1, size - 1);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const rf = r / denom;
        const gf = g / denom;
        const bf = b / denom;
        const [outR, outG, outB] = evaluateLookColorTransform(rf, gf, bf, look);
        lines.push(`${outR.toFixed(6)} ${outG.toFixed(6)} ${outB.toFixed(6)}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

