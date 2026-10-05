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
      const candidates: ShotRecord[] = [];
      for (const item of pending) {
        if (this.inFlight.has(item.shotId)) continue;

        if (item.nextAttemptAt > now) {
          const waitTime = item.nextAttemptAt - now;
          if (nextWakeupMs === null || waitTime < nextWakeupMs) {
            nextWakeupMs = waitTime;
          }
          continue;
        }

        candidates.push(item);
      }

      // Schedule next wakeup if any items are waiting on backoff timer
      if (nextWakeupMs !== null) {
        this.timer = setTimeout(() => this.drain(), Math.max(500, nextWakeupMs));
      }

      // Fill available concurrency slots (up to MAX_CONCURRENT)
      while (this.activeCount < MAX_CONCURRENT && candidates.length > 0) {
        const item = candidates.shift()!;
        this.activeCount++;
        this.inFlight.add(item.shotId);

        // Mark as uploading in DB
        void updateShot(item.shotId, { status: "uploading" });

        // Dispatch upload task asynchronously without blocking loop
        void this.uploadItem(item).finally(() => {
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
      const form = new FormData();
      form.append("file", item.blob, `${item.shotId}.jpg`);
      form.append("guestId", item.guestId);
      form.append("eventSlug", item.eventSlug);
      form.append("shotId", item.shotId);

      const res = await fetch("/api/photos", {
        method: "POST",
        body: form,
      });

      if (res.ok) {
        // Upload confirmed by server! Free memory by dropping blob.
        await updateShot(item.shotId, {
          status: "synced",
          blob: null,
        });
        const remaining = await getPendingShots();
        this.notify(remaining.length);
        return;
      }

      // 403 Forbidden: e.g. shot limit already exceeded or event closed
      if (res.status === 403 || res.status === 404 || res.status === 413 || res.status === 415) {
        console.warn(`Server rejected photo upload (${res.status}). Dropping item.`);
        await updateShot(item.shotId, { status: "synced", blob: null });
        const remaining = await getPendingShots();
        this.notify(remaining.length);
        return;
      }

      // 503, 429, or 5xx: temporary error, retry with backoff + jitter
      const retryAfter = res.headers.get("Retry-After");
      const delay = this.calculateBackoff(item.attempts, retryAfter);
      await updateShot(item.shotId, {
        status: "queued",
        attempts: item.attempts + 1,
        nextAttemptAt: Date.now() + delay,
      });
    } catch (netErr) {
      // NetworkError (e.g. offline, Airplane mode, DNS failure)
      console.warn("Network error during photo upload. Scheduling retry:", netErr);
      const delay = this.calculateBackoff(item.attempts);
      await updateShot(item.shotId, {
        status: "queued",
        attempts: item.attempts + 1,
        nextAttemptAt: Date.now() + delay,
      });
    }
  }
}

// Global singleton instance for the browser session
export const uploadQueue = new UploadQueue();
