/**
 * Image Processing Web Worker
 * Performs decode (honoring EXIF orientation), canvas filtering, and JPEG encoding off the main thread.
 * Falls back to main thread execution if Worker or OffscreenCanvas is unsupported.
 */

import { renderShot } from "./render";
import type { LookRecipe } from "./looks/types";

export interface ProcessImageMessage {
  id: string;
  blob: Blob;
  maxEdge?: number;
  quality?: number;
  applyFilter?: boolean;
  look?: LookRecipe;
}

export interface ProcessImageResponse {
  id: string;
  success: boolean;
  blob?: Blob;
  width?: number;
  height?: number;
  error?: string;
}

const workerCode = `
self.onmessage = async (e) => {
  const { id, blob, maxEdge = 4096, quality = 0.92, applyFilter = true } = e.data;

  try {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch (err) {
      // Fallback for browsers that don't support imageOrientation
      bitmap = await createImageBitmap(blob);
    }

    const origW = bitmap.width;
    const origH = bitmap.height;

    // Calculate scaled dimensions
    let targetW = origW;
    let targetH = origH;
    const longest = Math.max(origW, origH);
    if (longest > maxEdge) {
      const scale = maxEdge / longest;
      targetW = Math.max(1, Math.round(origW * scale));
      targetH = Math.max(1, Math.round(origH * scale));
    }

    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("OffscreenCanvas not supported in worker");
    }

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not obtain OffscreenCanvas 2D context");

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    if (applyFilter) {
      // Warm multiply cast
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(255, 236, 205, 0.35)";
      ctx.fillRect(0, 0, targetW, targetH);

      // Warm soft-light cast
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(255, 170, 70, 0.16)";
      ctx.fillRect(0, 0, targetW, targetH);

      // Vignette
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createRadialGradient(
        targetW / 2,
        targetH / 2,
        Math.min(targetW, targetH) * 0.35,
        targetW / 2,
        targetH / 2,
        Math.hypot(targetW, targetH) / 2
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, targetW, targetH);

      // Procedural grain
      const grainCanvas = new OffscreenCanvas(256, 256);
      const gCtx = grainCanvas.getContext("2d");
      if (gCtx) {
        const imgData = gCtx.createImageData(256, 256);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 90;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = v;
          imgData.data[i + 3] = 255;
        }
        gCtx.putImageData(imgData, 0, 0);

        const pattern = ctx.createPattern(grainCanvas, "repeat");
        if (pattern) {
          ctx.globalCompositeOperation = "overlay";
          ctx.globalAlpha = 0.2;
          ctx.translate(Math.random() * 256, Math.random() * 256);
          ctx.fillStyle = pattern;
          ctx.fillRect(-256, -256, targetW + 512, targetH + 512);
        }
      }
      ctx.restore();
    }

    const outBlob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: quality,
    });

    self.postMessage({
      id,
      success: true,
      blob: outBlob,
      width: targetW,
      height: targetH,
    });
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
`;

let workerInstance: Worker | null = null;
const pendingRequests = new Map<
  string,
  { resolve: (res: ProcessImageResponse) => void; reject: (err: unknown) => void }
>();

function getWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;

  if (!workerInstance) {
    try {
      const blobUrl = URL.createObjectURL(
        new Blob([workerCode], { type: "application/javascript" })
      );
      workerInstance = new Worker(blobUrl);
      workerInstance.onmessage = (e: MessageEvent<ProcessImageResponse>) => {
        const handler = pendingRequests.get(e.data.id);
        if (handler) {
          pendingRequests.delete(e.data.id);
          if (e.data.success) {
            handler.resolve(e.data);
          } else {
            handler.reject(new Error(e.data.error || "Worker processing failed"));
          }
        }
      };
      workerInstance.onerror = (e) => {
        console.error("Image processing worker error:", e);
        const err = new Error(e.message || "Image processing worker failed");
        for (const [reqId, handler] of pendingRequests.entries()) {
          pendingRequests.delete(reqId);
          handler.reject(err);
        }
        try {
          workerInstance?.terminate();
        } catch {
          // ignore
        }
        workerInstance = null;
      };
    } catch (e) {
      console.warn("Failed to instantiate image processing worker, using fallback:", e);
      return null;
    }
  }
  return workerInstance;
}

async function decodeImageSource(
  blob: Blob
): Promise<{ source: ImageBitmap | HTMLImageElement; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return {
        source: bmp,
        width: bmp.width,
        height: bmp.height,
        cleanup: () => bmp.close(),
      };
    } catch {
      try {
        const bmp = await createImageBitmap(blob);
        return {
          source: bmp,
          width: bmp.width,
          height: bmp.height,
          cleanup: () => bmp.close(),
        };
      } catch {
        // Fall through to HTMLImageElement
      }
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

/**
 * Processes an image using the WebGL2 Look Engine pipeline (with background decode/encode)
 * and safe fallback so native camera photos never hang.
 */
export async function processImageOffThread(
  blob: Blob,
  options: {
    maxEdge?: number;
    quality?: number;
    applyFilter?: boolean;
    look?: LookRecipe;
    onProgress?: (stage: "decoding" | "filtering" | "encoding") => void;
  } = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const targetMaxEdge = Math.min(options.maxEdge ?? 2560, 4096);
  const targetQuality = options.quality ?? 0.90;

  // Primary path: WebGL2 Look Engine pipeline (matches in-app film recipes & date stamp)
  if (typeof document !== "undefined") {
    options.onProgress?.("decoding");
    await new Promise((r) => setTimeout(r, 0)); // yield to paint

    const decoded = await decodeImageSource(blob);
    try {
      options.onProgress?.("filtering");
      await new Promise((r) => setTimeout(r, 0)); // yield to paint

      const longest = Math.max(decoded.width, decoded.height);
      const scale = longest > targetMaxEdge ? targetMaxEdge / longest : 1;
      const outW = Math.max(1, Math.round(decoded.width * scale));
      const outH = Math.max(1, Math.round(decoded.height * scale));

      const outBlob = await renderShot(decoded.source, {
        maxEdge: targetMaxEdge,
        quality: targetQuality,
        applyFilter: options.applyFilter ?? true,
        sourceType: "native",
        look: options.look,
      });

      options.onProgress?.("encoding");
      return { blob: outBlob, width: outW, height: outH };
    } finally {
      decoded.cleanup();
    }
  }

  // Secondary fallback: Web Worker with timeout guard
  const worker = getWorker();
  const id = crypto.randomUUID();

  if (worker) {
    options.onProgress?.("decoding");
    return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error("Worker processing timed out"));
        }
      }, 8000);

      pendingRequests.set(id, {
        resolve: (res) => {
          clearTimeout(timeout);
          if (res.blob && res.width && res.height) {
            resolve({ blob: res.blob, width: res.width, height: res.height });
          } else {
            reject(new Error("Invalid worker response payload"));
          }
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      worker.postMessage({
        id,
        blob,
        maxEdge: targetMaxEdge,
        quality: targetQuality,
        applyFilter: options.applyFilter ?? true,
      });
    });
  }

  throw new Error("No image processing context available");
}
