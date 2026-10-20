import "server-only";

export interface DriveRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxJitterMs?: number;
  context?: string;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

/**
 * Checks whether an error from Google Drive API or fetch is a rate-limit or transient network error.
 * Specifically distinguishes rate-limit 403s from quota/disk full 403s.
 */
export function isRetryableDriveError(error: unknown): boolean {
  if (!error) return false;

  const err = error as any;
  const status = err.status || err.code || err.statusCode || err.response?.status;
  const message = String(err.message || "").toLowerCase();
  const errors = err.errors || err.response?.data?.error?.errors || [];
  const reasons = errors.map((e: any) => String(e?.reason || "").toLowerCase());
  const combinedText = (message + " " + reasons.join(" ")).toLowerCase();

  // 1. FAIL FAST: Storage Quota Exceeded (disk full) must NOT be retried
  if (combinedText.includes("storagequotaexceeded") || combinedText.includes("quotaexceeded")) {
    return false;
  }

  // 2. HTTP 429: Rate Limit / Too Many Requests
  if (status === 429 || combinedText.includes("too many requests")) {
    return true;
  }

  // 3. HTTP 403: Retry ONLY if it's a rate limit or concurrent write limit
  if (status === 403) {
    if (
      combinedText.includes("ratelimitexceeded") ||
      combinedText.includes("userratelimitexceeded") ||
      combinedText.includes("usagelimits") ||
      combinedText.includes("rate limit")
    ) {
      return true;
    }
    // Other 403 errors (permissions, invalid auth, etc.) should not be retried
    return false;
  }

  // 4. HTTP 5xx: Transient Google Drive server errors
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  // 5. Network / Socket level errors
  if (
    combinedText.includes("econnreset") ||
    combinedText.includes("etimedout") ||
    combinedText.includes("econnrefused") ||
    combinedText.includes("socket hang up") ||
    combinedText.includes("fetch failed") ||
    combinedText.includes("network error")
  ) {
    return true;
  }

  return false;
}

/**
 * Calculates exponential backoff with full jitter to smooth out 500-guest concurrency spikes:
 * delay = min(3000ms, 400ms * 2^attempt + random(0..350ms))
 */
export function calculateDriveBackoff(
  attempt: number,
  baseDelayMs: number = 400,
  maxJitterMs: number = 350
): number {
  const base = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * maxJitterMs);
  return Math.min(3000, base + jitter);
}

/**
 * Executes a Google Drive API function with automatic exponential backoff and jitter for transient errors.
 */
export async function withDriveRetry<T>(
  fn: () => Promise<T>,
  opts: DriveRetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || !isRetryableDriveError(err)) {
        throw err;
      }

      const delayMs = calculateDriveBackoff(
        attempt,
        opts.baseDelayMs ?? 400,
        opts.maxJitterMs ?? 350
      );
      if (opts.context) {
        console.warn(
          `[withDriveRetry] ${opts.context} failed on attempt ${attempt}/${maxRetries}. Retrying in ${delayMs}ms... Error:`,
          (err as any)?.message || err
        );
      }
      opts.onRetry?.(attempt, delayMs, err);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
