import React from "react";
import { Skeleton, KpiCardSkeleton, ChartPanelSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function AdminHealthLoading() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <Skeleton className="h-7 w-64 rounded" />
          <Skeleton className="h-4 w-80 rounded mt-1.5" />
        </div>
        <Skeleton className="h-9 w-44 rounded-xl" />
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      {/* Product Analytics & Filter Usage */}
      <div className="space-y-6">
        <div className="border-b border-zinc-800/80 pb-2">
          <Skeleton className="h-5 w-52 rounded" />
          <Skeleton className="h-3.5 w-72 rounded mt-1" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartPanelSkeleton height="h-72" />
          <ChartPanelSkeleton height="h-72" />
        </div>
      </div>

      {/* Telemetry Table */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-4">
        <Skeleton className="h-5 w-44 rounded" />
        <TableSkeleton rows={5} cols={5} />
      </div>
    </div>
  );
}
