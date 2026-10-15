import Image from "next/image";

export default function Home() {
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
    </main>
  );
}
