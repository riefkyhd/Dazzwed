import React from "react";
import { Skeleton, FormCardSkeleton } from "@/components/ui/Skeleton";

export default function ConnectDriveLoading() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6 max-w-3xl mx-auto font-sans space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-zinc-800 pb-5 mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-7 w-64 rounded mt-1.5" />
          <Skeleton className="h-4 w-80 rounded mt-1.5" />
        </div>
      </div>

      <FormCardSkeleton rows={3} />
      <FormCardSkeleton rows={2} />
    </div>
  );
}
