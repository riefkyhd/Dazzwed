import React from "react";
import { Skeleton, FormCardSkeleton } from "@/components/ui/Skeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-6 mb-8 border-b border-zinc-800">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-7 w-48 rounded mt-1.5" />
        <Skeleton className="h-4 w-96 rounded mt-1.5" />
      </div>

      {/* Settings Form Cards */}
      <FormCardSkeleton rows={4} />
      <FormCardSkeleton rows={3} />
      <FormCardSkeleton rows={3} />
    </div>
  );
}
