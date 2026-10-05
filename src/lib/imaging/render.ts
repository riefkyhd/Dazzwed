import {
  MAX_EDGE,
  QUALITY_STEPS,
  TARGET_BYTES,
  cropForZoom,
  fitLongestEdge,
} from "./geometry";

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
}

/**
 * Crop → resize (longest edge ≤ 1920) → film look → JPEG (≈0.8, stepped down to stay <~900 KB).
 * Re-encoding through canvas drops all EXIF/GPS metadata.
 */
export async function renderShot(src: Source, { zoom = 1 }: RenderOptions = {}): Promise<Blob> {
  const { w, h } = sourceSize(src);
  if (!w || !h) throw new Error("source has no size");
  const crop = cropForZoom(w, h, zoom);
  const out = fitLongestEdge(crop.sw, crop.sh, MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
  applyFilmLook(ctx, out.width, out.height);

  let blob: Blob | null = null;
  for (const q of QUALITY_STEPS) {
    blob = await toBlob(canvas, q);
    if (blob.size <= TARGET_BYTES) break;
  }
  canvas.width = canvas.height = 0; // free memory (iOS canvas limits)
  return blob!;
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
      // Safe: decoded image keeps its pixels after the URL is revoked.
      URL.revokeObjectURL(url);
    }
  }
}

/** File from the OS camera → same pipeline as in-app shots. */
export async function renderFile(file: Blob): Promise<Blob> {
  const img = await decodeFile(file);
  try {
    return await renderShot(img);
  } finally {
    if ("close" in img) img.close();
  }
}
