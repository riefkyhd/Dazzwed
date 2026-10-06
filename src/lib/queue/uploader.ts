import {
  getPendingShots,
  updateShot,
  type ShotRecord,
} from "./store";

const MAX_CONCURRENT = 2;
const MAX_BACKOFF_MS = 60_000;

export interface UploadQueueOptions {
  onPendingChange?: (count: number) => void;
}

type Listener = (pendingCount: number) => void;

class UploadQueue {
  private activeCount = 0;
  private inFlight = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private isRunning = false;
  private initialized = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initListeners();
    }
  }

  private initListeners() {
    if (this.initialized) return;
    this.initialized = true;

    // Immediately kick queue when back online
    window.addEventListener("online", () => {
      this.resetDelaysAndDrain();
    });

    // Check queue when tab comes to foreground
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.drain();
      }
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(pendingCount: number) {
    for (const l of this.listeners) {
      try {
        l(pendingCount);
      } catch (e) {
        console.error("Queue listener error:", e);
      }
    }
  }

  /**
   * Resets all retry delays for queued shots and triggers immediate processing.
   * Useful when regaining network connectivity after airplane mode or offline periods.
   */
  public async resetDelaysAndDrain(): Promise<void> {
    const pending = await getPendingShots();
    for (const shot of pending) {
      if (shot.nextAttemptAt > Date.now()) {
        await updateShot(shot.shotId, { nextAttemptAt: 0 });
      }
    }
    this.drain();
  }

  /**
   * Trigger queue processing
   */
  public drain(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.process();
  }

  private calculateBackoff(attempts: number, retryAfterHeader?: string | null): number {
    if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed * 1000;
      }
    }
    // Exponential backoff: 2s, 4s, 8s, 16s... up to 60s + random jitter
    const exp = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, attempts));
    const jitter = Math.floor(Math.random() * 1000);
    return exp + jitter;
  }

  private async process(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const pending = await getPendingShots();
      this.notify(pending.length);

      if (pending.length === 0) {
        return;
      }

      const now = Date.now();
      let nextWakeupMs: number | null = null;

      // Filter shots ready to process
      const candidates: { item: ShotRecord; type: "primary" | "original" }[] = [];
      for (const item of pending) {
        if (this.inFlight.has(item.shotId)) continue;

        const needsPrimary = item.status !== "synced";
        const needsOriginal = item.originalStatus && item.originalStatus !== "none" && item.originalStatus !== "synced";

        // Self-heal: If marked pending but neither blob is present or needs work, clean up to avoid zombie queue
        if (!needsPrimary && !needsOriginal) {
          continue;
        }

        if (needsPrimary) {
          if (!item.blob) {
            // No blob for primary: cannot upload, mark synced to unblock
            void updateShot(item.shotId, { status: "synced" });
            continue;
          }
          if (item.nextAttemptAt > now) {
            const waitTime = item.nextAttemptAt - now;
            if (nextWakeupMs === null || waitTime < nextWakeupMs) {
              nextWakeupMs = waitTime;
            }
            continue;
          }
          candidates.push({ item, type: "primary" });
        } else if (needsOriginal) {
          if (!item.originalBlob) {
            // No blob for original: cannot upload, mark synced to unblock
            void updateShot(item.shotId, { originalStatus: "synced" });
            continue;
          }
          const origNextAttempt = item.originalNextAttemptAt || 0;
          if (origNextAttempt > now) {
            const waitTime = origNextAttempt - now;
            if (nextWakeupMs === null || waitTime < nextWakeupMs) {
              nextWakeupMs = waitTime;
            }
            continue;
          }
          candidates.push({ item, type: "original" });
        }
      }

      // Schedule next wakeup if any items are waiting on backoff timer
      if (nextWakeupMs !== null) {
        this.timer = setTimeout(() => this.drain(), Math.max(500, nextWakeupMs));
      }

      // Fill available concurrency slots (up to MAX_CONCURRENT)
      while (this.activeCount < MAX_CONCURRENT && candidates.length > 0) {
        const { item, type } = candidates.shift()!;
        this.activeCount++;
        this.inFlight.add(item.shotId);

        const uploadTask =
          type === "primary"
            ? (async () => {
                void updateShot(item.shotId, { status: "uploading" });
                await this.uploadItem(item);
              })()
            : (async () => {
                await this.uploadOriginalItem(item);
              })();

        // Dispatch upload task asynchronously without blocking loop
        void uploadTask.finally(() => {
          this.activeCount--;
          this.inFlight.delete(item.shotId);
          // Re-trigger queue loop as a slot just freed up
          this.drain();
        });
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async uploadItem(item: ShotRecord): Promise<void> {
    if (!item.blob) {
      // Missing blob cannot be uploaded; mark synced to unblock queue
      await updateShot(item.shotId, { status: "synced" });
      return;
    }

    try {
      // Step A: Initialize resumable session & reserve shot atomically
      const initRes = await fetch("/api/photos/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: item.eventSlug,
          guestId: item.guestId,
          shotId: item.shotId,
          sizeBytes: item.blob.size,
          width: item.width,
          height: item.height,
          source: item.source || "inapp",
          lookId: item.lookId || "disposable-400",
          lookVersion: item.lookVersion || 1,
        }),
      });

      if (!initRes.ok) {
        if (initRes.status === 403 || initRes.status === 404 || initRes.status === 507) {
          console.warn(`Server rejected photo init (${initRes.status}). Dropping item.`);
          await updateShot(item.shotId, { status: "synced", blob: null });
          const remaining = await getPendingShots();
          this.notify(remaining.length);
          return;
        }

        const retryAfter = initRes.headers.get("Retry-After");
        const delay = this.calculateBackoff(item.attempts, retryAfter);
        await updateShot(item.shotId, {
          status: "queued",
          attempts: item.attempts + 1,
          nextAttemptAt: Date.now() + delay,
        });
        return;
      }

      const initData = await initRes.json();
      if (initData.duplicate && initData.driveFileId) {
        // Already successfully uploaded in prior attempt
        await updateShot(item.shotId, { status: "synced", blob: null });
        const remaining = await getPendingShots();
        this.notify(remaining.length);
        return;
      }

      const sessionUri = initData.sessionUri;
      if (!sessionUri) {
        throw new Error("No resumable sessionUri returned from init");
      }

      // Step B: Upload straight to session URI in 2 MiB chunks (multiple of 256 KiB)
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MiB
      const totalBytes = item.blob.size;
      let startByte = 0;
      let driveFileId: string | null = null;
      let useProxy = false;

      while (startByte < totalBytes) {
        const endByte = Math.min(startByte + CHUNK_SIZE, totalBytes);
        const chunk = item.blob.slice(startByte, endByte);
        const contentRange = `bytes ${startByte}-${endByte - 1}/${totalBytes}`;

        let chunkRes: Response;
        if (!useProxy) {
          try {
            // Direct browser PUT to Google Drive
            chunkRes = await fetch(sessionUri, {
              method: "PUT",
              headers: {
                "Content-Range": contentRange,
                "Content-Type": "image/jpeg",
              },
              body: chunk,
            });
          } catch (corsErr) {
            console.warn("Direct CORS to Google Drive failed, switching to /api/photos/chunk proxy:", corsErr);
            useProxy = true;
            // Retry this chunk through proxy
            chunkRes = await fetch("/api/photos/chunk", {
              method: "PUT",
              headers: {
                "x-session-uri": sessionUri,
                "content-range": contentRange,
                "content-type": "image/jpeg",
              },
              body: chunk,
            });
          }
        } else {
          // Proxy chunk through Next.js
          chunkRes = await fetch("/api/photos/chunk", {
            method: "PUT",
            headers: {
              "x-session-uri": sessionUri,
              "content-range": contentRange,
              "content-type": "image/jpeg",
            },
            body: chunk,
          });
        }

        // 308 Resume Incomplete => chunk received, continue next chunk
        if (chunkRes.status === 308) {
          const range = chunkRes.headers.get("range");
          if (range) {
            const m = range.match(/bytes=0-(\d+)/);
            if (m && m[1]) {
              startByte = parseInt(m[1], 10) + 1;
              continue;
            }
          }
          startByte = endByte;
          continue;
        }

        // 200 or 201 Created => upload completely finished!
        if (chunkRes.status === 200 || chunkRes.status === 201) {
          const finishedData = await chunkRes.json().catch(() => null);
          driveFileId = finishedData?.id || null;
          break;
        }

        // Error in chunk upload
        throw new Error(`Chunk upload failed with status ${chunkRes.status}`);
      }

      // Step C: Confirm photo upload with server
      if (driveFileId) {
        const confirmRes = await fetch("/api/photos/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId: item.shotId,
            driveFileId,
            sizeBytes: totalBytes,
          }),
        });

        if (confirmRes.ok) {
          // Free filtered blob storage and mark primary photo synced!
          // Guest UI immediately reflects "Saved" / counter increments
          await updateShot(item.shotId, { status: "synced", blob: null });
          const remaining = await getPendingShots();
          this.notify(remaining.length);

          // If there is a clean original blob waiting, initiate original upload asynchronously
          if (item.originalBlob && item.originalStatus !== "synced") {
            void this.uploadOriginalItem(item);
          }
          return;
        }
      }

      // If finished without fileId or confirmation, mark for retry
      const delay = this.calculateBackoff(item.attempts);
      await updateShot(item.shotId, {
        status: "queued",
        attempts: item.attempts + 1,
        nextAttemptAt: Date.now() + delay,
      });
    } catch (netErr) {
      console.warn("Error during resumable photo upload. Scheduling retry:", netErr);
      const delay = this.calculateBackoff(item.attempts);
      await updateShot(item.shotId, {
        status: "queued",
        attempts: item.attempts + 1,
        nextAttemptAt: Date.now() + delay,
      });
    }
  }

  /**
   * Uploads the clean unfiltered original to the "originals" subfolder in Google Drive.
   * Runs independently in background so the guest is NEVER blocked.
   */
  private async uploadOriginalItem(item: ShotRecord): Promise<void> {
    if (!item.originalBlob) {
      await updateShot(item.shotId, { originalStatus: "synced" });
      return;
    }

    try {
      await updateShot(item.shotId, { originalStatus: "uploading" });

      // Step A: Init resumable session for original
      const initRes = await fetch("/api/photos/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: item.eventSlug,
          guestId: item.guestId,
          shotId: item.shotId,
          sizeBytes: item.originalBlob.size,
          width: item.width,
          height: item.height,
          source: item.source || "inapp",
          isOriginal: true,
        }),
      });

      if (!initRes.ok) {
        if (initRes.status === 403 || initRes.status === 404 || initRes.status === 507) {
          console.warn(`Server rejected original photo init (${initRes.status}). Dropping original.`);
          await updateShot(item.shotId, { originalStatus: "synced", originalBlob: null });
          const remaining = await getPendingShots();
          this.notify(remaining.length);
          return;
        }

        const delay = this.calculateBackoff(item.originalAttempts || 0);
        await updateShot(item.shotId, {
          originalStatus: "queued",
          originalAttempts: (item.originalAttempts || 0) + 1,
          originalNextAttemptAt: Date.now() + delay,
        });
        return;
      }

      const initData = await initRes.json();
      if (initData.duplicate && initData.driveFileId) {
        // Original already uploaded
        await updateShot(item.shotId, { originalStatus: "synced", originalBlob: null });
        const remaining = await getPendingShots();
        this.notify(remaining.length);
        return;
      }

      const sessionUri = initData.sessionUri;
      if (!sessionUri) throw new Error("No sessionUri returned for original");

      // Step B: Upload chunks
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MiB
      const totalBytes = item.originalBlob.size;
      let startByte = 0;
      let driveFileId: string | null = null;
      let useProxy = false;

      while (startByte < totalBytes) {
        const endByte = Math.min(startByte + CHUNK_SIZE, totalBytes);
        const chunk = item.originalBlob.slice(startByte, endByte);
        const contentRange = `bytes ${startByte}-${endByte - 1}/${totalBytes}`;

        let chunkRes: Response;
        if (!useProxy) {
          try {
            chunkRes = await fetch(sessionUri, {
              method: "PUT",
              headers: { "Content-Range": contentRange, "Content-Type": "image/jpeg" },
              body: chunk,
            });
          } catch {
            useProxy = true;
            chunkRes = await fetch("/api/photos/chunk", {
              method: "PUT",
              headers: {
                "x-session-uri": sessionUri,
                "content-range": contentRange,
                "content-type": "image/jpeg",
              },
              body: chunk,
            });
          }
        } else {
          chunkRes = await fetch("/api/photos/chunk", {
            method: "PUT",
            headers: {
              "x-session-uri": sessionUri,
              "content-range": contentRange,
              "content-type": "image/jpeg",
            },
            body: chunk,
          });
        }

        if (chunkRes.status === 308) {
          const range = chunkRes.headers.get("range");
          if (range) {
            const m = range.match(/bytes=0-(\d+)/);
            if (m && m[1]) {
              startByte = parseInt(m[1], 10) + 1;
              continue;
            }
          }
          startByte = endByte;
          continue;
        }

        if (chunkRes.status === 200 || chunkRes.status === 201) {
          const finishedData = await chunkRes.json().catch(() => null);
          driveFileId = finishedData?.id || null;
          break;
        }

        throw new Error(`Original chunk upload failed: ${chunkRes.status}`);
      }

      // Step C: Confirm original
      if (driveFileId) {
        const confirmRes = await fetch("/api/photos/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId: item.shotId,
            driveFileId,
            sizeBytes: totalBytes,
            isOriginal: true,
          }),
        });

        if (confirmRes.ok) {
          // Free original blob storage!
          await updateShot(item.shotId, { originalStatus: "synced", originalBlob: null });
          const remaining = await getPendingShots();
          this.notify(remaining.length);
          return;
        }
      }

      const delay = this.calculateBackoff(item.originalAttempts || 0);
      await updateShot(item.shotId, {
        originalStatus: "queued",
        originalAttempts: (item.originalAttempts || 0) + 1,
        originalNextAttemptAt: Date.now() + delay,
      });
    } catch (err) {
      console.warn("Background upload of original failed, will retry:", err);
      const delay = this.calculateBackoff(item.originalAttempts || 0);
      await updateShot(item.shotId, {
        originalStatus: "queued",
        originalAttempts: (item.originalAttempts || 0) + 1,
        originalNextAttemptAt: Date.now() + delay,
      });
    }
  }
}

// Global singleton instance for the browser session
export const uploadQueue = new UploadQueue();
