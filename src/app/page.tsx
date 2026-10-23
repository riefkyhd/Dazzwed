import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { getEventBySlug } from "@/lib/event-server";

export default async function Home() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const guestCookie = allCookies.find((c) => c.name.startsWith("dc_g_") && c.value);

  let activeEvent: { slug: string; couple_names: string } | null = null;
  if (guestCookie) {
    const slug = guestCookie.name.replace(/^dc_g_/, "");
    try {
      const event = await getEventBySlug(slug);
      if (event && event.status !== "archived") {
        activeEvent = { slug: event.slug, couple_names: event.couple_names };
      }
    } catch {}
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center bg-[#0C0A09] min-h-dvh">
      <div className="relative h-16 sm:h-20 w-52 sm:w-64 drop-shadow-lg">
        <Image
          src="/Unveiled_logo_horizontal_transparent.png"
          alt="Unveiled"
          fill
          priority
          sizes="(max-width: 640px) 208px, 256px"
          className="object-contain"
        />
      </div>
      <div className="space-y-2 max-w-sm">
        <p className="text-zinc-400 text-sm leading-relaxed">
          Celebrate the couple, capture the vibe, unveil the memories.
        </p>
      </div>

      {activeEvent && (
        <div className="mt-2 p-4 rounded-xl bg-zinc-900/90 border border-amber-400/30 text-center max-w-xs w-full shadow-lg transition-all animate-fadeIn">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-amber-400 font-medium mb-1">
            Active Film Roll Detected
          </p>
          <p className="text-base font-serif text-zinc-100 mb-3">
            {activeEvent.couple_names}
          </p>
          <Link
            href={`/e/${activeEvent.slug}`}
            className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg bg-amber-400 text-zinc-950 font-semibold text-xs hover:brightness-110 active:scale-[0.99] transition-all"
          >
            Return to Camera &rarr;
          </Link>
        </div>
      )}
    </main>
  );
}
