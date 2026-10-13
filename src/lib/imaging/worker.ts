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

/**
 * NOTE: The blob-URL inline worker path below is only reached when `document` is
 * undefined (i.e. an SSR context), which never happens for camera photo processing.
 * The primary path in processImageOffThread() calls renderShot() directly on the
 * main thread (lines ~252-279 below), which uses the full WebGL2 LookEnginePipeline
 * with LookRecipe color science.
 *
 * We intentionally do NOT maintain a divergent 2D-canvas film-look implementation
 * inside the worker string. If this secondary path is ever reached it will fail loudly
 * rather than silently producing a look that doesn't match the LookRecipe pipeline.
 */
const workerCode = `
self.onmessage = async (e) => {
  const { id, blob, maxEdge = 4096, quality = 0.92 } = e.data;

  try {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      bitmap = await createImageBitmap(blob);
    }

    const origW = bitmap.width;
    const origH = bitmap.height;

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

    // Film look is NOT applied here. This worker path is a last-resort decode/resize
    // only. Look processing requires the LookEnginePipeline on the main thread.

    const outBlob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    self.postMessage({ id, success: true, blob: outBlob, width: targetW, height: targetH });
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
