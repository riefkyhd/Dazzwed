import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function GuestCameraLoading() {
  return (
    <div className="fixed inset-0 bg-black flex flex-col justify-between items-center p-4 select-none animate-in fade-in duration-150 z-50">
      {/* Top Controls Bar Skeleton */}
      <div className="w-full max-w-md flex items-center justify-between pt-2 px-2">
        <Skeleton className="h-8 w-24 rounded-full bg-stone-900/80 border-stone-800" />
        <Skeleton className="h-8 w-28 rounded-full bg-stone-900/80 border-stone-800" />
        <Skeleton className="h-8 w-10 rounded-full bg-stone-900/80 border-stone-800" />
      </div>

      {/* Viewfinder Frame Skeleton (3:4 aspect ratio) */}
      <div className="w-full max-w-md flex-1 flex items-center justify-center py-4">
        <div className="w-full aspect-[3/4] max-h-[70vh] rounded-3xl bg-stone-950 border border-stone-800/80 relative overflow-hidden flex flex-col items-center justify-center p-6 shadow-2xl">
          {/* Subtle corner framing indicators */}
          <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-500/30 rounded-tl-lg" />
          <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-500/30 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-500/30 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-500/30 rounded-br-lg" />

          {/* Center Brand Emblem / Pulse */}
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 rounded-full bg-amber-400/20" />
          </div>
          <div className="mt-4 text-center space-y-1.5">
            <Skeleton className="h-4 w-32 mx-auto rounded" />
            <Skeleton className="h-3 w-44 mx-auto rounded bg-stone-900/60" />
          </div>
        </div>
      </div>

      {/* Bottom Camera Dock Skeleton */}
      <div className="w-full max-w-md pb-6 px-4 flex items-center justify-around">
        {/* Gallery / Roll preview pill */}
        <Skeleton className="h-12 w-12 rounded-2xl bg-stone-900/80 border-stone-800" />

        {/* Big Shutter Button Placeholder */}
        <div className="w-20 h-20 rounded-full border-4 border-stone-800 bg-stone-950 flex items-center justify-center p-1.5 shadow-xl">
          <div className="w-full h-full rounded-full bg-amber-400/20 animate-pulse border border-amber-400/30" />
        </div>

        {/* Switch Camera / Flash Placeholder */}
        <Skeleton className="h-12 w-12 rounded-2xl bg-stone-900/80 border-stone-800" />
      </div>
    </div>
  );
}
