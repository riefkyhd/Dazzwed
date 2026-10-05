import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/env";

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  retryAfter: number;
}

/**
 * Checks and increments rate limit for a specific key (guestId or IP)
 * using the atomic Postgres rate_limits table.
 */
export async function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const sb = supabaseAdmin();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const currentWindowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString();

  try {
    const { data, error } = await sb.rpc("check_rate_limit", {
      p_key: key,
      p_window_start: currentWindowStart,
      p_max_requests: maxRequests,
    });

    if (error || !data || data.length === 0) {
      // In case of an unexpected DB error, fail open to avoid dropping wedding photos
      console.error("Rate limit check failed, failing open:", error);
      return { allowed: true, currentCount: 1, retryAfter: 0 };
    }

    const row = data[0] as { allowed: boolean; current_count: number };
    const retryAfter = Math.max(1, Math.ceil((new Date(currentWindowStart).getTime() + windowMs - now) / 1000));

    return {
      allowed: row.allowed,
      currentCount: row.current_count,
      retryAfter,
    };
  } catch (err) {
    console.error("Rate limit exception, failing open:", err);
    return { allowed: true, currentCount: 1, retryAfter: 0 };
  }
}

/**
 * Extracts the real client IP from incoming request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Validates Cloudflare Turnstile token if enabled in server environment.
 */
export async function verifyTurnstileToken(token: string | null | undefined, ip: string): Promise<boolean> {
  const env = serverEnv();
  if (!env.TURNSTILE_ENABLED) {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", env.TURNSTILE_SECRET_KEY!);
    formData.append("response", token);
    formData.append("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const outcome = (await res.json()) as { success?: boolean };
    return Boolean(outcome.success);
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}
