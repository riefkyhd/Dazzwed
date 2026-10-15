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
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const candidateToken = resolvedSearchParams?.t || resolvedSearchParams?.token || null;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Disposable Cam" };

  const cookieStore = await cookies();
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
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialRestoreCode = resolvedSearchParams?.restore || null;
  const candidateToken = resolvedSearchParams?.t || resolvedSearchParams?.token || null;

  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(guestCookieName(slug))?.value;
  const hasValidSessionCookie = Boolean(sessionCookie && z.string().uuid().safeParse(sessionCookie).success);
  const tokenValid = validateEventToken(candidateToken, event.access_token);
  const isExpired = event.token_expires_at ? new Date() >= new Date(event.token_expires_at) : false;

  // Block unauthorized or expired guests with zero metadata leakage
  if (isExpired || (!tokenValid && !hasValidSessionCookie)) {
    return <EventExpiredScreen eventSlug={slug} />;
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
