import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { z } from "zod";
import { getEventBySlug } from "@/lib/event-server";
import { themeToCssVars } from "@/lib/event";
import { validateEventToken } from "@/lib/event-token";
import { guestCookieName } from "@/lib/api/verify-session";
import { GuestApp } from "@/components/guest/GuestApp";
import { EventExpiredScreen } from "@/components/guest/EventExpiredScreen";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ restore?: string; t?: string; token?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const candidateToken = resolvedSearchParams?.t || resolvedSearchParams?.token || null;

  const [event, cookieStore] = await Promise.all([
    getEventBySlug(slug),
    cookies(),
  ]);
  if (!event) return { title: "Disposable Cam" };

  const sessionCookie = cookieStore.get(guestCookieName(slug))?.value;
  const hasValidSessionCookie = Boolean(sessionCookie && z.string().uuid().safeParse(sessionCookie).success);
  const hasTokenParam = Boolean(candidateToken);
  const tokenValid = validateEventToken(candidateToken, event.access_token);
  const isExpired = event.token_expires_at ? new Date() >= new Date(event.token_expires_at) : false;

  // Strict token validation: If a token param was supplied in the URL, it MUST be valid.
  // A cookie can only permit access if NO token param was provided in the URL.
  const isUnauthorized = hasTokenParam ? !tokenValid : !hasValidSessionCookie;

  // Anti-oracle: do not leak couple names if token is invalid or expired
  if (isExpired || isUnauthorized) {
    return {
      title: isExpired ? "Camera Access Expired" : "Camera Access Closed",
      description: isExpired ? "This camera link has expired." : "This camera link is invalid or closed.",
    };
  }

  return {
    title: `${event.couple_names} — Disposable Cam`,
    description: "Capture moments with our disposable camera.",
  };
}

export default async function GuestPage({ params, searchParams }: PageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const initialRestoreCode = resolvedSearchParams?.restore || null;
  const candidateToken = resolvedSearchParams?.t || resolvedSearchParams?.token || null;

  const [event, cookieStore] = await Promise.all([
    getEventBySlug(slug),
    cookies(),
  ]);

  if (!event) {
    notFound();
  }

  const sessionCookie = cookieStore.get(guestCookieName(slug))?.value;
  const hasValidSessionCookie = Boolean(sessionCookie && z.string().uuid().safeParse(sessionCookie).success);
  const hasTokenParam = Boolean(candidateToken);
  const tokenValid = validateEventToken(candidateToken, event.access_token);
  const isExpired = event.token_expires_at ? new Date() >= new Date(event.token_expires_at) : false;

  // Strict token validation: If a token param was supplied in the URL, it MUST be valid.
  // A cookie can only permit access if NO token param was provided in the URL.
  const isUnauthorized = hasTokenParam ? !tokenValid : !hasValidSessionCookie;

  // Block unauthorized or expired guests with zero metadata leakage
  if (isExpired || isUnauthorized) {
    return <EventExpiredScreen eventSlug={slug} reason={isExpired ? "expired" : "invalid"} />;
  }

  // Handle paused or archived events gracefully
  if (event.status === "paused") {
    return (
      <div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-xl font-bold font-serif text-white mb-2">Intermission — Camera Paused</h1>
        <p className="text-sm text-zinc-400 max-w-sm">
          {event.couple_names} have briefly paused the wedding camera. Please keep this tab open and refresh shortly!
        </p>
      </div>
    );
  }

  if (event.status === "archived") {
    return (
      <div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
            <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3H4.5A3 3 0 0 1 1.5 18V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-xl font-bold font-serif text-white mb-2">Camera Concluded</h1>
        <p className="text-sm text-zinc-400 max-w-sm">
          The analog film roll for {event.couple_names} has been developed and archived. Thank you for capturing memories!
        </p>
      </div>
    );
  }

  const themeVars = themeToCssVars(event.theme);

  // Pre-hydrate returning guest session for zero-flicker roll count and camera screen
  let initialGuest: {
    guestId: string;
    name: string | null;
    rollCode: string;
    shotsUsed: number;
    shotsLeft: number;
  } | null = null;

  if (hasValidSessionCookie && sessionCookie) {
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const { computeRollCodeFromGuestId } = await import("@/lib/guest/session");
      const sb = supabaseAdmin();
      const { data: g } = await sb
        .from("guests")
        .select("id, display_name, created_at")
        .eq("id", sessionCookie)
        .eq("event_id", event.id)
        .maybeSingle();

      if (g) {
        const sessionResetAt = (event.theme && typeof event.theme === "object" && "sessionResetAt" in event.theme)
          ? (event.theme as { sessionResetAt?: string | null }).sessionResetAt
          : null;
        const isExpired = !!(sessionResetAt && g.created_at && new Date(g.created_at) < new Date(sessionResetAt));

        if (!isExpired) {
          const { count } = await sb
            .from("photos")
            .select("id", { count: "exact", head: true })
            .eq("guest_id", g.id)
            .neq("status", "failed");

          const shotsUsed = count ?? 0;
          const shotsLeft = Math.max(0, event.shots_per_guest - shotsUsed);
          initialGuest = {
            guestId: g.id,
            name: g.display_name,
            rollCode: computeRollCodeFromGuestId(g.id),
            shotsUsed,
            shotsLeft,
          };
        }
      }
    } catch (err) {
      console.warn("Failed to pre-hydrate initial guest session:", err);
    }
  }

  return (
    <div
      style={themeVars as React.CSSProperties}
      className="min-h-dvh bg-bg text-fg font-sans flex flex-col"
    >
      <GuestApp
        event={event}
        initialRestoreCode={initialRestoreCode}
        eventToken={candidateToken || event.access_token}
        tokenExpiresAt={event.token_expires_at}
        initialGuest={initialGuest}
      />
    </div>
  );
}
