import React from "react";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function AdminGuestsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-stone-800">
        <div>
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-7 w-56 rounded mt-1.5" />
          <Skeleton className="h-4 w-96 rounded mt-1.5" />
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-52 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Guest Rolls Table Skeleton */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    </div>
  );
}
