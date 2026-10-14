import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center bg-[#0C0A09] min-h-dvh">
      <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 bg-[#F9F6EE] p-1">
        <Image
          src="/logo.png"
          alt="Unveiled Logo"
          fill
          priority
          sizes="(max-width: 640px) 112px, 144px"
          className="object-contain p-2"
        />
      </div>
      <div className="space-y-2 max-w-sm">
        <h1 className="font-serif text-3xl sm:text-4xl text-accent tracking-tight">Unveiled</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Celebrate the couple, capture the vibe, unveil the memories.
        </p>
      </div>
    </main>
  );
}
