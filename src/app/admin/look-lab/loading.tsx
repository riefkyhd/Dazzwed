import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function LookLabLoading() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-40 rounded" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded mt-1.5" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Preset Pill Selector Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-36 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
      </div>

      {/* Split Stage: Viewport Canvas + Shader Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl bg-zinc-950 border border-zinc-800 p-4 aspect-[4/3] flex items-center justify-center">
          <Skeleton className="w-full h-full rounded-xl" />
        </div>
        <div className="lg:col-span-5 rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-4">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
