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

export type Source = HTMLVideoElement | ImageBitmap | HTMLImageElement | HTMLCanvasElement;

/**
 * Fast sanity check on an HTMLCanvasElement: samples center and 4 distributed points.
 * Returns true if all sampled pixels are completely transparent (a===0) or solid black [0,0,0,255],
 * indicating unrendered WebGL buffers or suspended video frames on iOS WebKit.
 */
export function isCanvasBlankOrBlack(canvas: HTMLCanvasElement): boolean {
  try {
    const w = canvas.width;
    const h = canvas.height;
    if (w <= 0 || h <= 0) return true;

    // 1. Try 2D context first (standard 2D canvases & test mocks)
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (ctx && typeof ctx.getImageData === "function") {
      const points = [
        [Math.floor(w * 0.5), Math.floor(h * 0.5)],
        [Math.floor(w * 0.2), Math.floor(h * 0.2)],
        [Math.floor(w * 0.8), Math.floor(h * 0.2)],
        [Math.floor(w * 0.2), Math.floor(h * 0.8)],
        [Math.floor(w * 0.8), Math.floor(h * 0.8)],
      ];

      let allBlankOrSolidBlack = true;
      for (const [x, y] of points) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[3] > 0 && (pixel[0] > 10 || pixel[1] > 10 || pixel[2] > 10)) {
          allBlankOrSolidBlack = false;
          break;
        }
      }
      return allBlankOrSolidBlack;
    }

    // 2. Otherwise check if canvas is WebGL or WebGL2
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (gl && typeof gl.readPixels === "function") {
      const samplePoints = [
        [Math.floor(w * 0.5), Math.floor(h * 0.5)],
        [Math.floor(w * 0.2), Math.floor(h * 0.2)],
        [Math.floor(w * 0.8), Math.floor(h * 0.8)],
      ];
      const pixel = new Uint8Array(4);
      for (const [x, y] of samplePoints) {
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        if (pixel[3] > 0 && (pixel[0] > 10 || pixel[1] > 10 || pixel[2] > 10)) {
          return false;
        }
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Fast sanity check on a JPEG Blob: samples center and downscaled pixels.
 * Returns true if the image is solid black or transparent (all channels <= 10).
 */
export async function isBlobBlankOrBlack(blob: Blob): Promise<boolean> {
  try {
    if (!blob || blob.size < 500) return true;
    let imgSource: ImageBitmap | HTMLImageElement | null = null;
    let urlToRevoke: string | null = null;

    if (typeof createImageBitmap === "function") {
      try {
        imgSource = await createImageBitmap(blob);
      } catch {
        imgSource = null;
      }
    }

    if (!imgSource && typeof Image !== "undefined" && typeof URL !== "undefined") {
      try {
        const url = URL.createObjectURL(blob);
        urlToRevoke = url;
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("img load error"));
          img.src = url;
        });
        imgSource = img;
      } catch {
        imgSource = null;
      }
    }

    if (!imgSource) return false;

    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      if (imgSource instanceof ImageBitmap && typeof imgSource.close === "function") imgSource.close();
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      return false;
    }

    ctx.drawImage(imgSource, 0, 0, 16, 16);
    if (imgSource instanceof ImageBitmap && typeof imgSource.close === "function") imgSource.close();
    if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);

    const data = ctx.getImageData(0, 0, 16, 16).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const byteString = atob(parts[1] || "");
  const mimeString = (parts[0] || "").split(":")[1]?.split(";")[0] || "image/jpeg";
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => {
          if (b && b.size > 0) {
            resolve(b);
            return;
          }
          // iOS Safari WebKit canvas toBlob null return fallback
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            const blob = dataUrlToBlob(dataUrl);
            if (blob && blob.size > 0) {
              resolve(blob);
              return;
            }
          } catch (e) {
            console.warn("toBlob fallback dataURL failed:", e);
          }
          reject(new Error("encode failed"));
        },
        "image/jpeg",
        quality
      );
    } catch (err) {
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const blob = dataUrlToBlob(dataUrl);
        if (blob && blob.size > 0) {
          resolve(blob);
          return;
        }
      } catch {}
      reject(err);
    }
  });
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
  /** Whether shot was illuminated by flash (applies Godox Xenon Strobe direct-flash grading pass) */
  flashUsed?: boolean;
  /** Physical tilt holding angle (0 = portrait upright, 90 = landscape left, -90 = landscape right) */
  tiltAngle?: 0 | 90 | -90;
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
    sharedCapturePipeline = new LookEnginePipeline(sharedGlCanvas, { preserveDrawingBuffer: true });
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
    flashUsed = false,
    tiltAngle,
  }: RenderOptions & { maxEdge?: number; quality?: number; applyFilter?: boolean } = {}
): Promise<Blob> {
  const { w, h } = sourceSize(src);
  if (!w || !h) throw new Error("source has no size");

  // Determine if rotation is needed to produce true landscape output from portrait sensor
  const isRotated = (tiltAngle === 90 || tiltAngle === -90) && w < h;
  const effectiveW = isRotated ? h : w;
  const effectiveH = isRotated ? w : h;

  // Aspect ratio: in-app shots explicitly supply `aspect` (e.g. "3:4", "9:16", "1:1").
  // If none supplied, default to "3:4" (full sensor) or look's format if defined.
  const targetAspect: CameraAspect = aspect ?? (look?.aspectRatio as CameraAspect) ?? "3:4";
  const crop = cropForAspectAndZoom(effectiveW, effectiveH, targetAspect, zoom);

  // iOS Safari WebKit canvas memory protection: clamp maxEdge to 2560px
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const effectiveMaxEdge = isIOS ? Math.min(maxEdge, 2560) : maxEdge;
  const out = fitLongestEdge(crop.sw, crop.sh, effectiveMaxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;

  // Normalized crop rectangle in effective coordinates
  const normCropRect = {
    x: crop.sx / effectiveW,
    y: crop.sy / effectiveH,
    width: crop.sw / effectiveW,
    height: crop.sh / effectiveH,
  };

  // If clean original requested, draw directly without filter
  if (!applyFilter) {
    if (src instanceof HTMLVideoElement) {
      try {
        const { pipeline: p, canvas: glCanvas } = getSharedCapturePipeline();
        if (glCanvas.width !== out.width || glCanvas.height !== out.height) {
          glCanvas.width = out.width;
          glCanvas.height = out.height;
        }
        const renderedRaw = p.render(src, look, {
          width: out.width,
          height: out.height,
          isCapture: true,
          intensity: 0,
          flashUsed: false,
          cropRect: normCropRect,
          mirror,
          rotation: isRotated ? tiltAngle : 0,
        });
        if (renderedRaw && !isCanvasBlankOrBlack(glCanvas)) {
          return await toBlob(glCanvas, quality);
        }
      } catch (e) {
        console.warn("Raw WebGL capture failed, attempting 2D fallback:", e);
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.imageSmoothingQuality = "high";
    if (isRotated) {
      ctx.save();
      ctx.translate(out.width / 2, out.height / 2);
      ctx.rotate(tiltAngle === 90 ? -Math.PI / 2 : Math.PI / 2);
      if (mirror) ctx.scale(-1, 1);
      const sX = tiltAngle === 90 ? w - (crop.sy + crop.sh) : crop.sy;
      const sY = tiltAngle === 90 ? crop.sx : h - (crop.sx + crop.sw);
      ctx.drawImage(src, sX, sY, crop.sh, crop.sw, -out.height / 2, -out.width / 2, out.height, out.width);
      ctx.restore();
    } else if (mirror) {
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
  const isVideo = src instanceof HTMLVideoElement;
  let sourceToRender: TexImageSource = src;
  let interCanvas: HTMLCanvasElement | null = null;

  // For HTMLVideoElement, NEVER draw to a 2D canvas on iOS WebKit (it produces black frames).
  // Instead, pass the video directly to WebGL and let the shader handle normalized cropRect and mirror.
  if (!isVideo && (zoom > 1 || crop.sw !== effectiveW || crop.sh !== effectiveH || mirror || isRotated)) {
    interCanvas = document.createElement("canvas");
    interCanvas.width = out.width;
    interCanvas.height = out.height;
    const iCtx = interCanvas.getContext("2d");
    if (iCtx) {
      iCtx.imageSmoothingQuality = "high";
      if (isRotated) {
        iCtx.save();
        iCtx.translate(out.width / 2, out.height / 2);
        iCtx.rotate(tiltAngle === 90 ? -Math.PI / 2 : Math.PI / 2);
        if (mirror) iCtx.scale(-1, 1);
        const sX = tiltAngle === 90 ? w - (crop.sy + crop.sh) : crop.sy;
        const sY = tiltAngle === 90 ? crop.sx : h - (crop.sx + crop.sw);
        iCtx.drawImage(src, sX, sY, crop.sh, crop.sw, -out.height / 2, -out.width / 2, out.height, out.width);
        iCtx.restore();
      } else if (mirror) {
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
      cropRect: isVideo ? normCropRect : undefined,
      mirror: isVideo ? mirror : false,
      flashUsed: flashUsed,
      rotation: isVideo && isRotated ? tiltAngle : 0,
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

    // Black-Frame Sanity Check: If composited WebGL canvas is blank or solid black,
    // only attempt 2D CPU fallback if src is NOT HTMLVideoElement (2D canvas can't draw WebKit video)
    if (isCanvasBlankOrBlack(canvas) && !isVideo) {
      console.warn("Rendered WebGL canvas was blank/black, falling back to 2D CPU LookRecipe pipeline");
      if (isRotated) {
        ctx2d.save();
        ctx2d.translate(out.width / 2, out.height / 2);
        ctx2d.rotate(tiltAngle === 90 ? -Math.PI / 2 : Math.PI / 2);
        if (mirror) ctx2d.scale(-1, 1);
        const sX = tiltAngle === 90 ? w - (crop.sy + crop.sh) : crop.sy;
        const sY = tiltAngle === 90 ? crop.sx : h - (crop.sx + crop.sw);
        ctx2d.drawImage(src, sX, sY, crop.sh, crop.sw, -out.height / 2, -out.width / 2, out.height, out.width);
        ctx2d.restore();
      } else if (mirror) {
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
  } else {
    // Fallback 2D if WebGL unavailable — uses the exact same LookRecipe color science
    if (isRotated) {
      ctx2d.save();
      ctx2d.translate(out.width / 2, out.height / 2);
      ctx2d.rotate(tiltAngle === 90 ? -Math.PI / 2 : Math.PI / 2);
      if (mirror) ctx2d.scale(-1, 1);
      const sX = tiltAngle === 90 ? w - (crop.sy + crop.sh) : crop.sy;
      const sY = tiltAngle === 90 ? crop.sx : h - (crop.sx + crop.sw);
      ctx2d.drawImage(src, sX, sY, crop.sh, crop.sw, -out.height / 2, -out.width / 2, out.height, out.width);
      ctx2d.restore();
    } else if (mirror) {
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

  // Read back immediately in the same task with defensive fallback
  try {
    const blob = await toBlob(canvas, quality);
    canvas.width = canvas.height = 0; // free memory
    return blob;
  } catch (err) {
    console.warn("Primary canvas encode failed, falling back to emergency 2D encode:", err);
    canvas.width = canvas.height = 0;
    const fbCanvas = document.createElement("canvas");
    const fbOut = fitLongestEdge(crop.sw, crop.sh, Math.min(effectiveMaxEdge, 1920));
    fbCanvas.width = fbOut.width;
    fbCanvas.height = fbOut.height;
    const fbCtx = fbCanvas.getContext("2d");
    if (fbCtx) {
      fbCtx.imageSmoothingQuality = "high";
      if (mirror) {
        fbCtx.save();
        fbCtx.translate(fbOut.width, 0);
        fbCtx.scale(-1, 1);
        fbCtx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, fbOut.width, fbOut.height);
        fbCtx.restore();
      } else {
        fbCtx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, fbOut.width, fbOut.height);
      }
    }
    const fbBlob = await toBlob(fbCanvas, 0.85);
    fbCanvas.width = fbCanvas.height = 0;
    return fbBlob;
  }
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

