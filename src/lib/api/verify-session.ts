import "server-only";
import { z } from "zod";

/**
 * Returns the cookie name used to bind a guest session to an event.
 * Must stay in sync with src/app/api/guests/route.ts.
 */
export const guestCookieName = (slug: string) => `dc_g_${slug}`;

/**
 * Parses the guest session cookie for `eventSlug` from the request's Cookie header.
 * Returns the guestId stored in the cookie, or null if absent or malformed.
 *
 * This is read-only — it never sets or refreshes the cookie.
 */
export function readGuestCookie(req: Request, eventSlug: string): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const name = guestCookieName(eventSlug);
  const pair = cookieHeader
    .split(/;\s*/)
    .map((c) => c.split("="))
    .find(([k]) => k === name);

  if (!pair || pair.length < 2) return null;
  const value = pair.slice(1).join("="); // handle values that themselves contain "="
  return z.string().uuid().safeParse(value).success ? value : null;
}

/**
 * Verifies that the `bodyGuestId` in a photo upload request matches the
 * `dc_g_<slug>` httpOnly session cookie, returning the verified guestId on
 * success or null on mismatch / missing cookie.
 *
 * Callers should reject requests where this returns null with a 403.
 *
 * Note: the cookie is set as httpOnly + sameSite=lax by /api/guests, so it
 * is automatically forwarded by the browser on same-origin requests. It is
 * NOT accessible to JavaScript, so a spoofed body guestId can only pass if
 * the attacker also has the matching cookie — i.e. they already own that
 * guest session.
 */
export function verifyGuestSession(
  req: Request,
  eventSlug: string,
  bodyGuestId: string
): string | null {
  const cookieGuestId = readGuestCookie(req, eventSlug);
  if (!cookieGuestId) return null;
  if (cookieGuestId !== bodyGuestId) return null;
  return cookieGuestId;
}
