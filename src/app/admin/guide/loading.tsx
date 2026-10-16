import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminGuideLoading() {
  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-8 animate-in fade-in duration-150">
      {/* Header & Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-8 w-72 rounded mt-1.5" />
          <Skeleton className="h-4 w-96 rounded mt-1.5" />
        </div>
        <Skeleton className="h-9 w-44 rounded-full" />
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Article Cards Skeleton */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-3">
          <Skeleton className="h-6 w-56 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/6 rounded" />
        </div>
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-3">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}
