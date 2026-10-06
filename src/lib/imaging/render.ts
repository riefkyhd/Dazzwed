import {
  MAX_EDGE,
  QUALITY_STEPS,
  cropForZoom,
  cropForAspectAndZoom,
  fitLongestEdge,
  type OutputTier,
  type CameraAspect,
  TIER_CONFIG,
} from "./geometry";
import type { LookRecipe } from "./looks/types";
import { DISPOSABLE_400_LOOK } from "./looks/presets";
import { LookEnginePipeline } from "./looks/pipeline";
import { drawEmulsionExtras, drawDateStamp, drawInstantFrame } from "./looks/stamp-and-frame";

type Source = HTMLVideoElement | ImageBitmap | HTMLImageElement;

function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

let grainTile: HTMLCanvasElement | null = null;
function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (grainTile = c);
}

/** Warm tint, soft vignette and film grain baked into the pixels. */
function applyFilmLook(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  // warm cast
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(255, 236, 205, 0.35)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255, 170, 70, 0.16)";
  ctx.fillRect(0, 0, w, h);
  // vignette
  ctx.globalCompositeOperation = "source-over";
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // grain (random offset so every shot differs)
  const pattern = ctx.createPattern(getGrainTile(), "repeat");
  if (pattern) {
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.2;
    ctx.translate(Math.random() * 256, Math.random() * 256);
    ctx.fillStyle = pattern;
    ctx.fillRect(-256, -256, w + 512, h + 512);
  }
  ctx.restore();
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
}

/**
 * Crop → resize → Look Engine WebGL shader → 2D extras → JPEG.
 * Re-encoding through canvas drops all EXIF/GPS metadata.
 */
export async function renderShot(
  src: Source,
  {
    zoom = 1,
    aspect,
    maxEdge = 4096,
    quality = 0.92,
    applyFilter = true,
    look = DISPOSABLE_400_LOOK,
    seed = 42,
    dateStampDate,
    coupleNames,
    sourceType = "in-app",
    intensity,
  }: RenderOptions & { maxEdge?: number; quality?: number; applyFilter?: boolean } = {}
): Promise<Blob> {
  const { w, h } = sourceSize(src);
  if (!w || !h) throw new Error("source has no size");

  // Default aspect ratio to the look's authentic format (e.g. 3:2 for Disposable, 4:3 for CCD, 1:1 for Instant)
  const targetAspect: CameraAspect = aspect ?? (look.aspectRatio as CameraAspect) ?? "3:4";
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
    ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
    const blob = await toBlob(canvas, quality);
    canvas.width = canvas.height = 0;
    return blob;
  }

  // Intermediate crop canvas if digital zoom applied
  let sourceToRender: TexImageSource = src;
  let interCanvas: HTMLCanvasElement | null = null;
  if (zoom > 1 || crop.sw !== w || crop.sh !== h) {
    interCanvas = document.createElement("canvas");
    interCanvas.width = out.width;
    interCanvas.height = out.height;
    const iCtx = interCanvas.getContext("2d");
    if (iCtx) {
      iCtx.imageSmoothingQuality = "high";
      iCtx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
      sourceToRender = interCanvas;
    }
  }

  // 1. Run WebGL2 Look Engine pipeline on a dedicated GL canvas
  const glCanvas = document.createElement("canvas");
  glCanvas.width = out.width;
  glCanvas.height = out.height;

  let rendered = false;
  let pipeline: LookEnginePipeline | null = null;
  try {
    pipeline = new LookEnginePipeline(glCanvas);
    const targetIntensity = intensity ?? (sourceType === "native" ? 0.70 : (look.intensity ?? 1.0));
    rendered = pipeline.render(sourceToRender, look, {
      width: out.width,
      height: out.height,
      isCapture: true,
      seed,
      isNativeCamera: sourceType === "native",
      intensity: targetIntensity,
    });
  } catch (err) {
    console.warn("WebGL2 Look Engine failed, falling back to 2D canvas:", err);
  } finally {
    if (pipeline) pipeline.destroy();
  }

  if (interCanvas) {
    interCanvas.width = interCanvas.height = 0;
  }

  // 2. Composite onto 2D canvas to support post-shader 2D extras
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Could not acquire 2D canvas context");
  ctx2d.imageSmoothingQuality = "high";

  if (rendered) {
    ctx2d.drawImage(glCanvas, 0, 0);
  } else {
    // Fallback 2D if WebGL unavailable
    ctx2d.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
    applyFilmLook(ctx2d, out.width, out.height);
  }
  glCanvas.width = glCanvas.height = 0; // free WebGL memory

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

