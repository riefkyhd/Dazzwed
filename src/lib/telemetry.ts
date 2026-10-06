"use client";

export interface TelemetryPayload {
  type: "error" | "unhandledrejection" | "camera_fail" | "upload_fail" | "warning" | "info";
  message: string;
  route: string;
  eventSlug?: string;
  guestId?: string;
}

function parseClientDeviceInfo(): {
  deviceClass: "mobile" | "tablet" | "desktop" | "unknown";
  browser: string;
  os: string;
} {
  if (typeof navigator === "undefined") {
    return { deviceClass: "unknown", browser: "unknown", os: "unknown" };
  }

  const ua = navigator.userAgent;
  let deviceClass: "mobile" | "tablet" | "desktop" | "unknown" = "desktop";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceClass = "tablet";
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) {
    deviceClass = "mobile";
  }

  let browser = "other";
  if (/Instagram/i.test(ua)) browser = "Instagram";
  else if (/WhatsApp/i.test(ua)) browser = "WhatsApp";
  else if (/FBAN|FBAV/i.test(ua)) browser = "Facebook";
  else if (/Line/i.test(ua)) browser = "LINE";
  else if (/TikTok/i.test(ua)) browser = "TikTok";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  let os = "other";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { deviceClass, browser, os };
}

// Client-side rate-limit & sample buffer
const recentMessages = new Set<string>();
let reportCountThisMinute = 0;
let lastMinuteReset = Date.now();

export function reportClientEvent(payload: TelemetryPayload): void {
  try {
    const now = Date.now();
    if (now - lastMinuteReset > 60_000) {
      reportCountThisMinute = 0;
      lastMinuteReset = now;
      recentMessages.clear();
    }

    // Max 10 reports per minute per client to avoid network floods
    if (reportCountThisMinute >= 10) return;

    // Deduplicate identical error messages within the same minute
    const msgKey = `${payload.type}:${payload.message.slice(0, 80)}`;
    if (recentMessages.has(msgKey)) return;
    recentMessages.add(msgKey);
    reportCountThisMinute += 1;

    const { deviceClass, browser, os } = parseClientDeviceInfo();

    const body = {
      ...payload,
      message: payload.message.slice(0, 950), // Sanitize max length
      deviceClass,
      browser,
      os,
      appVersion: "0.1.0",
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry", JSON.stringify(body));
    } else {
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Suppress telemetry errors
  }
}

/**
 * Initializes global window error & rejection traps
 */
export function initGlobalTelemetry(eventSlug?: string, guestId?: string): () => void {
  if (typeof window === "undefined") return () => {};

  const errorHandler = (event: ErrorEvent) => {
    reportClientEvent({
      type: "error",
      message: event.message || "Unknown Window Error",
      route: window.location.pathname,
      eventSlug,
      guestId,
    });
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    reportClientEvent({
      type: "unhandledrejection",
      message: `Unhandled Rejection: ${msg}`,
      route: window.location.pathname,
      eventSlug,
      guestId,
    });
  };

  window.addEventListener("error", errorHandler);
  window.addEventListener("unhandledrejection", rejectionHandler);

  return () => {
    window.removeEventListener("error", errorHandler);
    window.removeEventListener("unhandledrejection", rejectionHandler);
  };
}
