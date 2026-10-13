/**
 * Telemetry Sanitizer & PII Protection
 *
 * Strips personally identifiable information (PII) including email addresses,
 * phone numbers, bearer tokens, JWTs, and passwords from telemetry logs.
 */

// Max allowable telemetry payload: 16 KB
export const MAX_TELEMETRY_BODY_BYTES = 16384;

/**
 * Redacts email addresses, phone numbers, tokens, and credentials from telemetry messages.
 */
export function sanitizeTelemetryMessage(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Redact JWTs (3 dot-separated base64url segments)
  text = text.replace(
    /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    "[REDACTED_JWT]"
  );

  // 2. Redact Bearer tokens & Authorization headers
  text = text.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED_TOKEN]");

  // 3. Redact Email addresses
  text = text.replace(
    /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
    "[REDACTED_EMAIL]"
  );

  // 4. Redact Phone numbers (common international and Indonesian/US formats)
  text = text.replace(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}\b/g,
    "[REDACTED_PHONE]"
  );

  // 5. Redact passwords / secret query params or keys
  text = text.replace(
    /(?:password|secret|token|api[_-]?key)\s*[:=]\s*["']?[^"'\s,}&]+/gi,
    "credentials=[REDACTED]"
  );

  // 6. Hard limit to 1000 characters
  return text.slice(0, 1000);
}
