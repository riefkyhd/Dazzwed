import {
  cropForAspectAndZoom,
  fitLongestEdge,
  type CameraAspect,
} from "./geometry";
import type { LookRecipe } from "./looks/types";
import { DISPOSABLE_400_LOOK } from "./looks/presets";
import { LookEnginePipeline } from "./looks/pipeline";
import { preloadCubeLUT, type ParsedCubeLUT } from "./looks/cube-lut";
import { applyLookToCanvas2D } from "./looks/cpu-fallback";
import { drawEmulsionExtras, drawDateStamp, drawInstantFrame } from "./looks/stamp-and-frame";

type Source = HTMLVideoElement | ImageBitmap | HTMLImageElement;

function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

export interface RenderOptions {
  /** Digital zoom factor (centered crop). Use 1 when native zoom already applied. */
  zoom?: number;
  /** Camera aspect ratio crop (3:4, 16:9, 1:1, 3:2, 4:3) */
  aspect?: CameraAspect;
  /** Active Look Recipe to apply */
  look?: LookRecipe;
  /** Randomization seed for procedural extras */
  seed?: number;
  /** Event date or capture date for orange date stamp */
  dateStampDate?: Date;
  /** Optional couple names for instant frame caption */
  coupleNames?: string;
  /** Capture source origin */
  sourceType?: "in-app" | "native";
  /** Optional intensity override (e.g. 0.70 for native photos) */
  intensity?: number;
  /** Horizontally mirror the captured image (e.g. front camera matching preview) */
  mirror?: boolean;
  /** Optional manual exposure compensation (EV bias, e.g. -2.0 to +2.0) */
  exposureCompensation?: number;
}

let sharedCapturePipeline: LookEnginePipeline | null = null;
let sharedGlCanvas: HTMLCanvasElement | null = null;

export function getSharedCapturePipeline(): { pipeline: LookEnginePipeline; canvas: HTMLCanvasElement } {
  if (typeof document === "undefined") throw new Error("DOM unavailable");
  if (!sharedGlCanvas) {
    sharedGlCanvas = document.createElement("canvas");
    sharedGlCanvas.width = 1920;
    sharedGlCanvas.height = 1440;
  }
  if (!sharedCapturePipeline) {
    sharedCapturePipeline = new LookEnginePipeline(sharedGlCanvas);
  }
  return { pipeline: sharedCapturePipeline, canvas: sharedGlCanvas };
}

export function prewarmCapturePipeline(): void {
  if (typeof window === "undefined") return;
  try {
    getSharedCapturePipeline();
  } catch (e) {
    console.warn("Pre-warm capture pipeline failed:", e);
  }
}

/**
 * Crop → resize → Look Engine WebGL shader (or CPU LookRecipe fallback) → 2D extras → JPEG.
 * Re-encoding through canvas drops all EXIF/GPS metadata.
 */
export async function renderShot(
  src: Source,
  {
    zoom = 1,
    aspect,
    maxEdge = 2560,
    quality = 0.90,
    applyFilter = true,
    look = DISPOSABLE_400_LOOK,
    seed = 42,
    dateStampDate,
    coupleNames,
    sourceType = "in-app",
    intensity,
    mirror = false,
    exposureCompensation,
  }: RenderOptions & { maxEdge?: number; quality?: number; applyFilter?: boolean } = {}
): Promise<Blob> {
  const { w, h } = sourceSize(src);
  if (!w || !h) throw new Error("source has no size");

  // Aspect ratio: in-app shots explicitly supply `aspect` (e.g. "3:4", "9:16", "1:1").
  // If none supplied, default to "3:4" (full sensor) or look's format if defined.
  const targetAspect: CameraAspect = aspect ?? (look?.aspectRatio as CameraAspect) ?? "3:4";
  const crop = cropForAspectAndZoom(w, h, targetAspect, zoom);
  const out = fitLongestEdge(crop.sw, crop.sh, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;

  // If clean original requested, draw directly without filter
  if (!applyFilter) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.imageSmoothingQuality = "high";
    if (mirror) {
      ctx.save();
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
      ctx.restore();
    } else {
      ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
    }
    const blob = await toBlob(canvas, quality);
    canvas.width = canvas.height = 0;
    return blob;
  }

  // Intermediate crop canvas if digital zoom applied, video source, or mirroring needed
  let sourceToRender: TexImageSource = src;
  let interCanvas: HTMLCanvasElement | null = null;
  if (src instanceof HTMLVideoElement || zoom > 1 || crop.sw !== w || crop.sh !== h || mirror) {
    interCanvas = document.createElement("canvas");
    interCanvas.width = out.width;
    interCanvas.height = out.height;
    const iCtx = interCanvas.getContext("2d");
    if (iCtx) {
      iCtx.imageSmoothingQuality = "high";
      if (mirror) {
        iCtx.save();
        iCtx.translate(out.width, 0);
        iCtx.scale(-1, 1);
        iCtx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
        iCtx.restore();
      } else {
        iCtx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
      }
      sourceToRender = interCanvas;
    }
  }

  // 1. Run WebGL2 Look Engine pipeline (calibrated recipes + native 3D LUT match live viewfinder 1:1)
  let rendered = false;
  let processedCanvas: HTMLCanvasElement | null = null;
  let loadedLut: ParsedCubeLUT | undefined;
  const targetIntensity = intensity ?? (sourceType === "native" ? 0.70 : (look.intensity ?? 1.0));

  try {
    loadedLut = look.lutUrl ? await preloadCubeLUT(look.lutUrl) : undefined;
    const { pipeline: p, canvas: glCanvas } = getSharedCapturePipeline();
    if (glCanvas.width !== out.width || glCanvas.height !== out.height) {
      glCanvas.width = out.width;
      glCanvas.height = out.height;
    }
    rendered = p.render(sourceToRender, look, {
      width: out.width,
      height: out.height,
      isCapture: true,
      seed,
      isNativeCamera: sourceType === "native",
      intensity: targetIntensity,
      lut: loadedLut,
      exposureCompensation,
    });
    if (rendered) processedCanvas = glCanvas;
  } catch (err) {
    console.warn("WebGL2 Look Engine failed, falling back to CPU LookRecipe pipeline:", err);
  }

  // 2. Composite onto 2D canvas to support post-shader 2D extras
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Could not acquire 2D canvas context");
  ctx2d.imageSmoothingQuality = "high";

  if (rendered && processedCanvas) {
    ctx2d.drawImage(processedCanvas, 0, 0);
  } else {
    // Fallback 2D if WebGL unavailable — uses the exact same LookRecipe color science
    if (mirror) {
      ctx2d.save();
      ctx2d.translate(out.width, 0);
      ctx2d.scale(-1, 1);
      ctx2d.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
      ctx2d.restore();
    } else {
      ctx2d.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
    }
    applyLookToCanvas2D(ctx2d, out.width, out.height, look, {
      isNativeCamera: sourceType === "native",
      intensity: targetIntensity,
      seed,
      lut: loadedLut,
    });
  }

  if (interCanvas) {
    interCanvas.width = interCanvas.height = 0;
  }

  // 3. Post-shader 2D extras pass (Light leaks, dust, date stamp, instant frame)
  drawEmulsionExtras(ctx2d, out.width, out.height, look, seed);
  if (look.dateStamp.enabled) {
    drawDateStamp(ctx2d, out.width, out.height, look, dateStampDate);
  }
  if (look.frame.type === "instant") {
    drawInstantFrame(ctx2d, out.width, out.height, look, coupleNames);
  }

  // Read back immediately in the same task
  const blob = await toBlob(canvas, quality);
  canvas.width = canvas.height = 0; // free memory
  return blob;
}

/**
 * Composite a GPU-processed WebGL canvas or image blob with 2D film extras
 * (date stamps, instant frames, light leaks, and couple names).
 */
export async function compositeProcessed2D(
  processedSource: ImageBitmap | HTMLCanvasElement | Blob,
  options: {
    look?: LookRecipe;
    seed?: number;
    dateStampDate?: Date;
    coupleNames?: string;
    quality?: number;
  } = {}
): Promise<Blob> {
  let imgBitmap: ImageBitmap;
  if (processedSource instanceof Blob) {
    imgBitmap = await createImageBitmap(processedSource);
  } else if (processedSource instanceof HTMLCanvasElement) {
    imgBitmap = await createImageBitmap(processedSource);
  } else {
    imgBitmap = processedSource;
  }

  const w = imgBitmap.width;
  const h = imgBitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imgBitmap, 0, 0);

  const look = options.look ?? DISPOSABLE_400_LOOK;
  const seed = options.seed ?? 42;

  try {
    drawEmulsionExtras(ctx, w, h, look, seed);
    if (look.dateStamp.enabled) {
      drawDateStamp(ctx, w, h, look, options.dateStampDate);
    }
    if (look.frame.type === "instant") {
      drawInstantFrame(ctx, w, h, look, options.coupleNames);
    }

    const outBlob = await toBlob(canvas, options.quality ?? 0.95);
    canvas.width = canvas.height = 0;
    return outBlob;
  } finally {
    if ("close" in imgBitmap && processedSource !== imgBitmap) {
      imgBitmap.close();
    }
  }
}

/** Decode a file from the OS camera/picker, honouring EXIF orientation. */
export async function decodeFile(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** File from the OS camera → same pipeline as in-app shots. */
export async function renderFile(
  file: Blob,
  options?: RenderOptions & { maxEdge?: number; quality?: number; applyFilter?: boolean }
): Promise<Blob> {
  const img = await decodeFile(file);
  try {
    return await renderShot(img, options);
  } finally {
    if ("close" in img) img.close();
  }
}

