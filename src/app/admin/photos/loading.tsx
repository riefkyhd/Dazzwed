import React from "react";
import { Skeleton, GalleryGridSkeleton } from "@/components/ui/Skeleton";

export default function AdminPhotosLoading() {
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

      {/* Filter Toolbar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-6 bg-stone-900/60 border border-stone-800 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-18 rounded-lg" />
          <Skeleton className="h-8 w-18 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* 12-Card Editorial Gallery Grid Skeleton */}
      <GalleryGridSkeleton count={12} />
    </div>
  );
}
