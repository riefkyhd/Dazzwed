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
  const tokenValid = validateEventToken(candidateToken, event.access_token);
  const isExpired = event.token_expires_at ? new Date() >= new Date(event.token_expires_at) : false;

  // Anti-oracle: do not leak couple names if token is invalid or expired
  if (isExpired || (!tokenValid && !hasValidSessionCookie)) {
    return {
      title: "Camera Access Closed",
      description: "This camera link is expired or closed.",
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
  const tokenValid = validateEventToken(candidateToken, event.access_token);
  const isExpired = event.token_expires_at ? new Date() >= new Date(event.token_expires_at) : false;

  // Block unauthorized or expired guests with zero metadata leakage
  if (isExpired || (!tokenValid && !hasValidSessionCookie)) {
    return <EventExpiredScreen eventSlug={slug} />;
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
      />
    </div>
  );
}
