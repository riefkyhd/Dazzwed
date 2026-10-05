import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventBySlug } from "@/lib/event-server";
import { themeToCssVars } from "@/lib/event";
import { GuestApp } from "@/components/guest/GuestApp";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Disposable Cam" };
  return {
    title: `${event.couple_names} — Disposable Cam`,
    description: "Capture moments with our disposable camera.",
  };
}

export default async function GuestPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const themeVars = themeToCssVars(event.theme);

  return (
    <div
      style={themeVars as React.CSSProperties}
      className="min-h-dvh bg-bg text-fg font-sans flex flex-col"
    >
      <GuestApp event={event} />
    </div>
  );
}
