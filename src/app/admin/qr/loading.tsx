import React from "react";
import { Skeleton, FormCardSkeleton } from "@/components/ui/Skeleton";

export default function AdminQrLoading() {
  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-150">
      {/* Controls Header */}
      <div className="pb-6 mb-6 sm:mb-8 border-b border-zinc-800">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-8 w-72 rounded mt-1.5" />
        <Skeleton className="h-4 w-96 rounded mt-1.5" />
      </div>

      {/* Configuration & Action Bar */}
      <FormCardSkeleton rows={3} />

      {/* Poster Preview Skeleton */}
      <div className="mt-8 flex justify-center">
        <div className="w-full max-w-[500px] aspect-[1/1.414] rounded-2xl bg-zinc-950 border border-zinc-800 p-8 flex flex-col items-center justify-between">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-64 w-64 rounded-2xl" />
          <Skeleton className="h-4 w-60 rounded" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
